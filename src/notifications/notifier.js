import { gotScraping } from 'got-scraping';
import nodemailer from 'nodemailer';
import { createLogger } from '../utils/logger.js';

const log = createLogger('notifier');

/**
 * Notifier v2 - Multi-channel notification system.
 *
 * Channels: Discord, Slack, Telegram, Email (SMTP), SMS (Twilio),
 *           Desktop, Generic Webhook
 *
 * All channels are optional and independently configured.
 */
export class Notifier {
  constructor(config) {
    this.config = config.notifications;
    this.triggers = this.config.triggers;
    this.emailTransport = null;
    this.notificationLog = [];  // last 100 notifications
    this.stats = { sent: 0, failed: 0, byChannel: {} };

    if (this.config.email.enabled) {
      this.emailTransport = nodemailer.createTransport({
        host: this.config.email.smtp.host,
        port: this.config.email.smtp.port,
        secure: this.config.email.smtp.secure,
        auth: {
          user: this.config.email.smtp.user,
          pass: this.config.email.smtp.pass,
        },
      });
    }
  }

  /**
   * Universal notify method.
   * @param {string} trigger - 'newItem'|'priceDrop'|'sellerNewListing'|'autobuyExecuted'|'autobuyFailed'|'sessionError'|'dailySummary'|'itemSold'
   * @param {Object} payload - { title, description?, item?, seller?, error?, record? }
   */
  async notify(trigger, payload) {
    // Check if this trigger is enabled
    if (this.triggers[trigger] === false) {
      return;
    }

    const notification = {
      trigger,
      ...payload,
      timestamp: new Date().toISOString(),
    };

    this.notificationLog.push(notification);
    if (this.notificationLog.length > 100) this.notificationLog.shift();

    const promises = [];

    if (this.config.discord.enabled) promises.push(this.sendDiscord(notification));
    if (this.config.slack.enabled) promises.push(this.sendSlack(notification));
    // Telegram is handled by TelegramBot (src/telegram/bot.js) with forum topics.
    // Do NOT send from here — it would go to General instead of the proper topic.
    // if (this.config.telegram.enabled) promises.push(this.sendTelegram(notification));
    if (this.config.email.enabled) promises.push(this.sendEmail(notification));
    if (this.config.sms.enabled) promises.push(this.sendSMS(notification));
    if (this.config.desktop.enabled) promises.push(this.sendDesktop(notification));
    if (this.config.webhook.enabled) promises.push(this.sendWebhook(notification));

    const results = await Promise.allSettled(promises);
    results.forEach(r => {
      if (r.status === 'rejected') this.stats.failed++;
    });
  }

  // ── Convenience methods matching common triggers ──

  async notifyNewItem(item) {
    await this.notify('newItem', {
      title: `${item.title} — ${item.price}€`,
      item,
    });
  }

  async notifyBuy(item, record) {
    await this.notify('autobuyExecuted', {
      title: `ACHETÉ: ${item.title} — ${item.price}€`,
      item,
      record,
    });
  }

  async notifyBuyFailed(item, reason) {
    await this.notify('autobuyFailed', {
      title: `Achat échoué: ${item.title}`,
      item,
      error: reason,
    });
  }

  async notifyError(message, details = {}) {
    await this.notify('sessionError', {
      title: `Erreur: ${message}`,
      error: details,
    });
  }

  // ── Discord ──

  async sendDiscord(n) {
    try {
      const color = {
        newItem: 0x0099ff,
        priceDrop: 0xff9900,
        sellerNewListing: 0x9b59b6,
        autobuyExecuted: 0x00ff00,
        autobuyFailed: 0xff4444,
        sessionError: 0xff0000,
        dailySummary: 0x95a5a6,
        itemSold: 0x607d8b,
      }[n.trigger] || 0x0099ff;

      const mention = this.config.discord.mentionUserId
        ? `<@${this.config.discord.mentionUserId}> `
        : this.config.discord.mentionRoleId
          ? `<@&${this.config.discord.mentionRoleId}> `
          : '';

      const embed = {
        title: n.title?.slice(0, 256),
        color,
        timestamp: n.timestamp,
        footer: { text: `Vinted Sniper | ${n.trigger}` },
      };

      if (n.item) {
        const fields = [];
        if (n.item.price) fields.push({ name: 'Prix', value: `${n.item.price}€`, inline: true });
        if (n.item.previousPrice) fields.push({ name: 'Ancien prix', value: `${n.item.previousPrice}€`, inline: true });
        if (n.item.brand) fields.push({ name: 'Marque', value: n.item.brand, inline: true });
        if (n.item.size) fields.push({ name: 'Taille', value: n.item.size, inline: true });
        if (n.item.condition) fields.push({ name: 'État', value: n.item.condition, inline: true });
        if (n.item.seller?.login) fields.push({ name: 'Vendeur', value: n.item.seller.login, inline: true });
        if (n.item.seller?.rating) fields.push({ name: 'Note', value: `${n.item.seller.rating}⭐ (${n.item.seller.reviewCount || 0})`, inline: true });
        if (n.item.dropPercent) fields.push({ name: 'Baisse', value: `-${n.item.dropPercent}%`, inline: true });
        embed.fields = fields;
        if (n.item.url) embed.url = n.item.url;
        if (n.item.photo) embed.thumbnail = { url: n.item.photo };
      }

      if (n.error && typeof n.error === 'string') {
        embed.description = n.error.slice(0, 2048);
      }

      await gotScraping({
        url: this.config.discord.webhookUrl,
        method: 'POST',
        json: { content: mention || undefined, embeds: [embed] },
        timeout: { request: 10_000 },
        throwHttpErrors: false,
      });

      this.trackSent('discord');
    } catch (error) {
      log.error(`Discord failed: ${error.message}`);
    }
  }

  // ── Slack ──

  async sendSlack(n) {
    try {
      const emoji = {
        newItem: ':mag:', priceDrop: ':chart_with_downwards_trend:',
        sellerNewListing: ':bust_in_silhouette:', autobuyExecuted: ':moneybag:',
        autobuyFailed: ':x:', sessionError: ':warning:', dailySummary: ':bar_chart:',
      }[n.trigger] || ':bell:';

      const blocks = [{
        type: 'section',
        text: { type: 'mrkdwn', text: `${emoji} *${n.title}*` },
      }];

      if (n.item) {
        const details = [];
        if (n.item.price) details.push(`Prix: ${n.item.price}€`);
        if (n.item.brand) details.push(`Marque: ${n.item.brand}`);
        if (n.item.size) details.push(`Taille: ${n.item.size}`);
        if (n.item.seller?.login) details.push(`Vendeur: ${n.item.seller.login}`);
        if (n.item.url) details.push(`<${n.item.url}|Voir l'article>`);
        blocks.push({
          type: 'section',
          text: { type: 'mrkdwn', text: details.join(' | ') },
        });
      }

      await gotScraping({
        url: this.config.slack.webhookUrl,
        method: 'POST',
        json: {
          channel: this.config.slack.channel || undefined,
          text: `${emoji} ${n.title}`,
          blocks,
        },
        timeout: { request: 10_000 },
        throwHttpErrors: false,
      });

      this.trackSent('slack');
    } catch (error) {
      log.error(`Slack failed: ${error.message}`);
    }
  }

  // ── Telegram ──

  async sendTelegram(n) {
    try {
      let text = `<b>${escapeHtml(n.title)}</b>\n`;

      if (n.item) {
        if (n.item.price) text += `💰 ${n.item.price}€`;
        if (n.item.previousPrice) text += ` (était ${n.item.previousPrice}€)`;
        text += '\n';
        if (n.item.brand) text += `🏷 ${escapeHtml(n.item.brand)}\n`;
        if (n.item.size) text += `📏 ${escapeHtml(n.item.size)}\n`;
        if (n.item.condition) text += `📦 ${escapeHtml(n.item.condition)}\n`;
        if (n.item.seller?.login) text += `👤 ${escapeHtml(n.item.seller.login)}`;
        if (n.item.seller?.rating) text += ` (${n.item.seller.rating}⭐)`;
        text += '\n';
        if (n.item.url) text += `\n<a href="${n.item.url}">Voir l'article</a>`;
      }

      if (n.error && typeof n.error === 'string') {
        text += `\n⚠️ ${escapeHtml(n.error)}`;
      }

      const apiUrl = `https://api.telegram.org/bot${this.config.telegram.botToken}/sendMessage`;

      // Send text
      await gotScraping({
        url: apiUrl,
        method: 'POST',
        json: {
          chat_id: this.config.telegram.chatId,
          text,
          parse_mode: 'HTML',
          disable_web_page_preview: false,
        },
        timeout: { request: 10_000 },
        throwHttpErrors: false,
      });

      // Send photo if available
      if (n.item?.photo) {
        await gotScraping({
          url: `https://api.telegram.org/bot${this.config.telegram.botToken}/sendPhoto`,
          method: 'POST',
          json: {
            chat_id: this.config.telegram.chatId,
            photo: n.item.photo,
          },
          timeout: { request: 10_000 },
          throwHttpErrors: false,
        });
      }

      this.trackSent('telegram');
    } catch (error) {
      log.error(`Telegram failed: ${error.message}`);
    }
  }

  // ── Email (SMTP) ──

  async sendEmail(n) {
    if (!this.emailTransport) return;
    try {
      const itemHtml = n.item ? `
        <table style="border-collapse:collapse;margin:10px 0">
          ${n.item.photo ? `<tr><td colspan="2"><img src="${n.item.photo}" style="max-width:300px;border-radius:8px" /></td></tr>` : ''}
          ${n.item.price ? `<tr><td><b>Prix</b></td><td>${n.item.price}€${n.item.previousPrice ? ` <s>${n.item.previousPrice}€</s>` : ''}</td></tr>` : ''}
          ${n.item.brand ? `<tr><td><b>Marque</b></td><td>${n.item.brand}</td></tr>` : ''}
          ${n.item.size ? `<tr><td><b>Taille</b></td><td>${n.item.size}</td></tr>` : ''}
          ${n.item.condition ? `<tr><td><b>État</b></td><td>${n.item.condition}</td></tr>` : ''}
          ${n.item.seller?.login ? `<tr><td><b>Vendeur</b></td><td>${n.item.seller.login} (${n.item.seller.rating || '-'}⭐)</td></tr>` : ''}
          ${n.item.url ? `<tr><td colspan="2"><a href="${n.item.url}" style="color:#00d4aa">Voir l'article →</a></td></tr>` : ''}
        </table>
      ` : '';

      await this.emailTransport.sendMail({
        from: this.config.email.from || this.config.email.smtp.user,
        to: this.config.email.to,
        subject: `[Vinted Sniper] ${n.title}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px">
            <h2 style="color:#00d4aa">${n.title}</h2>
            ${itemHtml}
            ${n.error ? `<p style="color:red">⚠️ ${typeof n.error === 'string' ? n.error : JSON.stringify(n.error)}</p>` : ''}
            <p style="color:#999;font-size:12px">Vinted Sniper — ${n.timestamp}</p>
          </div>
        `,
      });

      this.trackSent('email');
    } catch (error) {
      log.error(`Email failed: ${error.message}`);
    }
  }

  // ── SMS (Twilio) ──

  async sendSMS(n) {
    try {
      const { accountSid, authToken, from, to } = this.config.sms;
      const body = `[Vinted] ${n.title}${n.item?.price ? ` — ${n.item.price}€` : ''}${n.item?.url ? `\n${n.item.url}` : ''}`;

      const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

      await gotScraping({
        url: `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ From: from, To: to, Body: body.slice(0, 1600) }).toString(),
        timeout: { request: 10_000 },
        throwHttpErrors: false,
      });

      this.trackSent('sms');
    } catch (error) {
      log.error(`SMS failed: ${error.message}`);
    }
  }

  // ── Desktop ──

  async sendDesktop(n) {
    try {
      // Dynamic import to avoid issues on servers without display
      const notifier = await import('node-notifier');
      notifier.default.notify({
        title: 'Vinted Sniper',
        message: n.title,
        icon: n.item?.photo,
        sound: this.config.desktop.sound,
        timeout: 10,
      });
      this.trackSent('desktop');
    } catch (error) {
      // Desktop notifications are best-effort
      log.debug(`Desktop notification skipped: ${error.message}`);
    }
  }

  // ── Generic Webhook ──

  async sendWebhook(n) {
    try {
      await gotScraping({
        url: this.config.webhook.url,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.config.webhook.headers },
        json: n,
        timeout: { request: 10_000 },
        throwHttpErrors: false,
      });
      this.trackSent('webhook');
    } catch (error) {
      log.error(`Webhook failed: ${error.message}`);
    }
  }

  trackSent(channel) {
    this.stats.sent++;
    this.stats.byChannel[channel] = (this.stats.byChannel[channel] || 0) + 1;
  }

  getStats() {
    return {
      ...this.stats,
      recentCount: this.notificationLog.length,
    };
  }

  getRecentNotifications(limit = 20) {
    return this.notificationLog.slice(-limit);
  }
}

function escapeHtml(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
