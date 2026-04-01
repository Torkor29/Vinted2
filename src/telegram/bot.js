/**
 * TelegramBot v2 — Clean, fluid UX for Vinted Sniper.
 *
 * Architecture:
 *   - Forum Topics for notification categories (Feed, Deals, Autobuy, Stats, Alertes)
 *   - Single-message editing UX (no spam — every interaction edits the same message)
 *   - Toggle selection with checkmarks for multi-select steps
 *   - Progress dots for multi-step wizards
 *   - Conversation state tracked per-user for interactive flows
 *   - Rate-limited outbound queue (350ms between sends)
 *   - Retry on 429 with Telegram's retry_after
 *
 * Commands: /menu, /start, /status (all others accessed via inline buttons)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { createLogger } from '../utils/logger.js';
import { sleep } from '../utils/retry.js';
import {
  GENDERS,
  CATEGORIES,
  BRANDS,
  SIZES,
  COLORS,
  CONDITIONS,
  searchBrands,
  getSizeGroup,
} from '../data/vinted-catalog.js';
import {
  formatNewItem,
  formatDeal,
  formatAutobuyAction,
  formatAlert,
  formatStats,
  formatBotStatus,
  formatFilters,
  formatTopDeals,
  formatStartupMessage,
  formatFilterRecap,
  formatFilterWizard,
  formatAutobuyMenu,
  formatAutobuyRules,
  formatRuleSummary,
  formatDealConfig,
  formatMainMenu,
  formatConfigMenu,
  formatCountries,
  formatSessions,
  formatWatchlist,
  escapeHtml,
} from './formatter.js';

const log = createLogger('telegram');

const TELEGRAM_API = 'https://api.telegram.org/bot';

/** Forum topic definitions — created once in the supergroup. */
const TOPIC_DEFINITIONS = [
  { key: 'feed',      name: '📡 Feed',              iconColor: 0x6FB9F0 },
  { key: 'deals',     name: '💎 Deals',             iconColor: 0xFFD67E },
  { key: 'achats',    name: '🛒 Achats',            iconColor: 0x8EEE98 },
  { key: 'listings',  name: '🏷️ Mise en vente', iconColor: 0xCB86DB },
  { key: 'compta',    name: '💰 Comptabilité', iconColor: 0xFFD67E },
  { key: 'stats',     name: '📊 Stats',             iconColor: 0x8EEE98 },
  { key: 'alertes',   name: '⚠️ Alertes',           iconColor: 0xFF93B2 },
  { key: 'logs',      name: '🔧 Logs',              iconColor: 0x7B8389 },
];

/** Steps for the filter creation wizard (order matters). */
const FILTER_STEPS = ['gender', 'categories', 'brands', 'sizes', 'colors', 'conditions', 'price', 'keywords', 'recap'];
const FILTER_TOTAL = FILTER_STEPS.length;

/** Popular brands shown as quick-pick buttons (top 12). */
const POPULAR_BRANDS = [
  { id: 53,   label: 'Nike' },
  { id: 14,   label: 'Adidas' },
  { id: 255,  label: 'Jordan' },
  { id: 2319, label: 'New Balance' },
  { id: 362,  label: 'The North Face' },
  { id: 10,   label: 'Ralph Lauren' },
  { id: 73,   label: 'Lacoste' },
  { id: 57,   label: "Levi's" },
  { id: 88,   label: 'Puma' },
  { id: 12,   label: 'Zara' },
  { id: 105,  label: 'Gucci' },
  { id: 52,   label: 'Louis Vuitton' },
];

export class TelegramBot {
  /**
   * @param {object} config - Application configuration
   * @param {object} [sniper] - VintedSniper instance (set via setSniper)
   */
  constructor(config, sniper = null) {
    this.config = config;
    this.telegramConfig = config.notifications?.telegram || {};
    this.sniper = sniper;

    this.botToken = this.telegramConfig.botToken;
    this.chatId = this.telegramConfig.chatId;

    /** Topic IDs persisted in config.json (legacy single-group) */
    this.topicIds = this.telegramConfig.topicIds || {};

    /**
     * Per-group topic IDs: { chatId: { feed: id, deals: id, ... } }
     * Supports multi-tenant: each group gets its own forum topics.
     */
    this.groupTopics = this.telegramConfig.groupTopics || {};
    // Migrate legacy single-group topicIds into groupTopics
    if (this.chatId && Object.keys(this.topicIds).length > 0 && !this.groupTopics[this.chatId]) {
      this.groupTopics[this.chatId] = { ...this.topicIds };
    }

    /** Polling state */
    this.polling = false;
    this.pollOffset = 0;
    this.pollAbortController = null;

    /**
     * Conversation state per user.
     * Map<userId, { command, step, data, messageId, chatId }>
     *
     * messageId is the message being edited during a wizard flow.
     */
    this.conversations = new Map();

    /** Internal stats */
    this.stats = {
      messagesSent: 0,
      messagesFailed: 0,
      commandsHandled: 0,
      startedAt: null,
    };

    /** Rate-limited send queue */
    this.sendQueue = [];
    this.processing = false;
  }

  /**
   * Sets the sniper reference. Required for all bot actions.
   * @param {object} sniper
   */
  setSniper(sniper) {
    this.sniper = sniper;
  }

  // ══════════════════════════════════════════
  //  LIFECYCLE
  // ══════════════════════════════════════════

  /**
   * Start the bot: verify connection, ensure topics, register commands, start polling.
   * @returns {boolean} true if started successfully
   */
  async start() {
    if (!this.botToken || !this.chatId) {
      log.warn('Telegram bot non configure (botToken ou chatId manquant)');
      return false;
    }

    log.info('Demarrage du bot Telegram...');
    this.stats.startedAt = Date.now();

    try {
      const me = await this.apiCall('getMe');
      log.info(`Bot connecte: @${me.username} (${me.first_name})`);

      await this.ensureForumTopics();
      await this.registerCommands();
      this.startPolling();

      const startup = formatStartupMessage();
      await this.sendToTopic('feed', startup.text);
      await this.logToTopic('info', `<b>Bot démarré</b> — @${me.username}`);

      log.info('Bot Telegram pret et en ecoute');
      return true;
    } catch (error) {
      log.error(`Echec demarrage Telegram: ${error.message}`);
      return false;
    }
  }

  /**
   * Gracefully stop the bot.
   */
  async stop() {
    log.info('Arret du bot Telegram...');
    this.polling = false;

    if (this.pollAbortController) {
      this.pollAbortController.abort();
      this.pollAbortController = null;
    }

    try {
      await this.sendToTopic('feed', '\ud83d\udd34 Bot Telegram d\u00e9connect\u00e9.');
    } catch {
      // best-effort
    }
  }

  // ══════════════════════════════════════════
  //  FORUM TOPICS
  // ══════════════════════════════════════════

  /**
   * Ensures all required forum topics exist in a supergroup.
   * Uses TELEGRAM_TOPIC_IDS env var (JSON) to persist topic IDs across deploys
   * on ephemeral filesystems like Render.
   * Format: TELEGRAM_TOPIC_IDS={"feed":123,"deals":456,"logs":789,...}
   * @param {string} [targetChatId] - Chat ID to set up. Defaults to this.chatId (admin group).
   */
  async ensureForumTopics(targetChatId = null) {
    const chatId = targetChatId || this.chatId;
    if (!chatId) return;

    // ── Load topic IDs from env var (survives Render redeploys) ──
    if (!this.groupTopics[chatId] || Object.keys(this.groupTopics[chatId]).length === 0) {
      const envTopics = process.env.TELEGRAM_TOPIC_IDS;
      if (envTopics) {
        try {
          const parsed = JSON.parse(envTopics);
          if (parsed && typeof parsed === 'object') {
            this.groupTopics[chatId] = { ...parsed };
            this.topicIds = { ...parsed };
            log.info(`Topic IDs chargés depuis TELEGRAM_TOPIC_IDS: ${Object.keys(parsed).join(', ')}`);
          }
        } catch (e) {
          log.warn(`TELEGRAM_TOPIC_IDS invalide (JSON attendu): ${e.message}`);
        }
      }
    }

    try {
      const chat = await this.apiCall('getChat', { chat_id: chatId });
      if (!chat.is_forum) {
        log.warn(`Groupe ${chatId} n'a pas les topics activés. Messages envoyés dans le chat principal.`);
        return;
      }
      log.info(`Forum topics actifs pour ${chatId}, vérification...`);
    } catch (error) {
      log.error(`Impossible de vérifier le chat ${chatId}: ${error.message}`);
      return;
    }

    if (!this.groupTopics[chatId]) this.groupTopics[chatId] = {};
    const topics = this.groupTopics[chatId];
    let changed = false;

    for (const def of TOPIC_DEFINITIONS) {
      if (topics[def.key]) {
        // Topic ID is known — verify it still exists (lightweight check)
        const exists = await this.topicExists(topics[def.key], chatId);
        if (exists) {
          log.debug(`Topic "${def.name}" OK dans ${chatId} (ID: ${topics[def.key]})`);
          continue;
        }
        log.warn(`Topic "${def.name}" disparu dans ${chatId}, recréation...`);
      }

      // Only create if we truly don't have a valid ID
      try {
        const topic = await this.apiCall('createForumTopic', {
          chat_id: chatId,
          name: def.name,
          icon_color: def.iconColor,
        });
        topics[def.key] = topic.message_thread_id;
        changed = true;
        log.info(`Topic créé dans ${chatId}: "${def.name}" (ID: ${topic.message_thread_id})`);
        await sleep(500);
      } catch (error) {
        log.error(`Impossible de créer le topic "${def.name}" dans ${chatId}: ${error.message}`);
      }
    }

    // Keep legacy topicIds in sync for admin group
    if (chatId === String(this.chatId) || chatId === this.chatId) {
      this.topicIds = { ...topics };
    }

    if (changed) {
      this.persistGroupTopics();
      // Log the topic IDs so user can set them as env var
      log.info(`\n╔══════════════════════════════════════════════════╗`);
      log.info(`║  TOPIC IDS — Copie cette valeur dans Render :    ║`);
      log.info(`║  TELEGRAM_TOPIC_IDS=${JSON.stringify(topics)}`);
      log.info(`╚══════════════════════════════════════════════════╝`);
      // Also send to logs topic if available
      if (topics.logs) {
        try {
          await this.sendToTopic('logs', 
            `🔧 <b>Topic IDs mis à jour</b>\n\n` +
            `Ajoute cette env var dans Render pour éviter les doublons :\n\n` +
            `<code>TELEGRAM_TOPIC_IDS=${JSON.stringify(topics)}</code>`
          );
        } catch { /* best effort */ }
      }
    }
  }

  /**
   * Checks if a topic still exists by sending an empty action (typing indicator).
   * Much faster than close+reopen (1 API call instead of 2).
   */
  async topicExists(topicId, chatId = null) {
    const cid = chatId || this.chatId;
    try {
      await this.apiCall('sendChatAction', {
        chat_id: cid,
        message_thread_id: topicId,
        action: 'typing',
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Persists topic IDs into config.json (legacy + per-group).
   */
  persistTopicIds() {
    this.persistGroupTopics();
  }

  /**
   * Persists per-group topic IDs into config.json.
   */
  persistGroupTopics() {
    try {
      const configPath = resolve('config.json');
      let fileConfig = {};
      if (existsSync(configPath)) {
        fileConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
      }
      if (!fileConfig.notifications) fileConfig.notifications = {};
      if (!fileConfig.notifications.telegram) fileConfig.notifications.telegram = {};
      // Legacy single-group (backward compat)
      fileConfig.notifications.telegram.topicIds = { ...this.topicIds };
      // Multi-group
      fileConfig.notifications.telegram.groupTopics = { ...this.groupTopics };
      writeFileSync(configPath, JSON.stringify(fileConfig, null, 2), 'utf-8');
      log.info('Group topic IDs sauvegardés dans config.json');
    } catch (error) {
      log.error(`Erreur sauvegarde topic IDs: ${error.message}`);
    }
  }

  /**
   * Get topic IDs for a specific group. Falls back to admin group.
   */
  getTopicsForGroup(chatId) {
    return this.groupTopics[chatId] || this.groupTopics[this.chatId] || this.topicIds || {};
  }

  /**
   * Send a log message to the 🔧 Logs topic (best-effort, never throws).
   * @param {string} level - 'info' | 'warn' | 'error'
   * @param {string} message - Log message (HTML supported)
   */
  async logToTopic(level, message) {
    const icons = { info: 'ℹ️', warn: '⚠️', error: '❌' };
    const icon = icons[level] || '📝';
    const time = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    try {
      await this.sendToTopic('logs', `${icon} <code>${time}</code> ${message}`);
    } catch { /* best effort — never crash for logging */ }
  }

  // ══════════════════════════════════════════
  //  OUTBOUND MESSAGING
  // ══════════════════════════════════════════

  /**
   * Sends a text message to a specific forum topic.
   * @param {string} topicKey - Topic key (feed, deals, etc.)
   * @param {string} text - Message text
   * @param {object} [options] - Extra options
   * @param {string} [targetChatId] - Target group chatId (defaults to admin group)
   */
  async sendToTopic(topicKey, text, options = {}, targetChatId = null) {
    const chatId = targetChatId || this.chatId;
    const topics = this.getTopicsForGroup(chatId);
    const topicId = topics[topicKey];
    const payload = {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: options.disablePreview ?? true,
      ...options,
    };
    if (topicId) payload.message_thread_id = topicId;
    return this.enqueue('sendMessage', payload);
  }

  /**
   * Sends a photo with caption to a specific forum topic.
   * @param {string} topicKey - Topic key
   * @param {string} photoUrl - Photo URL
   * @param {string} caption - Caption text
   * @param {object} [options] - Extra options
   * @param {string} [targetChatId] - Target group chatId
   */
  async sendPhotoToTopic(topicKey, photoUrl, caption, options = {}, targetChatId = null) {
    const chatId = targetChatId || this.chatId;
    const topics = this.getTopicsForGroup(chatId);
    const topicId = topics[topicKey];
    const payload = {
      chat_id: chatId,
      photo: photoUrl,
      caption,
      parse_mode: 'HTML',
      ...options,
    };
    if (topicId) payload.message_thread_id = topicId;
    return this.enqueue('sendPhoto', payload);
  }

  /**
   * Sends a text message (bypasses queue for interactive responses).
   * @returns {object} Telegram message result
   */
  async sendMessage(chatId, text, options = {}) {
    const payload = {
      chat_id: chatId,
      text: text.slice(0, 4096),
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      ...options,
    };
    try {
      const result = await this.apiCall('sendMessage', payload);
      this.stats.messagesSent++;
      return result;
    } catch (error) {
      this.stats.messagesFailed++;
      log.error(`Echec envoi message: ${error.message}`);
      throw error;
    }
  }

  /**
   * Edits an existing message (text + optional inline keyboard).
   * Falls back to sending a new message on failure.
   */
  async editMessage(chatId, messageId, text, replyMarkup = undefined) {
    try {
      const payload = {
        chat_id: chatId,
        message_id: messageId,
        text: text.slice(0, 4096),
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      };
      if (replyMarkup) {
        payload.reply_markup = typeof replyMarkup === 'string' ? replyMarkup : JSON.stringify(replyMarkup);
      }
      return await this.apiCall('editMessageText', payload);
    } catch (error) {
      if (error.message?.includes('message is not modified') || error.message?.includes('MESSAGE_ID_INVALID')) {
        return; // Silently ignore no-op edits
      }
      log.warn(`editMessage failed: ${error.message}, sending new message`);
      return await this.sendMessage(chatId, text, {
        reply_markup: replyMarkup ? (typeof replyMarkup === 'string' ? replyMarkup : JSON.stringify(replyMarkup)) : undefined,
      });
    }
  }

  // ══════════════════════════════════════════
  //  PUBLIC NOTIFICATION API (called by Sniper)
  // ══════════════════════════════════════════

  /**
   * Notifies a new item in the Feed topic.
   * @param {object} item - Item object
   * @param {string} [targetChatId] - Target group (null = admin group)
   */
  async notifyNewItem(item, targetChatId = null) {
    const msg = formatNewItem(item);
    const opts = { reply_markup: msg.reply_markup ? JSON.stringify(msg.reply_markup) : undefined };
    if (msg.photo) {
      await this.sendPhotoToTopic('feed', msg.photo, msg.text, opts, targetChatId);
    } else {
      await this.sendToTopic('feed', msg.text, opts, targetChatId);
    }
  }

  /**
   * Notifies a deal in the Deals topic.
   * @param {object} item - Item object
   * @param {string} [targetChatId] - Target group
   */
  async notifyDeal(item, targetChatId = null) {
    const msg = formatDeal(item);
    const opts = { reply_markup: msg.reply_markup ? JSON.stringify(msg.reply_markup) : undefined };
    if (msg.photo) {
      await this.sendPhotoToTopic('deals', msg.photo, msg.text, opts, targetChatId);
    } else {
      await this.sendToTopic('deals', msg.text, opts, targetChatId);
    }
  }

  /**
   * Notifies an autobuy action in the Autobuy topic.
   * @param {object} item - Item object
   * @param {object} record - Autobuy record
   * @param {string} [targetChatId] - Target group
   */
  async notifyAutobuy(item, record, targetChatId = null) {
    const msg = formatAutobuyAction(item, record);
    const opts = { reply_markup: msg.reply_markup ? JSON.stringify(msg.reply_markup) : undefined };
    if (msg.photo) {
      await this.sendPhotoToTopic('autobuy', msg.photo, msg.text, opts, targetChatId);
    } else {
      await this.sendToTopic('autobuy', msg.text, opts, targetChatId);
    }
  }

  /**
   * Sends an alert to the Alertes topic.
   * @param {string} [targetChatId] - Target group (null = all groups)
   */
  async notifyAlert(title, details = {}, targetChatId = null) {
    const msg = formatAlert(title, details);
    if (targetChatId) {
      await this.sendToTopic('alertes', msg.text, {}, targetChatId);
    } else {
      // Broadcast alert to ALL groups
      for (const gid of Object.keys(this.groupTopics)) {
        await this.sendToTopic('alertes', msg.text, {}, gid);
      }
    }
  }

  /**
   * Sends stats to the Stats topic.
   */
  async notifyStats(stats) {
    const msg = formatStats(stats);
    await this.sendToTopic('stats', msg.text);
  }

  // ══════════════════════════════════════════
  //  LONG POLLING
  // ══════════════════════════════════════════

  /**
   * Starts the long polling loop for receiving user commands.
   */
  startPolling() {
    if (this.polling) return;
    this.polling = true;
    this.pollLoop().catch(err => {
      log.error(`Polling loop crashed: ${err.message}`);
      if (this.polling) setTimeout(() => this.startPolling(), 5000);
    });
    log.info('Long polling d\u00e9marr\u00e9');
  }

  /**
   * Main polling loop.
   */
  async pollLoop() {
    while (this.polling) {
      try {
        this.pollAbortController = new AbortController();

        const updates = await this.apiCall('getUpdates', {
          offset: this.pollOffset,
          timeout: 30,
          allowed_updates: JSON.stringify(['message', 'callback_query']),
        }, {
          signal: this.pollAbortController.signal,
          timeout: 35000,
        });

        if (!Array.isArray(updates)) continue;

        for (const update of updates) {
          this.pollOffset = update.update_id + 1;
          try {
            // ── AUTH: check user whitelist ──
            const userId = update.callback_query?.from?.id || update.message?.from?.id;
            if (!this.isUserAllowed(userId)) {
              if (update.message?.text) {
                const cmd = update.message.text.trim().split(/\s+/)[0].replace(/@\w+$/, '').toLowerCase();
                const cid = update.message.chat.id;
                if (cmd === '/start' || cmd === '/myid') {
                  await this.sendMessage(cid, [
                    `\ud83d\udd12 <b>Acc\u00e8s refus\u00e9</b>`,
                    '',
                    `Ton ID : <code>${userId}</code>`,
                    '',
                    `Envoie cet ID \u00e0 l'admin pour \u00eatre autoris\u00e9.`,
                  ].join('\n'));
                }
              }
              continue;
            }

            // ── Auto-setup: if command comes from a new group, create topics (non-blocking) ──
            const msgChatId = update.callback_query?.message?.chat?.id || update.message?.chat?.id;
            if (msgChatId && String(msgChatId).startsWith('-') && !this.groupTopics[String(msgChatId)]) {
              log.info(`Nouveau groupe détecté: ${msgChatId}, setup des topics en arrière-plan...`);
              this.ensureForumTopics(String(msgChatId)).catch(e => log.warn(`Auto-setup failed: ${e.message}`));
            }

            if (update.callback_query) {
              await this.handleCallbackQuery(update.callback_query);
            } else if (update.message?.text) {
              const text = update.message.text.trim();
              if (text.startsWith('/')) {
                await this.handleCommand(update.message);
              } else {
                await this.handleTextMessage(update.message);
              }
            }
          } catch (error) {
            log.error(`Erreur update ${update.update_id}: ${error.message}`);
          }
        }
      } catch (error) {
        if (error.name === 'AbortError') break;
        log.error(`Polling error: ${error.message}`);
        await sleep(3000);
      }
    }
  }

  /**
   * Registers bot commands for Telegram's autocomplete menu.
   * Only 3 commands — everything else via inline buttons.
   */
  async registerCommands() {
    try {
      await this.apiCall('setMyCommands', {
        commands: JSON.stringify([
          { command: 'menu', description: 'Ouvrir le panneau de contr\u00f4le' },
          { command: 'status', description: 'Statut rapide du bot' },
          { command: 'start', description: 'D\u00e9marrer / Menu principal' },
          { command: 'turbo', description: 'Turbo mode (stats + toggle)' },
          { command: 'listing', description: 'G\u00e9n\u00e9rer une annonce' },
          { command: 'bilan', description: 'Bilan comptabilit\u00e9' },
          { command: 'myid', description: 'Afficher ton ID Telegram' },
        ]),
      });
      log.debug('Commandes enregistr\u00e9es');
    } catch (error) {
      log.warn(`Echec enregistrement commandes: ${error.message}`);
    }
  }

  // ══════════════════════════════════════════
  //  CONVERSATION STATE
  // ══════════════════════════════════════════

  /**
   * Checks if a Telegram user ID is allowed to use the bot.
   * Empty whitelist = public (anyone allowed).
   */
  isUserAllowed(userId) {
    const allowed = this._getAllowedUsers();
    if (allowed.length === 0) return true;
    return allowed.includes(userId);
  }

  /** First user in the whitelist is the admin. */
  isAdmin(userId) {
    const allowed = this._getAllowedUsers();
    return allowed.length > 0 && allowed[0] === userId;
  }

  /** Get the allowedUsers array (from runtime config). */
  _getAllowedUsers() {
    return this.config.notifications?.telegram?.allowedUsers || [];
  }

  /** Add a user ID to the whitelist (runtime + persist). */
  _addAllowedUser(id) {
    const tg = this.config.notifications?.telegram;
    if (!tg) return;
    if (!tg.allowedUsers) tg.allowedUsers = [];
    if (!tg.allowedUsers.includes(id)) {
      tg.allowedUsers.push(id);
      this._persistConfig();
    }
  }

  /** Remove a user ID from the whitelist (runtime + persist). */
  _removeAllowedUser(id) {
    const tg = this.config.notifications?.telegram;
    if (!tg?.allowedUsers) return;
    tg.allowedUsers = tg.allowedUsers.filter(u => u !== id);
    this._persistConfig();
  }

  /** Persist config.json to disk. */
  _persistConfig() {
    try {
      const configPath = resolve('config.json');
      writeFileSync(configPath, JSON.stringify(this.config, null, 2), 'utf-8');
      log.info('Config persisted to config.json');
    } catch (e) {
      log.warn(`Failed to persist config: ${e.message}`);
    }
  }

  /** Gets the conversation state for a user. */
  getConv(userId) {
    return this.conversations.get(userId) || null;
  }

  /** Sets the conversation state for a user. */
  setConv(userId, state) {
    this.conversations.set(userId, state);
  }

  /** Clears the conversation state for a user. */
  clearConv(userId) {
    this.conversations.delete(userId);
  }

  // ══════════════════════════════════════════
  //  COMMAND ROUTING
  // ══════════════════════════════════════════

  /**
   * Routes a /command to its handler.
   */
  async handleCommand(message) {
    const text = message.text.trim();
    const chatId = message.chat.id;
    const userId = message.from?.id;
    const topicId = message.message_thread_id || null;

    const parts = text.split(/\s+/);
    const command = parts[0].replace(/@\w+$/, '').toLowerCase();
    const args = parts.slice(1);

    log.info(`Commande: ${command} de ${message.from?.username || userId}`);
    this.stats.commandsHandled++;

    // Any new command cancels ongoing conversation
    this.clearConv(userId);

    const opts = {};
    if (topicId) opts.message_thread_id = topicId;

    try {
      switch (command) {
        case '/menu':
        case '/start':
        case '/settings':
          await this.cmdMainMenu(chatId, opts);
          break;
        case '/status':
          await this.cmdStatus(chatId, opts);
          break;
        case '/turbo':
          await this.cmdTurbo(chatId, opts);
          break;
        case '/myid':
          await this.sendMessage(chatId, `\ud83d\udd11 Ton ID : <code>${message.from.id}</code>`, opts);
          break;
        case '/adduser':
          await this.cmdAddUser(chatId, args, userId, opts);
          break;
        case '/removeuser':
        case '/deluser':
          await this.cmdRemoveUser(chatId, args, userId, opts);
          break;
        case '/users':
          await this.cmdListUsers(chatId, userId, opts);
          break;
        case '/watch_seller':
          await this.cmdWatchSeller(chatId, args, opts);
          break;
        case '/unwatch_seller':
          await this.cmdUnwatchSeller(chatId, args, opts);
          break;
        case '/listing':
        case '/annonce':
          await this.cmdListing(chatId, args, opts);
          break;
        case '/vendu':
        case '/sold':
          await this.cmdVendu(chatId, args, opts);
          break;
        case '/bilan':
        case '/compta':
          await this.cmdBilan(chatId, opts);
          break;
        case '/cancel':
          await this.sendMessage(chatId, '\u274c Op\u00e9ration annul\u00e9e.', opts);
          break;
        default:
          // Unknown commands — silently ignore
          break;
      }
    } catch (error) {
      log.error(`Erreur commande ${command}: ${error.message}`);
      await this.sendMessage(chatId, `\u274c Erreur: ${escapeHtml(error.message)}`, opts);
    }
  }

  /**
   * Handles text messages that are not commands (conversation responses).
   */
  async handleTextMessage(message) {
    const userId = message.from?.id;
    const chatId = message.chat.id;
    const text = message.text.trim();
    const conv = this.getConv(userId);

    if (!conv) return;

    try {
      switch (conv.command) {
        case 'filter_wizard':
          await this.handleFilterWizardText(chatId, userId, text);
          break;
        case 'add_rule':
          await this.handleRuleText(chatId, userId, text);
          break;
        case 'ab_edit':
          await this.handleAutobuyEditText(chatId, userId, text);
          break;
        case 'brand_search':
          await this.handleBrandSearchText(chatId, userId, text);
          break;
        default:
          // Handle purchase tracking conversations (use conv.type)
          if (conv.type === 'bought_price') {
            await this.handleBoughtPriceResponse(chatId, userId, text);
            return;
          }
          if (conv.type === 'sell_price') {
            await this.handleSellPriceResponse(chatId, userId, text);
            return;
          }
          break;
      }
    } catch (error) {
      log.error(`Erreur conversation ${conv.command || conv.type}: ${error.message}`);
      await this.sendMessage(chatId, `\u274c Erreur: ${escapeHtml(error.message)}`);
    }
  }

  // ══════════════════════════════════════════
  //  COMMANDS
  // ══════════════════════════════════════════

  /**
   * /menu — Main menu with inline buttons.
   */
  async cmdMainMenu(chatId, opts) {
    const msg = formatMainMenu(this.sniper, this.config);
    await this.sendMessage(chatId, msg.text, {
      ...opts,
      reply_markup: JSON.stringify(msg.reply_markup),
    });
  }

  /**
   * /status — Quick status one-liner.
   */
  async cmdStatus(chatId, opts) {
    const status = {
      running: this.sniper?.running ?? false,
      queriesCount: this.sniper?.queries?.length ?? 0,
      countries: this.config.countries,
      activeSessions: this.countActiveSessions(),
      totalNewItems: this.sniper?.totalNewItems ?? 0,
      pollCycles: this.sniper?.pollCycles ?? 0,
      autobuy: this.sniper?.autoBuyer?.getStats() ?? null,
    };
    const msg = formatBotStatus(status);
    await this.sendMessage(chatId, msg.text, opts);
  }

  /**
   * /turbo — Show TurboPoller stats with toggle button.
   */
  async cmdTurbo(chatId, opts) {
    const isActive = !!this.sniper?.turboPoller?.running;
    await this.sendMessage(chatId, this._formatTurboMsg(isActive), {
      ...opts,
      reply_markup: JSON.stringify(this._turboKeyboard(isActive)),
    });
  }

  /** Format the turbo stats message. */
  _formatTurboMsg(isActive) {
    if (!isActive) {
      return [
        '\u26a1 <b>TURBO POLLER</b>',
        '\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501',
        '',
        '\ud83d\udd34 Statut : <b>D\u00e9sactiv\u00e9</b>',
        '',
        'Le mode standard est actif (polling par cycles).',
        'Active le turbo pour passer en polling ultra-rapide',
        'avec des workers ind\u00e9pendants et stagger\u00e9s.',
      ].join('\n');
    }

    const s = this.sniper.turboPoller.getStats();
    const uptime = s.uptimeMs > 0 ? Math.round(s.uptimeMs / 60000) : 0;

    return [
      '\u26a1 <b>TURBO POLLER</b>',
      '\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501',
      '',
      `\ud83d\udfe2 Statut : <b>Actif</b>`,
      `\ud83d\udee0\ufe0f Workers : <b>${s.workersActive}</b>`,
      '',
      `\ud83d\udce1 Polls : <b>${s.totalPolls.toLocaleString()}</b>`,
      `\ud83d\udce6 Items d\u00e9tect\u00e9s : <b>${s.totalItems.toLocaleString()}</b>`,
      `\u274c Erreurs : ${s.totalErrors}`,
      '',
      `\u23f1\ufe0f D\u00e9lai : <b>${s.currentDelayMs}ms</b>`,
      `\ud83d\udcc8 R\u00e9ponse moy. : ${s.avgResponseMs}ms`,
      `\ud83d\udd04 Polls/min : <b>${s.pollsPerMinute}</b>`,
      `\ud83d\udce6 Items/min : <b>${s.itemsPerMinute}</b>`,
      '',
      `\u23f0 Uptime : ${uptime} min`,
    ].join('\n');
  }

  /** Build turbo inline keyboard. */
  _turboKeyboard(isActive) {
    const toggleBtn = isActive
      ? { text: '\u23f8\ufe0f D\u00e9sactiver Turbo', callback_data: 'act:turbo_off' }
      : { text: '\u26a1 Activer Turbo', callback_data: 'act:turbo_on' };

    const rows = [[toggleBtn]];
    if (isActive) {
      rows.push([{ text: '\ud83d\udd04 Rafra\u00eechir stats', callback_data: 'act:turbo_refresh' }]);
    }
    return { inline_keyboard: rows };
  }

  // ══════════════════════════════════════════
  //  USER MANAGEMENT (admin only)
  // ══════════════════════════════════════════

  /** /adduser [id] — Admin adds a user to the whitelist. */
  async cmdAddUser(chatId, args, userId, opts) {
    if (!this.isAdmin(userId)) {
      await this.sendMessage(chatId, '\ud83d\udd12 Seul l\'admin peut ajouter des utilisateurs.', opts);
      return;
    }
    const targetId = parseInt(args[0], 10);
    if (!targetId || isNaN(targetId)) {
      await this.sendMessage(chatId, 'Usage: <code>/adduser 123456789</code>', opts);
      return;
    }
    if (this.isUserAllowed(targetId)) {
      await this.sendMessage(chatId, `\u26a0\ufe0f <code>${targetId}</code> est d\u00e9j\u00e0 autoris\u00e9.`, opts);
      return;
    }
    this._addAllowedUser(targetId);
    const total = this._getAllowedUsers().length;
    await this.sendMessage(chatId, [
      `\u2705 <b>Utilisateur ajout\u00e9 !</b>`,
      '',
      `ID : <code>${targetId}</code>`,
      `Total : ${total} utilisateur(s) autoris\u00e9(s)`,
    ].join('\n'), opts);
  }

  /** /removeuser [id] — Admin removes a user from the whitelist. */
  async cmdRemoveUser(chatId, args, userId, opts) {
    if (!this.isAdmin(userId)) {
      await this.sendMessage(chatId, '\ud83d\udd12 Seul l\'admin peut retirer des utilisateurs.', opts);
      return;
    }
    const targetId = parseInt(args[0], 10);
    if (!targetId || isNaN(targetId)) {
      await this.sendMessage(chatId, 'Usage: <code>/removeuser 123456789</code>', opts);
      return;
    }
    if (targetId === userId) {
      await this.sendMessage(chatId, '\u274c Tu ne peux pas te retirer toi-m\u00eame.', opts);
      return;
    }
    this._removeAllowedUser(targetId);
    await this.sendMessage(chatId, `\ud83d\uddd1\ufe0f Utilisateur <code>${targetId}</code> retir\u00e9.`, opts);
  }

  /** /users — Admin lists all whitelisted users. */
  async cmdListUsers(chatId, userId, opts) {
    if (!this.isAdmin(userId)) {
      await this.sendMessage(chatId, '\ud83d\udd12 Seul l\'admin peut voir la liste.', opts);
      return;
    }
    const allowed = this._getAllowedUsers();
    if (allowed.length === 0) {
      await this.sendMessage(chatId, '\ud83d\udd13 Mode public \u2014 tout le monde peut utiliser le bot.', opts);
      return;
    }
    const lines = [
      `\ud83d\udd12 <b>Utilisateurs autoris\u00e9s (${allowed.length})</b>`,
      '',
      ...allowed.map((id, i) => `  ${i === 0 ? '\ud83d\udc51' : '\ud83d\udc64'} <code>${id}</code>${i === 0 ? ' (admin)' : ''}`),
      '',
      '<code>/adduser [id]</code> \u2014 ajouter',
      '<code>/removeuser [id]</code> \u2014 retirer',
    ];
    await this.sendMessage(chatId, lines.join('\n'), opts);
  }

  /**
   * /listing — Generate SEO listing.
   */
  async cmdListing(chatId, args, opts) {
    if (!args.length) {
      // Send help in the listings topic
      const listingsOpts = { ...opts };
      if (this.topicIds.listings) listingsOpts.message_thread_id = this.topicIds.listings;

      await this.sendMessage(chatId, [
        '\ud83c\udff7\ufe0f <b>MISE EN VENTE — G\u00e9n\u00e9rateur d\'annonce</b>',
        '',
        'Tape <code>/listing</code> + description courte :',
        '',
        '<code>/listing jogging nike gris M</code>',
        '<code>/listing air max 90 blanc 42 neuf</code>',
        '<code>/listing pull ralph lauren bleu M</code>',
        '<code>/listing doudoune north face noire L</code>',
        '',
        '\ud83d\udca1 Le bot d\u00e9tecte automatiquement :',
        '\u2022 70+ marques (Nike, Jordan, Gucci...)',
        '\u2022 30+ types (jogging, baskets, sac...)',
        '\u2022 20+ couleurs',
        '\u2022 Tailles (S, M, L, 42...)',
        '\u2022 \u00c9tat (neuf, tr\u00e8s bon, bon)',
        '',
        '\ud83d\udcb0 Pour enregistrer une vente :',
        '<code>/vendu [article] [prix]</code>',
        'Ex: <code>/vendu jogging nike 25</code>',
      ].join('\n'), listingsOpts);
      return;
    }

    try {
      const { ListingGenerator } = await import('../crm/listing-generator.js');
      const gen = new ListingGenerator();
      const input = args.join(' ');
      const result = gen.generate(input);

      // Always post in the listings topic
      const listingsOpts = { ...opts };
      if (this.topicIds.listings) listingsOpts.message_thread_id = this.topicIds.listings;

      const msg = [
        '\ud83c\udff7\ufe0f <b>ANNONCE PR\u00caTE</b>',
        '\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501',
        '',
        '\ud83d\udccc <b>Titre \u00e0 copier :</b>',
        `<code>${escapeHtml(result.title)}</code>`,
        '',
        '\ud83d\udcdd <b>Description \u00e0 copier :</b>',
        '\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500',
        `<pre>${escapeHtml(result.description)}</pre>`,
        '\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500',
        '',
        `\ud83d\udcb0 <b>Prix sugg\u00e9r\u00e9 :</b> ${result.suggestedPrice?.suggested || '?'}\u20ac`,
        result.suggestedPrice?.range ? `\ud83d\udcca Fourchette : ${result.suggestedPrice.range.low}\u20ac \u2014 ${result.suggestedPrice.range.high}\u20ac` : '',
        '',
        `\ud83c\udff7 <b>Tags :</b> ${result.tags?.join(' \u2022 ') || '-'}`,
        '',
        '\ud83d\udca1 <b>Conseils :</b>',
        ...(result.tips?.slice(0, 3).map(t => `  ${t}`) || []),
      ].filter(Boolean).join('\n');

      await this.sendMessage(chatId, msg, {
        ...listingsOpts,
        reply_markup: JSON.stringify({
          inline_keyboard: [
            [
              { text: '\ud83d\udd04 Reg\u00e9n\u00e9rer', callback_data: `regen:${Buffer.from(input).toString('base64').slice(0, 55)}` },
              { text: '\u2705 Mis en vente', callback_data: `listed:${Buffer.from(JSON.stringify({t:result.title,p:result.suggestedPrice?.suggested||0})).toString('base64').slice(0, 55)}` },
            ],
          ],
        }),
      });
    } catch (error) {
      await this.sendMessage(chatId, `\u274c Erreur: ${escapeHtml(error.message)}`, listingsOpts || opts);
    }
  }

  /**
   * /vendu [description] [prix] — Enregistre une vente dans la compta
   */
  async cmdVendu(chatId, args, opts) {
    const comptaOpts = { ...opts };
    if (this.topicIds.compta) comptaOpts.message_thread_id = this.topicIds.compta;

    if (args.length < 2) {
      await this.sendMessage(chatId, [
        '\ud83d\udcb0 <b>COMPTABILIT\u00c9 — Enregistrer une vente</b>',
        '',
        'Usage : <code>/vendu [article] [prix de vente]</code>',
        '',
        'Exemples :',
        '<code>/vendu jogging nike 25</code>',
        '<code>/vendu air max 90 45</code>',
        '<code>/vendu pull ralph lauren 35</code>',
        '',
        'Le bot calcule automatiquement :',
        '\u2022 Marge nette (- frais plateforme 5%)',
        '\u2022 Marge brute (- frais livraison)',
        '\u2022 Profit si tu avais un prix d\'achat',
        '',
        '\ud83d\udcca Pour voir le bilan : <code>/bilan</code>',
      ].join('\n'), comptaOpts);
      return;
    }

    // Parse: last arg is price, rest is description
    const prixStr = args[args.length - 1];
    const prix = parseFloat(prixStr);
    if (isNaN(prix)) {
      await this.sendMessage(chatId, '\u274c Le dernier mot doit \u00eatre le prix.\nEx: <code>/vendu jogging nike 25</code>', comptaOpts);
      return;
    }
    const description = args.slice(0, -1).join(' ');

    // CRM: try to find matching item in inventory and mark as sold
    let crmMatch = null;
    if (this.sniper?.crm) {
      const items = this.sniper.crm.getAll();
      // Try to find by fuzzy title match
      const descLower = description.toLowerCase();
      crmMatch = items.find(it =>
        it.status !== 'vendu' &&
        (it.title?.toLowerCase().includes(descLower) || descLower.includes(it.title?.toLowerCase()?.slice(0, 10)))
      );
      if (crmMatch) {
        this.sniper.crm.markSold(crmMatch.id, prix);
      }
    }

    // Record the sale
    const sale = {
      id: `sale-${Date.now()}`,
      description,
      prixVente: prix,
      prixAchat: crmMatch?.purchasePrice || null,
      fraisPlateforme: Math.round(prix * 0.05 * 100) / 100,
      fraisLivraison: 3,
      margeNette: null,
      profit: null,
      date: new Date().toISOString(),
      crmItemId: crmMatch?.id || null,
    };

    sale.margeNette = Math.round((prix - sale.fraisPlateforme - sale.fraisLivraison) * 100) / 100;
    if (sale.prixAchat) {
      sale.profit = Math.round((sale.margeNette - sale.prixAchat) * 100) / 100;
    }

    // Store sale in memory (and persist if CRM available)
    if (!this._sales) this._sales = [];
    this._sales.push(sale);

    // Build message
    const lines = [
      '\u2705 <b>VENTE ENREGISTR\u00c9E</b>',
      '\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501',
      '',
      `\ud83c\udff7\ufe0f <b>${escapeHtml(description)}</b>`,
      '',
      `\ud83d\udcb5 Prix de vente : <b>${prix}\u20ac</b>`,
    ];

    if (sale.prixAchat) {
      lines.push(`\ud83d\uded2 Prix d'achat : ${sale.prixAchat}\u20ac`);
    }

    lines.push(`\ud83c\udfed Frais plateforme (5%) : -${sale.fraisPlateforme}\u20ac`);
    lines.push(`\ud83d\udce6 Frais livraison : -${sale.fraisLivraison}\u20ac`);
    lines.push('');
    lines.push(`\ud83d\udcb0 <b>Marge nette : ${sale.margeNette}\u20ac</b>`);

    if (sale.profit !== null) {
      const profitIcon = sale.profit >= 0 ? '\ud83d\udfe2' : '\ud83d\udd34';
      lines.push(`${profitIcon} <b>Profit : ${sale.profit >= 0 ? '+' : ''}${sale.profit}\u20ac</b>`);
    }

    if (crmMatch) {
      lines.push('');
      lines.push(`\ud83d\udd17 Article CRM : ${escapeHtml(crmMatch.title || '?')}`);
    }

    // Running totals
    const totalVentes = this._sales.reduce((s, v) => s + v.prixVente, 0);
    const totalMarges = this._sales.reduce((s, v) => s + v.margeNette, 0);
    const totalProfits = this._sales.filter(v => v.profit !== null).reduce((s, v) => s + v.profit, 0);

    lines.push('');
    lines.push('\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
    lines.push(`\ud83d\udcca <b>Cumul :</b> ${this._sales.length} ventes \u2022 ${Math.round(totalVentes)}\u20ac CA \u2022 ${Math.round(totalMarges)}\u20ac marge \u2022 ${Math.round(totalProfits)}\u20ac profit`);

    await this.sendMessage(chatId, lines.join('\n'), comptaOpts);
  }

  /**
   * /bilan — Affiche le bilan comptable
   */
  async cmdBilan(chatId, opts) {
    const comptaOpts = { ...opts };
    if (this.topicIds.compta) comptaOpts.message_thread_id = this.topicIds.compta;

    const sales = this._sales || [];

    if (sales.length === 0) {
      await this.sendMessage(chatId, [
        '\ud83d\udcb0 <b>BILAN COMPTABLE</b>',
        '',
        'Aucune vente enregistr\u00e9e.',
        '',
        'Utilise <code>/vendu [article] [prix]</code> pour enregistrer une vente.',
      ].join('\n'), comptaOpts);
      return;
    }

    const totalCA = sales.reduce((s, v) => s + v.prixVente, 0);
    const totalFrais = sales.reduce((s, v) => s + v.fraisPlateforme + v.fraisLivraison, 0);
    const totalMarges = sales.reduce((s, v) => s + v.margeNette, 0);
    const totalAchats = sales.filter(v => v.prixAchat).reduce((s, v) => s + v.prixAchat, 0);
    const totalProfits = sales.filter(v => v.profit !== null).reduce((s, v) => s + v.profit, 0);
    const avgMarge = sales.length > 0 ? Math.round(totalMarges / sales.length * 100) / 100 : 0;
    const margePercent = totalCA > 0 ? Math.round(totalMarges / totalCA * 100) : 0;

    // Top 5 recent sales
    const recent = sales.slice(-5).reverse();

    const lines = [
      '\ud83d\udcb0 <b>BILAN COMPTABLE</b>',
      '\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501',
      '',
      `\ud83d\udcca <b>${sales.length}</b> ventes enregistr\u00e9es`,
      '',
      `\ud83d\udcb5 Chiffre d'affaires : <b>${Math.round(totalCA)}\u20ac</b>`,
      `\ud83d\uded2 Total achats : ${Math.round(totalAchats)}\u20ac`,
      `\ud83c\udfed Total frais : ${Math.round(totalFrais)}\u20ac`,
      '',
      `\ud83d\udcb0 <b>Marge totale : ${Math.round(totalMarges)}\u20ac</b> (${margePercent}%)`,
      `\ud83d\udcb0 Marge moyenne/vente : ${avgMarge}\u20ac`,
    ];

    if (totalAchats > 0) {
      const profitIcon = totalProfits >= 0 ? '\ud83d\udfe2' : '\ud83d\udd34';
      lines.push(`${profitIcon} <b>Profit net : ${totalProfits >= 0 ? '+' : ''}${Math.round(totalProfits)}\u20ac</b>`);
      const roi = totalAchats > 0 ? Math.round(totalProfits / totalAchats * 100) : 0;
      lines.push(`\ud83d\udcc8 ROI : ${roi}%`);
    }

    lines.push('');
    lines.push('<b>5 derni\u00e8res ventes :</b>');
    for (const s of recent) {
      const profitStr = s.profit !== null ? ` (${s.profit >= 0 ? '+' : ''}${s.profit}\u20ac)` : '';
      lines.push(`\u2022 ${escapeHtml(s.description)} \u2014 ${s.prixVente}\u20ac${profitStr}`);
    }

    await this.sendMessage(chatId, lines.join('\n'), comptaOpts);
  }

  // ══════════════════════════════════════════
  //  PURCHASE TRACKING PIPELINE
  //  Feed → 🛒 Achats → 🏷️ Mise en vente → 💰 Comptabilité
  // ══════════════════════════════════════════

  /**
   * "J'ai acheté" button clicked on a Feed/Deals item.
   * Asks for the total price paid, then records the purchase in Achats topic.
   */
  async handleBought(chatId, messageId, userId, itemIdStr) {
    const itemId = parseInt(itemIdStr, 10);

    // Find the item in recent items (dashboard cache or search cache)
    let item = this.sniper?.dashboard?.recentItems?.find(it => it.id === itemId);
    if (!item) {
      // Try fetching from Vinted API
      try {
        const details = await this.sniper?.search?.getItemDetails(this.config.countries?.[0] || 'fr', itemId);
        if (details) item = details;
      } catch {}
    }

    if (!item) {
      item = { id: itemId, title: `Article #${itemId}`, price: 0 };
    }

    // Start a conversation to ask for the price paid
    this.setConv(userId, {
      type: 'bought_price',
      step: 'price',
      item,
      chatId,
      messageId,
    });

    const suggestedPrice = item.price || '?';
    await this.editMessage(chatId, messageId, [
      `\ud83d\uded2 <b>Enregistrer l'achat</b>`,
      '',
      `\ud83c\udff7\ufe0f ${escapeHtml(item.title || '')}`,
      `\ud83d\udcb5 Prix affich\u00e9 : ${suggestedPrice}\u20ac`,
      '',
      `<b>Quel prix total as-tu pay\u00e9 ?</b> (article + livraison + protection)`,
      '',
      `Envoie le montant total (ex: <code>${suggestedPrice}</code>)`,
      `ou <code>annuler</code>`,
    ].join('\n'));
  }

  /**
   * Handles text response for purchase price entry.
   * Called from handleTextMessage when conv.type === 'bought_price'.
   */
  async handleBoughtPriceResponse(chatId, userId, text) {
    const conv = this.getConv(userId);
    if (!conv || conv.type !== 'bought_price') return false;

    if (text.toLowerCase() === 'annuler') {
      this.clearConv(userId);
      await this.sendMessage(chatId, '\u274c Achat annul\u00e9.');
      return true;
    }

    const totalPaid = parseFloat(text.replace(',', '.'));
    if (isNaN(totalPaid) || totalPaid <= 0) {
      await this.sendMessage(chatId, '\u274c Envoie un montant valide (ex: <code>15.50</code>)');
      return true;
    }

    const item = conv.item;
    this.clearConv(userId);

    // Create purchase record
    const purchase = {
      id: `pur-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      itemId: item.id,
      title: item.title || '',
      brand: item.brand || '',
      size: item.size || '',
      condition: item.condition || '',
      seller: item.seller?.login || '',
      itemPrice: item.price || totalPaid,
      shippingCost: Math.max(0, Math.round((totalPaid - (item.price || totalPaid)) * 0.7 * 100) / 100),
      protectionFee: Math.max(0, Math.round((totalPaid - (item.price || totalPaid)) * 0.3 * 100) / 100),
      totalCost: totalPaid,
      url: item.url || '',
      photo: item.photo || '',
      date: new Date().toISOString(),
      status: 'achete', // achete → en_vente → vendu
      salePrice: null,
      saleDate: null,
      profit: null,
    };

    // Store in purchases map
    if (!this._purchases) this._purchases = new Map();
    this._purchases.set(purchase.id, purchase);

    // Also store in CRM if available
    if (this.sniper?.crm) {
      this.sniper.crm.addPurchase(item, { price: totalPaid });
    }

    // Post purchase card in Achats topic
    const { formatPurchaseCard } = await import('./formatter.js');
    const msg = formatPurchaseCard(item, purchase);

    if (msg.photo) {
      await this.sendPhotoToTopic('achats', msg.photo, msg.text, {
        reply_markup: JSON.stringify(msg.reply_markup),
      });
    } else {
      await this.sendToTopic('achats', msg.text, {
        reply_markup: JSON.stringify(msg.reply_markup),
      });
    }

    // Confirm to user
    await this.sendMessage(chatId, [
      `\u2705 <b>Achat enregistr\u00e9 !</b>`,
      `${escapeHtml(item.title)} \u2014 ${totalPaid}\u20ac`,
      '',
      `\u27a1\ufe0f Retrouve-le dans le topic <b>\ud83d\uded2 Achats</b>`,
    ].join('\n'));

    return true;
  }

  /**
   * "Créer annonce" button from Achats topic.
   * Generates a listing and posts it in Mise en vente topic.
   */
  async handleMakeListing(chatId, messageId, purchaseId) {
    const purchase = this._purchases?.get(purchaseId);
    if (!purchase) {
      await this.editMessage(chatId, messageId, '\u274c Achat non trouv\u00e9.');
      return;
    }

    try {
      const { ListingGenerator } = await import('../crm/listing-generator.js');
      const gen = new ListingGenerator();

      // Build input from purchase details
      const input = [purchase.title, purchase.brand, purchase.size].filter(Boolean).join(' ');
      const result = gen.generate(input);

      // Post in Mise en vente topic
      const listingMsg = [
        `\ud83c\udff7\ufe0f <b>ANNONCE PR\u00caTE</b>`,
        `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501`,
        '',
        `\ud83d\udccc <b>Titre :</b>`,
        `<code>${escapeHtml(result.title)}</code>`,
        '',
        `\ud83d\udcdd <b>Description :</b>`,
        `<pre>${escapeHtml(result.description)}</pre>`,
        '',
        `\ud83d\udcb0 <b>Prix sugg\u00e9r\u00e9 :</b> ${result.suggestedPrice?.suggested || '?'}\u20ac`,
        result.suggestedPrice?.range ? `\ud83d\udcca Fourchette : ${result.suggestedPrice.range.low}\u20ac \u2014 ${result.suggestedPrice.range.high}\u20ac` : '',
        '',
        `\ud83d\uded2 <b>Achet\u00e9 :</b> ${purchase.totalCost}\u20ac`,
        `\ud83d\udcc8 <b>Marge estim\u00e9e :</b> ${Math.round((result.suggestedPrice?.suggested || 0) * 0.95 - 3 - purchase.totalCost)}\u20ac`,
      ].filter(Boolean).join('\n');

      if (purchase.photo) {
        await this.sendPhotoToTopic('listings', purchase.photo, listingMsg);
      } else {
        await this.sendToTopic('listings', listingMsg);
      }

      // Update purchase status
      purchase.status = 'en_vente';

      await this.editMessage(chatId, messageId,
        `\u2705 Annonce g\u00e9n\u00e9r\u00e9e dans <b>\ud83c\udff7\ufe0f Mise en vente</b>\n\nPrix sugg\u00e9r\u00e9: ${result.suggestedPrice?.suggested}\u20ac`,
        { inline_keyboard: [
          [{ text: '\u2705 Vendu', callback_data: `sell:${purchaseId}` }],
        ]},
      );
    } catch (error) {
      await this.sendMessage(chatId, `\u274c Erreur: ${escapeHtml(error.message)}`);
    }
  }

  /**
   * "Vendu" button from Achats topic.
   * Asks for sale price then records in Comptabilité.
   */
  async handleMarkSold(chatId, messageId, userId, purchaseId) {
    const purchase = this._purchases?.get(purchaseId);
    if (!purchase) {
      await this.editMessage(chatId, messageId, '\u274c Achat non trouv\u00e9.');
      return;
    }

    // Start conversation to ask for sale price
    this.setConv(userId, {
      type: 'sell_price',
      step: 'price',
      purchaseId,
      chatId,
      messageId,
    });

    await this.editMessage(chatId, messageId, [
      `\u2705 <b>Marquer comme vendu</b>`,
      '',
      `\ud83c\udff7\ufe0f ${escapeHtml(purchase.title)}`,
      `\ud83d\uded2 Achet\u00e9 : ${purchase.totalCost}\u20ac`,
      '',
      `<b>\u00c0 combien l'as-tu vendu ?</b>`,
      `Envoie le prix de vente (ex: <code>35</code>)`,
    ].join('\n'));
  }

  /**
   * Handles text response for sale price entry.
   */
  async handleSellPriceResponse(chatId, userId, text) {
    const conv = this.getConv(userId);
    if (!conv || conv.type !== 'sell_price') return false;

    if (text.toLowerCase() === 'annuler') {
      this.clearConv(userId);
      await this.sendMessage(chatId, '\u274c Annul\u00e9.');
      return true;
    }

    const salePrice = parseFloat(text.replace(',', '.'));
    if (isNaN(salePrice) || salePrice <= 0) {
      await this.sendMessage(chatId, '\u274c Envoie un prix valide (ex: <code>35</code>)');
      return true;
    }

    const purchase = this._purchases?.get(conv.purchaseId);
    if (!purchase) {
      this.clearConv(userId);
      await this.sendMessage(chatId, '\u274c Achat non trouv\u00e9.');
      return true;
    }

    this.clearConv(userId);

    // Calculate profit
    const platformFee = Math.round(salePrice * 0.05 * 100) / 100; // 5% Vinted
    const shippingCost = 3; // Approx
    const netRevenue = Math.round((salePrice - platformFee - shippingCost) * 100) / 100;
    const profit = Math.round((netRevenue - purchase.totalCost) * 100) / 100;
    const marginPercent = purchase.totalCost > 0 ? Math.round(profit / purchase.totalCost * 100) : 0;

    // Update purchase
    purchase.status = 'vendu';
    purchase.salePrice = salePrice;
    purchase.saleDate = new Date().toISOString();
    purchase.profit = profit;

    // Record in sales (for /bilan)
    if (!this._sales) this._sales = [];
    this._sales.push({
      id: `sale-${Date.now()}`,
      description: purchase.title,
      prixVente: salePrice,
      prixAchat: purchase.totalCost,
      fraisPlateforme: platformFee,
      fraisLivraison: shippingCost,
      margeNette: netRevenue,
      profit,
      date: new Date().toISOString(),
      crmItemId: purchase.id,
    });

    // CRM update
    if (this.sniper?.crm) {
      this.sniper.crm.markSold(purchase.itemId, salePrice);
    }

    // Post in Comptabilité topic
    const profitIcon = profit >= 0 ? '\ud83d\udfe2' : '\ud83d\udd34';
    const comptaMsg = [
      `${profitIcon} <b>VENTE ENREGISTR\u00c9E</b>`,
      `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501`,
      '',
      `\ud83c\udff7\ufe0f <b>${escapeHtml(purchase.title)}</b>`,
      '',
      `\ud83d\uded2 Achet\u00e9 : ${purchase.totalCost}\u20ac`,
      `\ud83d\udcb5 Vendu : ${salePrice}\u20ac`,
      `\ud83c\udfed Frais plateforme (5%) : -${platformFee}\u20ac`,
      `\ud83d\udce6 Frais livraison : -${shippingCost}\u20ac`,
      '',
      `${profitIcon} <b>Profit : ${profit >= 0 ? '+' : ''}${profit}\u20ac (${marginPercent}%)</b>`,
      '',
      `\ud83d\udcc5 ${new Date().toLocaleDateString('fr-FR')}`,
    ].join('\n');

    if (purchase.photo) {
      await this.sendPhotoToTopic('compta', purchase.photo, comptaMsg);
    } else {
      await this.sendToTopic('compta', comptaMsg);
    }

    // Running totals
    const totalSales = this._sales.length;
    const totalProfit = this._sales.reduce((s, v) => s + (v.profit || 0), 0);

    // Confirm
    await this.sendMessage(chatId, [
      `\u2705 <b>Vente enregistr\u00e9e !</b>`,
      '',
      `${profitIcon} Profit : ${profit >= 0 ? '+' : ''}${profit}\u20ac`,
      `\ud83d\udcca Cumul : ${totalSales} ventes \u2022 ${totalProfit >= 0 ? '+' : ''}${Math.round(totalProfit)}\u20ac profit total`,
    ].join('\n'));

    return true;
  }

  /**
   * Regenerate a listing from the regen: callback.
   */
  async handleRegenListing(chatId, messageId, encodedInput) {
    try {
      const input = Buffer.from(encodedInput, 'base64').toString('utf-8');
      await this.cmdListing(chatId, input.split(' '), {});
    } catch {
      await this.sendMessage(chatId, '\u274c Utilise /listing directement.');
    }
  }

  async cmdWatchSeller(chatId, args, opts) {
    if (!args.length) {
      await this.sendMessage(chatId, 'Usage: /watch_seller [pseudo]\nExemple: /watch_seller jean_mode75', opts);
      return;
    }
    const username = args[0];
    const sellers = this.config.monitoring?.sellers || [];
    const exists = sellers.some(s => {
      const name = typeof s === 'string' ? s : (s.username || '');
      return name.toLowerCase() === username.toLowerCase();
    });
    if (exists) {
      await this.sendMessage(chatId, `\u26a0\ufe0f <b>${escapeHtml(username)}</b> est d\u00e9j\u00e0 suivi.`, opts);
      return;
    }
    sellers.push({ username, addedAt: new Date().toISOString() });
    if (!this.config.monitoring) this.config.monitoring = { sellers: [] };
    this.config.monitoring.sellers = sellers;
    this.persistConfig();
    await this.sendMessage(chatId, `\u2705 <b>${escapeHtml(username)}</b> ajout\u00e9 \u00e0 la watchlist.`, opts);
  }

  /**
   * /unwatch_seller [username]
   */
  async cmdUnwatchSeller(chatId, args, opts) {
    if (!args.length) {
      await this.sendMessage(chatId, 'Usage: /unwatch_seller [pseudo]', opts);
      return;
    }
    const username = args[0].toLowerCase();
    const sellers = this.config.monitoring?.sellers || [];
    const idx = sellers.findIndex(s => {
      const name = typeof s === 'string' ? s : (s.username || '');
      return name.toLowerCase() === username;
    });
    if (idx === -1) {
      await this.sendMessage(chatId, `\u274c <b>${escapeHtml(args[0])}</b> non trouv\u00e9 dans la watchlist.`, opts);
      return;
    }
    sellers.splice(idx, 1);
    this.persistConfig();
    await this.sendMessage(chatId, `\u2705 <b>${escapeHtml(args[0])}</b> retir\u00e9 de la watchlist.`, opts);
  }

  // ══════════════════════════════════════════
  //  CALLBACK QUERY ROUTING
  // ══════════════════════════════════════════

  /**
   * Routes all inline button callback queries.
   * Always answers the callback first to dismiss the loading spinner.
   */
  async handleCallbackQuery(query) {
    const data = query.data;
    const chatId = query.message?.chat?.id;
    const messageId = query.message?.message_id;
    const userId = query.from?.id;

    if (!data || !chatId) return;

    // Answer callback immediately (fire-and-forget — don't block the handler)
    this.apiCall('answerCallbackQuery', { callback_query_id: query.id }).catch(() => {});

    try {
      // ── Navigation ──
      if (data.startsWith('nav:'))    return await this.handleNav(chatId, messageId, data.slice(4), userId);
      // ── Actions (start/stop/export) ──
      if (data.startsWith('act:'))    return await this.handleAction(chatId, messageId, data.slice(4));
      // ── Filter wizard ──
      if (data.startsWith('fw:'))     return await this.handleFilterWizardCb(chatId, messageId, userId, data.slice(3));
      // ── Filter management ──
      if (data.startsWith('filter:')) return await this.handleFilterCb(chatId, messageId, userId, data.slice(7));
      // ── Autobuy config ──
      if (data.startsWith('ab:'))     return await this.handleAutobuyCb(chatId, messageId, userId, data.slice(3));
      // ── Autobuy rules ──
      if (data.startsWith('rule:'))   return await this.handleRuleCb(chatId, messageId, userId, data.slice(5));
      // ── Deal config ──
      if (data.startsWith('deal:'))   return await this.handleDealCb(chatId, messageId, data.slice(5));
      // ── Country toggle ──
      if (data.startsWith('country:'))return await this.handleCountryCb(chatId, messageId, data.slice(8));
      // ── Watchlist ──
      if (data.startsWith('unwatch:'))return await this.handleUnwatchCb(chatId, messageId, data.slice(8));
      // ── Buy confirm/cancel ──
      if (data.startsWith('buy_confirm:')) return await this.executeBuy(chatId, data.split(':')[1]);
      if (data.startsWith('buy_cancel:'))  return await this.editMessage(chatId, messageId, '\u274c Achat annul\u00e9.');
      // ── Purchase tracking: "J'ai acheté" button ──
      if (data.startsWith('bought:'))      return await this.handleBought(chatId, messageId, userId, data.slice(7));
      // ── Post-purchase: "Créer annonce" from Achats topic ──
      if (data.startsWith('mkl:'))         return await this.handleMakeListing(chatId, messageId, data.slice(4));
      // ── Post-purchase: "Vendu" from Achats topic ──
      if (data.startsWith('sell:'))        return await this.handleMarkSold(chatId, messageId, userId, data.slice(5));
      // ── Regenerate listing ──
      if (data.startsWith('regen:'))       return await this.handleRegenListing(chatId, messageId, data.slice(6));

    } catch (error) {
      log.error(`Erreur callback "${data}": ${error.message}`);
    }
  }

  // ══════════════════════════════════════════
  //  NAVIGATION (edit message in-place)
  // ══════════════════════════════════════════

  /**
   * Handles nav:* callbacks — edits the current message to show a sub-menu.
   */
  async handleNav(chatId, messageId, section, userId) {
    switch (section) {
      case 'main': {
        const msg = formatMainMenu(this.sniper, this.config);
        await this.editMessage(chatId, messageId, msg.text, msg.reply_markup);
        break;
      }
      case 'filters': {
        const allQueries = this.sniper?.queries ?? [];
        const groupQueries = this._getQueriesForGroup(allQueries, chatId);
        const msg = formatFilters(groupQueries, { withBack: true });
        await this.editMessage(chatId, messageId, msg.text, msg.reply_markup);
        break;
      }
      case 'autobuy': {
        const msg = formatAutobuyMenu(this.config.autobuy || {}, { withBack: true });
        await this.editMessage(chatId, messageId, msg.text, msg.reply_markup);
        break;
      }
      case 'rules': {
        const rules = this.config.autobuy?.rules || [];
        const msg = formatAutobuyRules(rules, { withBack: true });
        await this.editMessage(chatId, messageId, msg.text, msg.reply_markup);
        break;
      }
      case 'deals': {
        const topDeals = this.sniper?.dealScorer?.stats?.topDeals?.slice(0, 5) ?? [];
        const msg = formatTopDeals(topDeals, { withBack: true });
        await this.editMessage(chatId, messageId, msg.text, msg.reply_markup);
        break;
      }
      case 'stats': {
        const stats = this.gatherStats();
        const msg = formatStats(stats, { withBack: true });
        await this.editMessage(chatId, messageId, msg.text, msg.reply_markup);
        break;
      }
      case 'config': {
        const msg = formatConfigMenu(this.config, { withBack: true });
        await this.editMessage(chatId, messageId, msg.text, msg.reply_markup);
        break;
      }
      case 'countries': {
        const msg = formatCountries(this.config.countries || [], { withBack: true });
        await this.editMessage(chatId, messageId, msg.text, msg.reply_markup);
        break;
      }
      case 'sessions': {
        const sessionStats = this.sniper?.sessionPool?.getStats() ?? {};
        const msg = formatSessions(sessionStats, { withBack: true });
        await this.editMessage(chatId, messageId, msg.text, msg.reply_markup);
        break;
      }
      case 'watchlist': {
        const sellers = this.config.monitoring?.sellers ?? [];
        const msg = formatWatchlist(sellers, { withBack: true });
        await this.editMessage(chatId, messageId, msg.text, msg.reply_markup);
        break;
      }
      case 'listings': {
        const text = [
          '\ud83c\udff7\ufe0f <b>MISE EN VENTE</b>',
          '',
          'G\u00e9n\u00e8re une annonce Vinted optimis\u00e9e SEO',
          '\u00e0 partir d\'une description courte.',
          '',
          '\ud83d\udcdd <b>Commandes :</b>',
          '',
          '<code>/listing jogging nike gris M</code>',
          '\u2192 G\u00e9n\u00e8re titre + description + prix + tags',
          '',
          '<code>/vendu jogging nike 25</code>',
          '\u2192 Enregistre une vente dans la compta',
          '',
          '\ud83d\udca1 70+ marques \u2022 30+ types \u2022 20+ couleurs',
        ].join('\n');
        await this.editMessage(chatId, messageId, text, {
          inline_keyboard: [
            [{ text: '\ud83c\udff7\ufe0f Cr\u00e9er une annonce', callback_data: 'act:listing_help' }],
            [{ text: '\u21a9\ufe0f Menu', callback_data: 'nav:main' }],
          ],
        });
        break;
      }
      case 'compta': {
        // Show bilan inline
        const sales = this._sales || [];
        const totalCA = sales.reduce((s, v) => s + v.prixVente, 0);
        const totalMarges = sales.reduce((s, v) => s + v.margeNette, 0);
        const totalProfits = sales.filter(v => v.profit !== null).reduce((s, v) => s + v.profit, 0);
        const text = [
          '\ud83d\udcb0 <b>COMPTABILIT\u00c9</b>',
          '',
          `\ud83d\udcca ${sales.length} vente${sales.length !== 1 ? 's' : ''} enregistr\u00e9e${sales.length !== 1 ? 's' : ''}`,
          `\ud83d\udcb5 CA : ${Math.round(totalCA)}\u20ac`,
          `\ud83d\udcb0 Marge : ${Math.round(totalMarges)}\u20ac`,
          sales.some(v => v.profit !== null) ? `${totalProfits >= 0 ? '\ud83d\udfe2' : '\ud83d\udd34'} Profit : ${totalProfits >= 0 ? '+' : ''}${Math.round(totalProfits)}\u20ac` : '',
          '',
          '\ud83d\udcdd <b>Commandes :</b>',
          '<code>/vendu [article] [prix]</code> \u2014 Enregistrer une vente',
          '<code>/bilan</code> \u2014 Bilan complet',
        ].filter(Boolean).join('\n');
        await this.editMessage(chatId, messageId, text, {
          inline_keyboard: [
            [{ text: '\ud83d\udcca Bilan complet', callback_data: 'act:bilan' }],
            [{ text: '\u21a9\ufe0f Menu', callback_data: 'nav:main' }],
          ],
        });
        break;
      }
      case 'dealconfig': {
        const thresholds = this.sniper?.dealScorer?.getThresholds() ?? {
          labels: [[90, 'PEPITE'], [75, 'Super deal'], [60, 'Bon prix'], [45, 'Prix correct'], [30, 'Au-dessus'], [0, 'Cher']],
          minSamplesForScore: 3,
        };
        const msg = formatDealConfig(thresholds, { withBack: true });
        await this.editMessage(chatId, messageId, msg.text, msg.reply_markup);
        break;
      }
    }
  }

  // ══════════════════════════════════════════
  //  ACTIONS (start/stop/export)
  // ══════════════════════════════════════════

  /**
   * Handles act:* callbacks for bot start/stop and export.
   */
  async handleAction(chatId, messageId, action) {
    const backBtn = { text: '\u21a9\ufe0f Menu', callback_data: 'nav:main' };

    switch (action) {
      case 'start': {
        if (this.sniper?.running) {
          await this.editMessage(chatId, messageId, '\u26a0\ufe0f Le bot tourne d\u00e9j\u00e0.', { inline_keyboard: [[backBtn]] });
        } else if (!this.sniper?.queries?.length) {
          await this.editMessage(chatId, messageId, '\u26a0\ufe0f Ajoute d\'abord un filtre !', { inline_keyboard: [
            [{ text: '\u2795 Nouveau filtre', callback_data: 'filter:new' }],
            [backBtn],
          ]});
        } else {
          this.sniper.startBot();
          await this.editMessage(chatId, messageId, `\ud83d\ude80 <b>Bot lanc\u00e9 !</b>\n${this.sniper.queries.length} filtre(s) actif(s)`, { inline_keyboard: [[backBtn]] });
          await this.sendToTopic('feed', '\ud83d\ude80 <b>Scraping d\u00e9marr\u00e9</b> via Telegram.');
        }
        break;
      }
      case 'stop': {
        if (!this.sniper?.running) {
          await this.editMessage(chatId, messageId, '\u26a0\ufe0f Le bot est d\u00e9j\u00e0 arr\u00eat\u00e9.', { inline_keyboard: [[backBtn]] });
        } else {
          await this.sniper.stopBot();
          await this.editMessage(chatId, messageId, '\u23f8\ufe0f <b>Bot arr\u00eat\u00e9.</b>', { inline_keyboard: [[backBtn]] });
          await this.sendToTopic('feed', '\u23f8\ufe0f <b>Scraping arr\u00eat\u00e9</b> via Telegram.');
        }
        break;
      }
      case 'listing_help': {
        const helpText = [
          '\ud83c\udff7\ufe0f <b>COMMENT CR\u00c9ER UNE ANNONCE</b>',
          '',
          'Tape directement dans ce chat :',
          '',
          '<code>/listing jogging nike gris M</code>',
          '<code>/listing air max 90 blanc 42 neuf</code>',
          '<code>/listing doudoune north face noire L</code>',
          '',
          'Le bot g\u00e9n\u00e8re automatiquement :',
          '\u2022 \ud83d\udccc Titre SEO optimis\u00e9',
          '\u2022 \ud83d\udcdd Description compl\u00e8te avec emojis',
          '\u2022 \ud83d\udcb0 Prix sugg\u00e9r\u00e9 (fourchette)',
          '\u2022 \ud83c\udff7 Tags pour la visibilit\u00e9',
          '\u2022 \ud83d\udca1 Conseils photo et publication',
        ].join('\n');
        await this.editMessage(chatId, messageId, helpText, { inline_keyboard: [[backBtn]] });
        break;
      }
      case 'bilan': {
        // Send full bilan as new message in compta topic
        await this.cmdBilan(chatId, {});
        await this.editMessage(chatId, messageId, '\ud83d\udcca Bilan envoy\u00e9 dans le topic Comptabilit\u00e9', { inline_keyboard: [[backBtn]] });
        break;
      }
      case 'turbo_on': {
        if (!this.sniper) {
          await this.editMessage(chatId, messageId, '\u274c Bot non initialis\u00e9.', { inline_keyboard: [[backBtn]] });
          break;
        }
        if (this.sniper.turboPoller?.running) {
          await this.editMessage(chatId, messageId, this._formatTurboMsg(true), this._turboKeyboard(true));
          break;
        }
        // Enable turbo: build tasks and start the TurboPoller
        try {
          const { TurboPoller } = await import('../scraper/turbo-poller.js');
          const { config: cfg } = await import('../config.js');

          const tasks = [];
          for (const country of cfg.countries) {
            for (const query of (this.sniper.queries || [])) {
              tasks.push({ country, query });
            }
          }
          if (tasks.length === 0) {
            await this.editMessage(chatId, messageId, '\u26a0\ufe0f Ajoute d\'abord des filtres avant d\'activer le turbo.', { inline_keyboard: [[backBtn]] });
            break;
          }

          const turboConf = cfg.scraper.turbo || {};
          this.sniper.turboPoller = new TurboPoller(this.sniper.search, {
            concurrency: cfg.scraper.concurrentQueries || 15,
            workerDelayMs: turboConf.workerDelayMs || 200,
            staggerMs: turboConf.staggerMs || 50,
            onNewItems: async (newItems, country) => {
              await this.sniper._processNewItems(newItems, country);
            },
          });
          this.sniper.turboPoller.start(tasks);

          await this.editMessage(chatId, messageId, [
            '\u26a1 <b>TURBO ACTIV\u00c9 !</b>',
            '',
            `\ud83d\udee0\ufe0f ${tasks.length} t\u00e2ches lanc\u00e9es`,
            `\ud83d\udce1 ${Math.min(tasks.length, cfg.scraper.concurrentQueries || 15)} workers parall\u00e8les`,
            `\u23f1\ufe0f D\u00e9lai : ${turboConf.workerDelayMs || 200}ms`,
          ].join('\n'), this._turboKeyboard(true));

          await this.sendToTopic('feed', '\u26a1 <b>Mode Turbo activ\u00e9</b> — polling ultra-rapide');
        } catch (e) {
          await this.editMessage(chatId, messageId, `\u274c Erreur: ${escapeHtml(e.message)}`, { inline_keyboard: [[backBtn]] });
        }
        break;
      }
      case 'turbo_off': {
        if (!this.sniper?.turboPoller?.running) {
          await this.editMessage(chatId, messageId, this._formatTurboMsg(false), this._turboKeyboard(false));
          break;
        }
        const stats = this.sniper.turboPoller.getStats();
        await this.sniper.turboPoller.stop();
        this.sniper.turboPoller = null;

        await this.editMessage(chatId, messageId, [
          '\u23f8\ufe0f <b>TURBO D\u00c9SACTIV\u00c9</b>',
          '',
          `Session : ${stats.totalPolls} polls, ${stats.totalItems} items d\u00e9tect\u00e9s`,
          '',
          'Retour au mode standard (polling par cycles).',
        ].join('\n'), this._turboKeyboard(false));

        await this.sendToTopic('feed', '\u23f8\ufe0f <b>Mode Turbo d\u00e9sactiv\u00e9</b> — retour polling standard');
        break;
      }
      case 'turbo_refresh': {
        const isActive = !!this.sniper?.turboPoller?.running;
        await this.editMessage(chatId, messageId, this._formatTurboMsg(isActive), this._turboKeyboard(isActive));
        break;
      }
      case 'export_json':
      case 'export_csv': {
        const format = action.split('_')[1];
        if (this.sniper?.exporter) {
          try {
            const result = this.sniper.exporter.exportAll(format);
            await this.editMessage(chatId, messageId, `\u2705 Export ${format.toUpperCase()}: <code>${result?.path || 'exports/'}</code>`, { inline_keyboard: [[backBtn]] });
          } catch (e) {
            await this.editMessage(chatId, messageId, `\u274c Erreur export: ${escapeHtml(e.message)}`, { inline_keyboard: [[backBtn]] });
          }
        } else {
          await this.editMessage(chatId, messageId, '\u274c Module export non disponible.', { inline_keyboard: [[backBtn]] });
        }
        break;
      }
    }
  }

  // ══════════════════════════════════════════
  //  FILTER MANAGEMENT (list/delete)
  // ══════════════════════════════════════════

  /**
   * Handles filter:* callbacks (new, del).
   */
  async handleFilterCb(chatId, messageId, userId, action) {
    if (action === 'new') {
      // Start the filter creation wizard
      return await this.startFilterWizard(chatId, messageId, userId);
    }

    if (action.startsWith('del:')) {
      const groupIdx = parseInt(action.split(':')[1], 10);
      const allQueries = this.sniper?.queries;
      if (allQueries) {
        // Map group-local index to global index
        const globalIdx = this._groupIndexToGlobal(allQueries, chatId, groupIdx);
        if (globalIdx >= 0) {
          allQueries.splice(globalIdx, 1);
          this.persistQueries();
        }
      }
      const groupQueries = this._getQueriesForGroup(allQueries || [], chatId);
      const msg = formatFilters(groupQueries, { withBack: true });
      await this.editMessage(chatId, messageId, msg.text, msg.reply_markup);
    }
  }

  /**
   * Returns only queries belonging to a specific group.
   */
  _getQueriesForGroup(queries, chatId) {
    const cid = String(chatId);
    return queries.filter(q => {
      // Queries without _chatId belong to admin group (backward compat)
      if (!q._chatId) return cid === String(this.chatId);
      return String(q._chatId) === cid;
    });
  }

  /**
   * Maps a group-local query index to the global queries array index.
   */
  _groupIndexToGlobal(allQueries, chatId, groupIdx) {
    const cid = String(chatId);
    let count = 0;
    for (let i = 0; i < allQueries.length; i++) {
      const q = allQueries[i];
      const belongs = q._chatId ? String(q._chatId) === cid : cid === String(this.chatId);
      if (belongs) {
        if (count === groupIdx) return i;
        count++;
      }
    }
    return -1;
  }

  // ══════════════════════════════════════════
  //  FILTER CREATION WIZARD
  // ══════════════════════════════════════════

  /**
   * Starts the filter wizard from step 1 (gender selection).
   * Edits the current message to show the wizard.
   */
  async startFilterWizard(chatId, messageId, userId) {
    const data = {
      // Selected IDs
      genderId: null,
      categoryIds: [],
      brandIds: [],
      sizeIds: [],
      colorIds: [],
      conditionIds: [],
      priceFrom: null,
      priceTo: null,
      text: null,
      // Labels for display
      genderLabel: null,
      genderIcon: null,
      categoryLabels: [],
      brandLabels: [],
      sizeLabels: [],
      colorLabels: [],
      conditionLabels: [],
      lastBrandSearch: null,
    };

    this.setConv(userId, {
      command: 'filter_wizard',
      step: 'gender',
      data,
      messageId,
      chatId,
    });

    await this.renderFilterStep(chatId, messageId, userId);
  }

  /**
   * Renders the current step of the filter wizard.
   * This is the core wizard renderer — called after every interaction.
   */
  async renderFilterStep(chatId, messageId, userId) {
    const conv = this.getConv(userId);
    if (!conv || conv.command !== 'filter_wizard') return;

    const { step, data } = conv;
    const stepNum = FILTER_STEPS.indexOf(step) + 1;

    switch (step) {
      // ── STEP 1: Gender ──
      case 'gender': {
        const buttons = GENDERS.map(g => [{ text: `${g.icon} ${g.label}`, callback_data: `fw:g:${g.id}` }]);
        buttons.push([{ text: '\u23ed Passer', callback_data: 'fw:g:0' }]);

        const msg = formatFilterWizard(data, step, stepNum, FILTER_TOTAL, {
          buttons,
          prompt: '<b>\u00c9tape 1</b> \u2014 Choisis le genre :',
        });
        await this.editMessage(chatId, messageId, msg.text, msg.reply_markup);
        break;
      }

      // ── STEP 2: Categories (drill-down + toggle multi-select) ──
      case 'categories': {
        const genderId = data.genderId;
        const cats = genderId ? (CATEGORIES[genderId] || []) : [];
        const parentView = data._catParent || null; // which parent are we drilling into?

        let shown;
        let prompt;

        if (parentView) {
          // Show children of selected parent
          const parent = cats.find(c => c.id === parentView);
          shown = parent?.children || [];
          prompt = `<b>Étape 2</b> — Sous-catégories de <b>${parent?.label || ''}</b> :`;
        } else {
          // Show top-level categories (parents only)
          shown = cats;
          prompt = '<b>Étape 2</b> — Catégorie (clique pour détailler ou sélectionne directement) :';
        }

        const buttons = [];
        for (let i = 0; i < shown.length; i += 2) {
          const row = shown.slice(i, i + 2).map(c => {
            const selected = data.categoryIds.includes(c.id);
            const hasChildren = !parentView && c.children && c.children.length > 0;
            const label = `${selected ? '✅ ' : ''}${c.icon || '📦'} ${c.label}`;
            // If parent with children and NOT yet selected → drill down
            // If already selected → toggle off
            // If no children → toggle select
            return {
              text: hasChildren && !selected ? `${c.icon || '📦'} ${c.label} ▸` : label,
              callback_data: hasChildren && !selected ? `fw:catd:${c.id}` : `fw:cat:${c.id}`,
            };
          });
          buttons.push(row);
        }

        // Footer buttons
        const footer = [];
        if (parentView) {
          footer.push({ text: '↩️ Retour catégories', callback_data: 'fw:catd:back' });
        }
        footer.push({ text: '✅ Valider ▶️', callback_data: 'fw:cat:done' });
        if (!parentView) footer.push({ text: '⏭ Passer', callback_data: 'fw:cat:skip' });
        buttons.push(footer);

        // Show selected count
        if (data.categoryIds.length > 0) {
          prompt += `\n\n✅ <b>${data.categoryLabels.join(', ')}</b>`;
        }

        const msg = formatFilterWizard(data, step, stepNum, FILTER_TOTAL, {
          buttons,
          prompt,
        });
        await this.editMessage(chatId, messageId, msg.text, msg.reply_markup);
        break;
      }

      // ── STEP 3: Brands (popular + search) ──
      case 'brands': {
        const buttons = [];
        for (let i = 0; i < POPULAR_BRANDS.length; i += 3) {
          const row = POPULAR_BRANDS.slice(i, i + 3).map(b => {
            const selected = data.brandIds.includes(b.id);
            return { text: `${selected ? '✅ ' : ''}${b.label}`, callback_data: `fw:br:${b.id}` };
          });
          buttons.push(row);
        }
        buttons.push([
          { text: '🔍 Chercher une marque', callback_data: 'fw:br:search' },
        ]);
        buttons.push([
          { text: '↩️ Retour', callback_data: 'fw:back' },
          { text: '✅ Valider ▶️', callback_data: 'fw:br:done' },
          { text: '⏭ Passer', callback_data: 'fw:br:skip' },
        ]);

        let brandPrompt = '<b>Étape 3</b> — Marques (multi-sélection) :';
        if (data.brandIds.length > 0) {
          brandPrompt += `\n\n✅ <b>Sélectionnées (${data.brandIds.length}) : ${data.brandLabels.join(', ')}</b>`;
        }
        brandPrompt += '\n\n💡 Utilise 🔍 pour chercher parmi toutes les marques Vinted.';
        const msg = formatFilterWizard(data, step, stepNum, FILTER_TOTAL, {
          buttons,
          prompt: brandPrompt,
        });
        await this.editMessage(chatId, messageId, msg.text, msg.reply_markup);
        break;
      }

      // ── STEP 4: Sizes ──
      case 'sizes': {
        // Determine which sizes to show based on selected categories
        let sizeGroup = 'clothing';
        if (data.categoryIds.length > 0) {
          sizeGroup = getSizeGroup(data.categoryIds[0]);
        }

        let sizeOptions;
        if (sizeGroup === 'shoes') {
          // Determine men/women shoes
          sizeOptions = (data.genderId === 1904) ? SIZES.shoes_women : SIZES.shoes_men;
        } else if (sizeGroup === 'jeans') {
          sizeOptions = SIZES.jeans;
        } else {
          sizeOptions = SIZES.clothing;
        }

        const buttons = [];
        for (let i = 0; i < sizeOptions.length; i += 4) {
          const row = sizeOptions.slice(i, i + 4).map(s => {
            const selected = data.sizeIds.includes(s.id);
            return { text: `${selected ? '\u2705 ' : ''}${s.label}`, callback_data: `fw:sz:${s.id}` };
          });
          buttons.push(row);
        }
        buttons.push([
          { text: '↩️ Retour', callback_data: 'fw:back' },
          { text: '✅ Valider ▶️', callback_data: 'fw:sz:done' },
          { text: '⏭ Passer', callback_data: 'fw:sz:skip' },
        ]);

        let sizePrompt = '<b>Étape 4</b> — Tailles (multi-sélection) :';
        if (data.sizeIds.length > 0) {
          sizePrompt += `\n\n✅ <b>${data.sizeLabels.join(', ')}</b>`;
        }
        const msg = formatFilterWizard(data, step, stepNum, FILTER_TOTAL, {
          buttons,
          prompt: sizePrompt,
        });
        await this.editMessage(chatId, messageId, msg.text, msg.reply_markup);
        break;
      }

      // ── STEP 5: Colors ──
      case 'colors': {
        const buttons = [];
        for (let i = 0; i < COLORS.length; i += 3) {
          const row = COLORS.slice(i, i + 3).map(c => {
            const selected = data.colorIds.includes(c.id);
            return { text: `${selected ? '✅ ' : ''}${c.label}`, callback_data: `fw:cl:${c.id}` };
          });
          buttons.push(row);
        }
        buttons.push([
          { text: '↩️ Retour', callback_data: 'fw:back' },
          { text: '✅ Valider ▶️', callback_data: 'fw:cl:done' },
          { text: '⏭ Passer (toutes)', callback_data: 'fw:cl:skip' },
        ]);

        let colorPrompt = '<b>Étape 5</b> — Couleurs (multi-sélection) :\n<i>Passer = toutes les couleurs</i>';
        if (data.colorIds.length > 0) {
          colorPrompt += `\n\n✅ <b>${data.colorLabels.join(', ')}</b>`;
        }
        const msg = formatFilterWizard(data, step, stepNum, FILTER_TOTAL, {
          buttons,
          prompt: colorPrompt,
        });
        await this.editMessage(chatId, messageId, msg.text, msg.reply_markup);
        break;
      }

      // ── STEP 6: Conditions ──
      case 'conditions': {
        const buttons = [];
        const condRow = CONDITIONS.map(c => {
          const selected = data.conditionIds.includes(c.id);
          return { text: `${selected ? '\u2705 ' : ''}${c.icon} ${c.short}`, callback_data: `fw:co:${c.id}` };
        });
        // Split into rows of 3
        for (let i = 0; i < condRow.length; i += 3) {
          buttons.push(condRow.slice(i, i + 3));
        }
        buttons.push([
          { text: '↩️ Retour', callback_data: 'fw:back' },
          { text: '✅ Valider ▶️', callback_data: 'fw:co:done' },
          { text: '⏭ Passer', callback_data: 'fw:co:skip' },
        ]);

        let condPrompt = '<b>Étape 6</b> — État (multi-sélection) :';
        if (data.conditionIds.length > 0) {
          condPrompt += `\n\n✅ <b>${data.conditionLabels.join(', ')}</b>`;
        }
        const msg = formatFilterWizard(data, step, stepNum, FILTER_TOTAL, {
          buttons,
          prompt: condPrompt,
        });
        await this.editMessage(chatId, messageId, msg.text, msg.reply_markup);
        break;
      }

      // ── STEP 7: Price ──
      case 'price': {
        const buttons = [
          [
            { text: '< 10\u20ac', callback_data: 'fw:pr:10' },
            { text: '< 20\u20ac', callback_data: 'fw:pr:20' },
            { text: '< 50\u20ac', callback_data: 'fw:pr:50' },
            { text: '< 100\u20ac', callback_data: 'fw:pr:100' },
          ],
          [
            { text: '< 200\u20ac', callback_data: 'fw:pr:200' },
            { text: '< 500\u20ac', callback_data: 'fw:pr:500' },
            { text: '\u270f\ufe0f Custom', callback_data: 'fw:pr:custom' },
          ],
          [
            { text: '↩️ Retour', callback_data: 'fw:back' },
            { text: '⏭ Passer', callback_data: 'fw:pr:skip' },
          ],
        ];

        const msg = formatFilterWizard(data, step, stepNum, FILTER_TOTAL, {
          buttons,
          prompt: '<b>\u00c9tape 7</b> \u2014 Prix maximum :',
        });
        await this.editMessage(chatId, messageId, msg.text, msg.reply_markup);
        break;
      }

      // ── STEP 8: Keywords ──
      case 'keywords': {
        const buttons = [
          [{ text: '\u23ed Passer', callback_data: 'fw:kw:skip' }],
        ];

        const msg = formatFilterWizard(data, step, stepNum, FILTER_TOTAL, {
          buttons,
          prompt: '<b>\u00c9tape 8</b> \u2014 Mots-cl\u00e9s (optionnel) :\n<i>Tape tes mots-cl\u00e9s ou clique Passer</i>',
        });
        await this.editMessage(chatId, messageId, msg.text, msg.reply_markup);
        break;
      }

      // ── STEP 9: Recap ──
      case 'recap': {
        const msg = formatFilterRecap(data);
        await this.editMessage(chatId, messageId, msg.text, msg.reply_markup);
        break;
      }
    }
  }

  /**
   * Handles fw:* callback queries from the filter wizard.
   */
  async handleFilterWizardCb(chatId, messageId, userId, action) {
    const conv = this.getConv(userId);

    // Cancel
    if (action === 'cancel') {
      this.clearConv(userId);
      await this.editMessage(chatId, messageId, '\u274c Filtre annul\u00e9.', { inline_keyboard: [
        [{ text: '\u21a9\ufe0f Menu', callback_data: 'nav:main' }],
      ]});
      return;
    }

    // Save
    if (action === 'save') {
      return await this.saveFilter(chatId, messageId, userId);
    }

    // Edit (go back to step 1)
    if (action === 'edit') {
      if (conv) {
        conv.step = 'gender';
        this.setConv(userId, conv);
        await this.renderFilterStep(chatId, messageId, userId);
      }
      return;
    }

    // Back to previous step
    if (action === 'back') {
      if (conv) {
        const currentIdx = FILTER_STEPS.indexOf(conv.step);
        if (currentIdx > 0) {
          conv.step = FILTER_STEPS[currentIdx - 1];
          this.setConv(userId, conv);
          await this.renderFilterStep(chatId, messageId, userId);
        }
      }
      return;
    }

    if (!conv || conv.command !== 'filter_wizard') return;
    const { data } = conv;

    // ── Gender selection ──
    if (action.startsWith('g:')) {
      const genderId = parseInt(action.split(':')[1], 10);
      if (genderId > 0) {
        const gender = GENDERS.find(g => g.id === genderId);
        data.genderId = genderId;
        data.genderLabel = gender?.label || '';
        data.genderIcon = gender?.icon || '';
      }
      conv.step = 'categories';
      this.setConv(userId, conv);
      await this.renderFilterStep(chatId, messageId, userId);
      return;
    }

    // ── Category drill-down (parent → children view) ──
    if (action.startsWith('catd:')) {
      const val = action.split(':')[1];
      if (val === 'back') {
        // Go back to parent category view
        data._catParent = null;
      } else {
        const parentId = parseInt(val, 10);
        if (parentId > 0) {
          data._catParent = parentId;
        }
      }
      this.setConv(userId, conv);
      await this.renderFilterStep(chatId, messageId, userId);
      return;
    }

    // ── Category toggle/done/skip ──
    if (action.startsWith('cat:')) {
      const val = action.split(':')[1];
      if (val === 'done' || val === 'skip') {
        data._catParent = null; // clean up drill state
        conv.step = 'brands';
        this.setConv(userId, conv);
        await this.renderFilterStep(chatId, messageId, userId);
        return;
      }
      const catId = parseInt(val, 10);
      if (catId > 0) {
        // Toggle
        const idx = data.categoryIds.indexOf(catId);
        if (idx >= 0) {
          data.categoryIds.splice(idx, 1);
          data.categoryLabels.splice(idx, 1);
        } else {
          data.categoryIds.push(catId);
          const label = this.findCategoryLabel(data.genderId, catId);
          data.categoryLabels.push(label);
        }
        this.setConv(userId, conv);
        await this.renderFilterStep(chatId, messageId, userId);
      }
      return;
    }

    // ── Brand toggle/done/skip/search/back ──
    if (action.startsWith('br:')) {
      const val = action.split(':')[1];
      if (val === 'done' || val === 'skip') {
        data.lastBrandSearch = null;
        conv.step = 'sizes';
        this.setConv(userId, conv);
        await this.renderFilterStep(chatId, messageId, userId);
        return;
      }
      if (val === 'search') {
        // Switch to brand search text mode
        data._brandSearch = null; // clear previous search
        this.setConv(userId, { ...conv, command: 'brand_search' });
        await this.editMessage(chatId, messageId,
          `\ud83d\udd0d <b>Recherche de marque</b>\n\nTape le nom de la marque :`,
          { inline_keyboard: [[{ text: '\u274c Annuler', callback_data: 'fw:br:back_popular' }]] }
        );
        return;
      }
      if (val === 'back_popular') {
        // Go back to popular brands view
        data.lastBrandSearch = null;
        conv.command = 'filter_wizard';
        this.setConv(userId, conv);
        await this.renderFilterStep(chatId, messageId, userId);
        return;
      }
      const brandId = parseInt(val, 10);
      if (brandId > 0) {
        const idx = data.brandIds.indexOf(brandId);
        if (idx >= 0) {
          data.brandIds.splice(idx, 1);
          data.brandLabels.splice(idx, 1);
        } else {
          data.brandIds.push(brandId);
          // Find label from search results, popular brands, or catalog
          const allKnown = [
            ...(data.lastBrandSearch || []),
            ...POPULAR_BRANDS,
            ...BRANDS,
          ];
          const brand = allKnown.find(b => b.id === brandId);
          data.brandLabels.push(brand?.label || String(brandId));
        }
        this.setConv(userId, conv);

        // If we're in search results view, re-render search results (not popular brands)
        if (data.lastBrandSearch) {
          await this._renderBrandSearchResults(chatId, messageId, data);
        } else {
          await this.renderFilterStep(chatId, messageId, userId);
        }
      }
      return;
    }

    // ── Size toggle/done/skip ──
    if (action.startsWith('sz:')) {
      const val = action.split(':')[1];
      if (val === 'done' || val === 'skip') {
        conv.step = 'colors';
        this.setConv(userId, conv);
        await this.renderFilterStep(chatId, messageId, userId);
        return;
      }
      const sizeId = parseInt(val, 10);
      if (sizeId > 0) {
        const idx = data.sizeIds.indexOf(sizeId);
        if (idx >= 0) {
          data.sizeIds.splice(idx, 1);
          data.sizeLabels.splice(idx, 1);
        } else {
          data.sizeIds.push(sizeId);
          const allSizes = [...SIZES.clothing, ...SIZES.shoes_men, ...SIZES.shoes_women, ...SIZES.jeans];
          const size = allSizes.find(s => s.id === sizeId);
          data.sizeLabels.push(size?.label || String(sizeId));
        }
        this.setConv(userId, conv);
        await this.renderFilterStep(chatId, messageId, userId);
      }
      return;
    }

    // ── Color toggle/done/skip ──
    if (action.startsWith('cl:')) {
      const val = action.split(':')[1];
      if (val === 'done' || val === 'skip') {
        conv.step = 'conditions';
        this.setConv(userId, conv);
        await this.renderFilterStep(chatId, messageId, userId);
        return;
      }
      const colorId = parseInt(val, 10);
      if (colorId > 0) {
        const idx = data.colorIds.indexOf(colorId);
        if (idx >= 0) {
          data.colorIds.splice(idx, 1);
          data.colorLabels.splice(idx, 1);
        } else {
          data.colorIds.push(colorId);
          const color = COLORS.find(c => c.id === colorId);
          data.colorLabels.push(color?.label || String(colorId));
        }
        this.setConv(userId, conv);
        await this.renderFilterStep(chatId, messageId, userId);
      }
      return;
    }

    // ── Condition toggle/done/skip ──
    if (action.startsWith('co:')) {
      const val = action.split(':')[1];
      if (val === 'done' || val === 'skip') {
        conv.step = 'price';
        this.setConv(userId, conv);
        await this.renderFilterStep(chatId, messageId, userId);
        return;
      }
      const condId = parseInt(val, 10);
      if (condId > 0) {
        const idx = data.conditionIds.indexOf(condId);
        if (idx >= 0) {
          data.conditionIds.splice(idx, 1);
          data.conditionLabels.splice(idx, 1);
        } else {
          data.conditionIds.push(condId);
          const cond = CONDITIONS.find(c => c.id === condId);
          data.conditionLabels.push(cond?.short || String(condId));
        }
        this.setConv(userId, conv);
        await this.renderFilterStep(chatId, messageId, userId);
      }
      return;
    }

    // ── Price preset/custom/skip ──
    if (action.startsWith('pr:')) {
      const val = action.split(':')[1];
      if (val === 'skip') {
        conv.step = 'keywords';
        this.setConv(userId, conv);
        await this.renderFilterStep(chatId, messageId, userId);
        return;
      }
      if (val === 'custom') {
        // Ask for custom price via text input
        conv.step = 'price_input';
        this.setConv(userId, conv);
        await this.editMessage(chatId, messageId,
          `\ud83d\udcb0 <b>Prix personnalis\u00e9</b>\n\nTape le prix max en \u20ac (ou min-max, ex: <code>5-50</code>) :`,
          { inline_keyboard: [[{ text: '\u274c Annuler', callback_data: 'fw:pr:skip' }]] }
        );
        return;
      }
      // Preset price
      const price = parseInt(val, 10);
      if (price > 0) {
        data.priceTo = price;
        conv.step = 'keywords';
        this.setConv(userId, conv);
        await this.renderFilterStep(chatId, messageId, userId);
      }
      return;
    }

    // ── Keywords skip ──
    if (action.startsWith('kw:')) {
      const val = action.split(':')[1];
      if (val === 'skip') {
        conv.step = 'recap';
        this.setConv(userId, conv);
        await this.renderFilterStep(chatId, messageId, userId);
      }
      return;
    }

  }

  /**
   * Handles text messages during the filter wizard (price input, keywords, brand search).
   */
  async handleFilterWizardText(chatId, userId, text) {
    const conv = this.getConv(userId);
    if (!conv) return;
    const { data, messageId } = conv;

    // Price custom input
    if (conv.step === 'price_input') {
      if (text.includes('-')) {
        const [minStr, maxStr] = text.split('-');
        const min = parseFloat(minStr);
        const max = parseFloat(maxStr);
        if (!isNaN(min)) data.priceFrom = min;
        if (!isNaN(max)) data.priceTo = max;
      } else {
        const price = parseFloat(text);
        if (!isNaN(price) && price > 0) data.priceTo = price;
      }
      conv.step = 'keywords';
      conv.command = 'filter_wizard';
      this.setConv(userId, conv);
      await this.renderFilterStep(chatId, messageId, userId);
      return;
    }

    // Keywords input
    if (conv.step === 'keywords') {
      data.text = text;
      conv.step = 'recap';
      this.setConv(userId, conv);
      await this.renderFilterStep(chatId, messageId, userId);
      return;
    }
  }

  /**
   * Handles text messages during brand search.
   * Uses Vinted API as primary source (reference for brand IDs),
   * falls back to local catalog, and always allows manual add.
   */
  async handleBrandSearchText(chatId, userId, text) {
    const conv = this.getConv(userId);
    if (!conv) return;

    const { data, messageId } = conv;
    const searchText = text.trim();

    // Try Vinted API first (primary source of truth for brand IDs)
    let results = [];
    let apiWorked = false;
    try {
      const client = this.sniper?.search?.client;
      const country = this.sniper?.fullConfig?.countries?.[0] || 'fr';
      if (client) {
        // Try original query first
        let apiResult = await client.request(country, '/catalog/brands', { params: { query: searchText, per_page: 20 } });
        let brands = apiResult?.brands || apiResult;

        // If no results, try normalized query (remove special chars like &)
        if ((!Array.isArray(brands) || brands.length === 0) && /[&\-_.]/.test(searchText)) {
          const normalized = searchText.replace(/[&\-_.]/g, ' ').replace(/\s+/g, ' ').trim();
          apiResult = await client.request(country, '/catalog/brands', { params: { query: normalized, per_page: 20 } });
          brands = apiResult?.brands || apiResult;
        }

        if (Array.isArray(brands) && brands.length > 0) {
          results = brands.map(b => ({ id: b.id, label: b.title || b.name }));
          apiWorked = true;
        }
      } else {
        await this.logToTopic('warn', `Recherche marque "<b>${escapeHtml(searchText)}</b>" — client API Vinted non disponible, fallback local`);
      }
    } catch (e) {
      log.warn('Brand API search failed, falling back to local catalog:', e.message);
      await this.logToTopic('error', `API marque échouée pour "<b>${escapeHtml(searchText)}</b>": ${escapeHtml(e.message)}`);
    }

    // Fallback to local catalog (fuzzy matching)
    if (results.length === 0) {
      results = searchBrands(searchText);
      if (results.length > 0) {
        await this.logToTopic('info', `Marque "<b>${escapeHtml(searchText)}</b>" trouvée via catalogue local: ${results.map(r => r.label).join(', ')}`);
      }
    } else {
      await this.logToTopic('info', `Marque "<b>${escapeHtml(searchText)}</b>" trouvée via API Vinted (${results.length} résultats)`);
    }

    // Store results for re-rendering after toggle
    data.lastBrandSearch = results.slice(0, 12);
    conv.command = 'filter_wizard';
    this.setConv(userId, conv);

    if (results.length === 0) {
      // No results at all — show message but let user retry or go back
      let noResultMsg = `🔍 Aucune marque trouvée pour "<b>${escapeHtml(searchText)}</b>".`;
      if (data.brandIds.length > 0) {
        noResultMsg += `\n\n✅ <b>Sélectionnées : ${data.brandLabels.join(', ')}</b>`;
      }
      noResultMsg += `\n\n💡 Essaie avec un autre mot-clé (ex: "pull bear" au lieu de "pull&bear").`;

      await this.editMessage(chatId, messageId, noResultMsg,
        { inline_keyboard: [
          [{ text: '🔍 Nouvelle recherche', callback_data: 'fw:br:search' }],
          [{ text: '✅ Valider ▶️', callback_data: 'fw:br:done' }],
          [{ text: '↩️ Marques populaires', callback_data: 'fw:br:back_popular' }],
        ]}
      );
      return;
    }

    await this._renderBrandSearchResults(chatId, messageId, data);
  }

  /**
   * Renders brand search results with current selections.
   */
  async _renderBrandSearchResults(chatId, messageId, data) {
    const results = data.lastBrandSearch || [];
    const buttons = [];
    const shown = results.slice(0, 12);
    for (let i = 0; i < shown.length; i += 3) {
      const row = shown.slice(i, i + 3).map(b => {
        const selected = data.brandIds.includes(b.id);
        return { text: `${selected ? '✅ ' : ''}${b.label}`, callback_data: `fw:br:${b.id}` };
      });
      buttons.push(row);
    }

    let header = `🔍 Résultats de recherche :`;
    if (data.brandIds.length > 0) {
      header += `\n\n✅ <b>Sélectionnées (${data.brandIds.length}) : ${data.brandLabels.join(', ')}</b>`;
    }
    header += `\n\n💡 Tu peux sélectionner plusieurs marques, puis chercher d'autres.`;

    buttons.push([
      { text: '🔍 Autre recherche', callback_data: 'fw:br:search' },
    ]);
    buttons.push([
      { text: '✅ Valider ▶️', callback_data: 'fw:br:done' },
      { text: '↩️ Marques populaires', callback_data: 'fw:br:back_popular' },
    ]);

    await this.editMessage(chatId, messageId, header, { inline_keyboard: buttons });
  }

  /**
   * Saves the completed filter and adds it to the sniper queries.
   */
  async saveFilter(chatId, messageId, userId) {
    const conv = this.getConv(userId);
    if (!conv) return;
    const { data } = conv;

    // Build query object
    const query = {};

    if (data.text) query.text = data.text;
    if (data.genderId) query.catalogIds = [String(data.genderId)];
    if (data.categoryIds.length > 0) query.catalogIds = data.categoryIds.map(String);
    if (data.brandIds.length > 0) query.brandIds = data.brandIds.map(String);
    if (data.sizeIds.length > 0) query.sizeIds = data.sizeIds.map(String);
    if (data.colorIds?.length > 0) query.colorIds = data.colorIds.map(String);
    if (data.conditionIds.length > 0) query.statusIds = data.conditionIds.map(String);
    if (data.priceTo) query.priceTo = data.priceTo;
    if (data.priceFrom) query.priceFrom = data.priceFrom;

    // Store display labels
    query._labels = {
      gender: data.genderLabel,
      categories: data.categoryLabels.length > 0 ? data.categoryLabels : undefined,
      brands: data.brandLabels.length > 0 ? data.brandLabels : undefined,
      sizes: data.sizeLabels.length > 0 ? data.sizeLabels : undefined,
      colors: data.colorLabels?.length > 0 ? data.colorLabels : undefined,
      conditions: data.conditionLabels.length > 0 ? data.conditionLabels : undefined,
    };

    // Tag query with the group where the wizard was initiated
    query._chatId = String(conv.chatId);

    // Add to sniper
    if (this.sniper?.queries) {
      this.sniper.queries.push(query);
    }
    this.persistQueries();
    this.clearConv(userId);

    await this.editMessage(chatId, messageId,
      `\u2705 <b>Filtre enregistr\u00e9 !</b>\n\n${buildFilterSummaryText(data)}`,
      { inline_keyboard: [
        [{ text: '\u2795 Autre filtre', callback_data: 'filter:new' }],
        [{ text: '\u21a9\ufe0f Menu', callback_data: 'nav:main' }],
      ]}
    );
  }

  /**
   * Finds a category label by genderId and catId.
   */
  findCategoryLabel(genderId, catId) {
    const cats = genderId ? (CATEGORIES[genderId] || []) : [];
    for (const cat of cats) {
      if (cat.id === catId) return cat.label;
      if (cat.children) {
        const child = cat.children.find(c => c.id === catId);
        if (child) return child.label;
      }
    }
    return String(catId);
  }

  // ══════════════════════════════════════════
  //  AUTOBUY CONFIG
  // ══════════════════════════════════════════

  /**
   * Handles ab:* callbacks for autobuy configuration.
   */
  async handleAutobuyCb(chatId, messageId, userId, action) {
    const cfg = this.config.autobuy || {};

    if (action.startsWith('toggle:')) {
      const val = action.split(':')[1];
      cfg.enabled = val === 'on';
      if (this.sniper?.autoBuyer) this.sniper.autoBuyer.config.enabled = cfg.enabled;
      this.persistConfig();
    }

    if (action.startsWith('dryrun:')) {
      const val = action.split(':')[1];
      cfg.dryRun = val === 'on';
      if (this.sniper?.autoBuyer) this.sniper.autoBuyer.config.dryRun = cfg.dryRun;
      this.persistConfig();
    }

    if (action.startsWith('mode:')) {
      const mode = action.split(':')[1];
      cfg.mode = mode;
      if (this.sniper?.autoBuyer) this.sniper.autoBuyer.config.mode = mode;
      this.persistConfig();
    }

    if (action.startsWith('edit:')) {
      const field = action.split(':')[1];
      const labels = { maxpurchases: 'max achats/jour', maxspend: 'max d\u00e9pense/jour (\u20ac)', cooldown: 'cooldown (en secondes)' };
      this.setConv(userId, { command: 'ab_edit', step: 'input', data: { field } });
      await this.editMessage(chatId, messageId,
        `\u270f\ufe0f Nouvelle valeur pour <b>${labels[field] || field}</b> :`,
        { inline_keyboard: [[{ text: '\u274c Annuler', callback_data: 'nav:autobuy' }]] }
      );
      return;
    }

    // Re-render autobuy menu
    const msg = formatAutobuyMenu(cfg, { withBack: true });
    await this.editMessage(chatId, messageId, msg.text, msg.reply_markup);
  }

  /**
   * Handles text input for autobuy editing (max purchases, max spend, cooldown).
   */
  async handleAutobuyEditText(chatId, userId, text) {
    const conv = this.getConv(userId);
    if (!conv) return;

    const cfg = this.config.autobuy || {};
    const val = parseFloat(text);

    if (isNaN(val) || val < 0) {
      await this.sendMessage(chatId, '\u274c Valeur invalide. Entre un nombre positif.');
      return;
    }

    switch (conv.data.field) {
      case 'maxpurchases': cfg.maxDailyPurchases = Math.round(val); break;
      case 'maxspend': cfg.maxDailySpend = val; break;
      case 'cooldown': cfg.cooldownBetweenBuysMs = Math.round(val * 1000); break;
    }

    this.clearConv(userId);
    this.persistConfig();

    const msg = formatAutobuyMenu(cfg, { withBack: true });
    await this.sendMessage(chatId, `\u2705 Mis \u00e0 jour !\n\n${msg.text}`, {
      reply_markup: JSON.stringify(msg.reply_markup),
    });
  }

  // ══════════════════════════════════════════
  //  AUTOBUY RULES
  // ══════════════════════════════════════════

  /**
   * Handles rule:* callbacks.
   */
  async handleRuleCb(chatId, messageId, userId, action) {
    const rules = this.config.autobuy?.rules || [];

    if (action === 'new') {
      // Start rule creation flow
      this.setConv(userId, {
        command: 'add_rule',
        step: 'name',
        data: { enabled: true },
        messageId,
        chatId,
      });
      await this.editMessage(chatId, messageId,
        `\ud83e\udd16 <b>NOUVELLE R\u00c8GLE</b>\n\n\u00c9tape 1/4 \u2014 Nom de la r\u00e8gle ?\n<i>Ex: "Nike Air Max pas cher"</i>`,
        { inline_keyboard: [[{ text: '\u274c Annuler', callback_data: 'nav:rules' }]] }
      );
      return;
    }

    if (action.startsWith('toggle:')) {
      const idx = parseInt(action.split(':')[1], 10);
      if (rules[idx]) {
        rules[idx].enabled = !rules[idx].enabled;
        if (this.sniper?.autoBuyer) this.sniper.autoBuyer.config.rules = rules;
        this.persistConfig();
      }
    }

    if (action.startsWith('del:')) {
      const idx = parseInt(action.split(':')[1], 10);
      if (idx >= 0 && idx < rules.length) {
        rules.splice(idx, 1);
        if (this.sniper?.autoBuyer) this.sniper.autoBuyer.config.rules = rules;
        this.persistConfig();
      }
    }

    if (action === 'confirm') {
      return await this.saveRule(chatId, messageId, userId);
    }

    if (action === 'cancel') {
      this.clearConv(userId);
    }

    // Re-render rules list
    const msg = formatAutobuyRules(rules, { withBack: true });
    await this.editMessage(chatId, messageId, msg.text, msg.reply_markup);
  }

  /**
   * Handles text messages during rule creation.
   */
  async handleRuleText(chatId, userId, text) {
    const conv = this.getConv(userId);
    if (!conv) return;
    const { data, messageId } = conv;

    switch (conv.step) {
      case 'name': {
        data.name = text;
        conv.step = 'keywords';
        this.setConv(userId, conv);
        await this.editMessage(chatId, messageId,
          `\ud83e\udd16 <b>NOUVELLE R\u00c8GLE</b>\n\n\u2705 Nom: <b>${escapeHtml(text)}</b>\n\n\u00c9tape 2/4 \u2014 Mots-cl\u00e9s ? (s\u00e9par\u00e9s par virgule, ou "skip")`,
          { inline_keyboard: [[{ text: '\u23ed Passer', callback_data: 'rule:keywords:skip' }], [{ text: '\u274c Annuler', callback_data: 'rule:cancel' }]] }
        );
        break;
      }
      case 'keywords': {
        if (text.toLowerCase() !== 'skip') {
          data.keywords = text.split(',').map(k => k.trim()).filter(Boolean);
        }
        conv.step = 'maxprice';
        this.setConv(userId, conv);
        await this.editMessage(chatId, messageId,
          `\ud83e\udd16 <b>NOUVELLE R\u00c8GLE</b>\n\n\u00c9tape 3/4 \u2014 Prix maximum ? (en \u20ac, ou "skip")`,
          { inline_keyboard: [[{ text: '\u23ed Passer', callback_data: 'rule:maxprice:skip' }], [{ text: '\u274c Annuler', callback_data: 'rule:cancel' }]] }
        );
        break;
      }
      case 'maxprice': {
        if (text.toLowerCase() !== 'skip') {
          const p = parseFloat(text);
          if (!isNaN(p) && p > 0) data.maxPrice = p;
        }
        // Show recap
        conv.step = 'confirm';
        this.setConv(userId, conv);
        const summary = formatRuleSummary(data);
        await this.editMessage(chatId, messageId,
          `${summary}\n\nConfirmer cette r\u00e8gle ?`,
          { inline_keyboard: [
            [{ text: '\u2705 Confirmer', callback_data: 'rule:confirm' }, { text: '\u274c Annuler', callback_data: 'rule:cancel' }],
          ]}
        );
        break;
      }
    }
  }

  /**
   * Saves a completed autobuy rule.
   */
  async saveRule(chatId, messageId, userId) {
    const conv = this.getConv(userId);
    if (!conv) return;

    const rule = { ...conv.data };
    this.clearConv(userId);

    if (!this.config.autobuy.rules) this.config.autobuy.rules = [];
    this.config.autobuy.rules.push(rule);
    if (this.sniper?.autoBuyer) this.sniper.autoBuyer.config.rules = this.config.autobuy.rules;
    this.persistConfig();

    const summary = formatRuleSummary(rule);
    await this.editMessage(chatId, messageId,
      `\u2705 <b>R\u00e8gle ajout\u00e9e !</b>\n\n${summary}`,
      { inline_keyboard: [
        [{ text: '\u2795 Autre r\u00e8gle', callback_data: 'rule:new' }],
        [{ text: '\u21a9\ufe0f Retour', callback_data: 'nav:autobuy' }],
      ]}
    );
  }

  // ══════════════════════════════════════════
  //  DEAL CONFIG
  // ══════════════════════════════════════════

  /**
   * Handles deal:* callbacks for deal threshold config.
   */
  async handleDealCb(chatId, messageId, action) {
    if (action === 'noop') return;

    if (action === 'reset') {
      if (this.sniper?.dealScorer) {
        this.sniper.dealScorer.resetThresholds();
      }
    }

    if (action.startsWith('th:')) {
      const parts = action.split(':');
      const idx = parseInt(parts[1], 10);
      const dir = parts[2];
      const scorer = this.sniper?.dealScorer;
      if (scorer) {
        const thresholds = scorer.getThresholds();
        const labels = thresholds.labels;
        if (idx >= 0 && idx < labels.length) {
          const step = 5;
          if (dir === 'up') labels[idx][0] = Math.min(100, labels[idx][0] + step);
          else labels[idx][0] = Math.max(0, labels[idx][0] - step);
          scorer.setThresholds({ labels });
        }
      }
    }

    const thresholds = this.sniper?.dealScorer?.getThresholds() ?? {
      labels: [[90, 'PEPITE'], [75, 'Super deal'], [60, 'Bon prix'], [45, 'Prix correct'], [30, 'Au-dessus'], [0, 'Cher']],
      minSamplesForScore: 3,
    };
    const msg = formatDealConfig(thresholds, { withBack: true });
    await this.editMessage(chatId, messageId, msg.text, msg.reply_markup);
  }

  // ══════════════════════════════════════════
  //  COUNTRY TOGGLE
  // ══════════════════════════════════════════

  /**
   * Handles country:* callbacks.
   */
  async handleCountryCb(chatId, messageId, code) {
    const countries = this.config.countries || [];
    const idx = countries.indexOf(code);

    if (idx >= 0) {
      if (countries.length > 1) countries.splice(idx, 1);
      // Don't allow removing the last country
    } else {
      countries.push(code);
    }

    this.config.countries = countries;
    this.persistConfig();

    const msg = formatCountries(countries, { withBack: true });
    await this.editMessage(chatId, messageId, msg.text, msg.reply_markup);
  }

  // ══════════════════════════════════════════
  //  WATCHLIST
  // ══════════════════════════════════════════

  /**
   * Handles unwatch:* callbacks.
   */
  async handleUnwatchCb(chatId, messageId, idxStr) {
    const idx = parseInt(idxStr, 10);
    const sellers = this.config.monitoring?.sellers || [];
    if (idx >= 0 && idx < sellers.length) {
      sellers.splice(idx, 1);
      this.persistConfig();
    }
    const msg = formatWatchlist(sellers, { withBack: true });
    await this.editMessage(chatId, messageId, msg.text, msg.reply_markup);
  }

  // ══════════════════════════════════════════
  //  BUY EXECUTION
  // ══════════════════════════════════════════

  /**
   * Executes a buy from a callback confirmation.
   */
  async executeBuy(chatId, itemId) {
    if (!this.sniper?.autoBuyer) {
      await this.sendMessage(chatId, '\u274c Module autobuy non disponible.');
      return;
    }

    try {
      const country = this.config.countries[0];
      const result = await this.sniper.autoBuyer.executeBuy(country, itemId);

      if (result.success) {
        await this.sendMessage(chatId,
          `\u2705 <b>Achat effectu\u00e9 !</b>\nTX: <code>${result.transactionId || 'N/A'}</code>`
        );
        await this.sendToTopic('autobuy',
          `\ud83d\udcb3 <b>Achat manuel</b>\nArticle: ${itemId}\nTX: <code>${result.transactionId || 'N/A'}</code>`
        );
      } else {
        await this.sendMessage(chatId, `\u274c Achat \u00e9chou\u00e9: ${escapeHtml(result.reason || 'raison inconnue')}`);
      }
    } catch (error) {
      await this.sendMessage(chatId, `\u274c Erreur: ${escapeHtml(error.message)}`);
    }
  }

  // ══════════════════════════════════════════
  //  TELEGRAM API LAYER
  // ══════════════════════════════════════════

  /**
   * Generic Telegram Bot API call with retry and rate-limit handling.
   */
  async apiCall(method, params = {}, fetchOptions = {}) {
    const url = `${TELEGRAM_API}${this.botToken}/${method}`;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const controller = fetchOptions.signal ? undefined : new AbortController();
        const timeoutId = controller
          ? setTimeout(() => controller.abort(), fetchOptions.timeout || 15000)
          : undefined;

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
          signal: fetchOptions.signal || controller?.signal,
        });

        if (timeoutId) clearTimeout(timeoutId);
        const data = await response.json();

        if (data.ok) return data.result;

        // Rate limited — wait and retry
        if (response.status === 429 && data.parameters?.retry_after) {
          const waitSec = data.parameters.retry_after;
          log.warn(`Rate limited, attente ${waitSec}s (tentative ${attempt}/${maxRetries})`);
          await sleep(waitSec * 1000);
          continue;
        }

        const errMsg = `Telegram API ${method} (${response.status}): ${data.description || 'unknown error'}`;
        if (response.status === 400 || response.status === 403 || response.status === 404) {
          throw new Error(errMsg);
        }

        if (attempt < maxRetries) {
          log.warn(`${errMsg} - retry ${attempt}/${maxRetries}`);
          await sleep(1000 * attempt);
          continue;
        }
        throw new Error(errMsg);
      } catch (error) {
        if (error.name === 'AbortError') throw error;
        if (attempt < maxRetries) {
          log.warn(`API ${method} failed (attempt ${attempt}): ${error.message}`);
          await sleep(1000 * attempt);
          continue;
        }
        throw error;
      }
    }
  }

  // ══════════════════════════════════════════
  //  RATE-LIMITED QUEUE
  // ══════════════════════════════════════════

  /**
   * Enqueues an API call for rate-limited sending (350ms between calls).
   */
  enqueue(method, params) {
    return new Promise((resolve, reject) => {
      this.sendQueue.push({ method, params, resolve, reject });
      this.processQueue();
    });
  }

  /**
   * Processes the send queue with rate limiting.
   * Telegram allows ~30 msg/s to groups, ~1 msg/s to same user.
   * 50ms gap = ~20 msg/s (safe margin).
   */
  async processQueue() {
    if (this.processing) return;
    this.processing = true;

    while (this.sendQueue.length > 0) {
      const { method, params, resolve, reject } = this.sendQueue.shift();
      try {
        const result = await this.apiCall(method, params);
        this.stats.messagesSent++;
        resolve(result);
      } catch (error) {
        this.stats.messagesFailed++;
        // Handle Telegram rate limiting (429)
        if (error.message?.includes('429') || error.message?.includes('Too Many Requests')) {
          const retryAfter = parseInt(error.message.match(/retry after (\d+)/i)?.[1] || '2', 10);
          log.warn(`Rate limited — pause ${retryAfter}s`);
          await sleep(retryAfter * 1000);
          // Re-queue the failed message at the front
          this.sendQueue.unshift({ method, params, resolve, reject });
        } else {
          log.error(`Queue: échec ${method}: ${error.message}`);
          reject(error);
        }
      }
      if (this.sendQueue.length > 0) await sleep(50);
    }

    this.processing = false;
  }

  // ══════════════════════════════════════════
  //  PERSISTENCE
  // ══════════════════════════════════════════

  /**
   * Persists queries to config.json.
   */
  persistQueries() {
    try {
      const configPath = resolve('config.json');
      let fileConfig = {};
      if (existsSync(configPath)) fileConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
      fileConfig.queries = this.sniper?.queries ?? [];
      writeFileSync(configPath, JSON.stringify(fileConfig, null, 2), 'utf-8');
      log.info('Queries sauvegard\u00e9es');
      if (this.sniper?.dashboard?.broadcast) {
        this.sniper.dashboard.broadcast('queries-updated', fileConfig.queries);
      }
    } catch (error) {
      log.error(`Erreur sauvegarde queries: ${error.message}`);
    }
  }

  /**
   * Persists the full config to config.json.
   */
  persistConfig() {
    try {
      const configPath = resolve('config.json');
      let fileConfig = {};
      if (existsSync(configPath)) fileConfig = JSON.parse(readFileSync(configPath, 'utf-8'));

      fileConfig.countries = this.config.countries;
      fileConfig.autobuy = this.config.autobuy;
      fileConfig.monitoring = this.config.monitoring;
      fileConfig.queries = this.sniper?.queries ?? fileConfig.queries ?? [];

      if (!fileConfig.notifications) fileConfig.notifications = {};
      if (!fileConfig.notifications.telegram) fileConfig.notifications.telegram = {};
      fileConfig.notifications.telegram.topicIds = { ...this.topicIds };
      fileConfig.notifications.telegram.groupTopics = { ...this.groupTopics };

      writeFileSync(configPath, JSON.stringify(fileConfig, null, 2), 'utf-8');
      log.debug('Config sauvegardée');

      if (this.sniper?.dashboard?.broadcast) {
        this.sniper.dashboard.broadcast('config-updated', {
          countries: this.config.countries,
          autobuy: this.config.autobuy,
          monitoring: this.config.monitoring,
        });
      }
    } catch (error) {
      log.error(`Erreur sauvegarde config: ${error.message}`);
    }
  }

  // ══════════════════════════════════════════
  //  UTILITIES
  // ══════════════════════════════════════════

  /**
   * Gathers stats from all sniper modules.
   */
  gatherStats() {
    return {
      scraper: {
        pollCycles: this.sniper?.pollCycles ?? 0,
        totalNewItems: this.sniper?.totalNewItems ?? 0,
        seenItems: this.sniper?.search?.seenItems?.size ?? 0,
      },
      sessions: this.sniper?.sessionPool?.getStats() ?? {},
      autobuy: this.sniper?.autoBuyer?.getStats() ?? {},
      deals: this.sniper?.dealScorer?.getStats() ?? {},
      notifications: this.sniper?.notifier?.getStats() ?? {},
    };
  }

  /**
   * Counts active sessions across all countries.
   */
  countActiveSessions() {
    const poolStats = this.sniper?.sessionPool?.getStats();
    if (!poolStats) return 0;
    let total = 0;
    for (const data of Object.values(poolStats)) total += data.alive || 0;
    return total;
  }

  /**
   * Returns internal bot stats.
   */
  getStats() {
    return {
      ...this.stats,
      polling: this.polling,
      topicIds: { ...this.topicIds },
      queueSize: this.sendQueue.length,
      conversations: this.conversations.size,
      uptime: this.stats.startedAt ? Math.round((Date.now() - this.stats.startedAt) / 1000) : 0,
    };
  }
}

// ── Module-level helper (used by saveFilter) ──

/**
 * Builds a flat text summary of filter data for confirmation messages.
 */
function buildFilterSummaryText(data) {
  const lines = [];
  if (data.genderLabel) lines.push(`${data.genderIcon || '\ud83d\udc64'} ${escapeHtml(data.genderLabel)}`);
  if (data.categoryLabels?.length) lines.push(`\ud83d\udce6 ${data.categoryLabels.map(escapeHtml).join(', ')}`);
  if (data.brandLabels?.length) lines.push(`\ud83c\udff7 ${data.brandLabels.map(escapeHtml).join(', ')}`);
  if (data.sizeLabels?.length) lines.push(`\ud83d\udccf ${data.sizeLabels.map(escapeHtml).join(', ')}`);
  if (data.colorLabels?.length) lines.push(`\ud83c\udfa8 ${data.colorLabels.map(escapeHtml).join(', ')}`);
  if (data.conditionLabels?.length) lines.push(`\u2728 ${data.conditionLabels.map(escapeHtml).join(', ')}`);
  if (data.priceTo || data.priceFrom) {
    let p = '\ud83d\udcb0 ';
    if (data.priceFrom && data.priceTo) p += `${data.priceFrom}\u20ac \u2013 ${data.priceTo}\u20ac`;
    else if (data.priceTo) p += `Max ${data.priceTo}\u20ac`;
    else p += `Min ${data.priceFrom}\u20ac`;
    lines.push(p);
  }
  if (data.text) lines.push(`\ud83d\udd0d "${escapeHtml(data.text)}"`);
  return lines.join('\n');
}
