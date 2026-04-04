import type { Bot } from 'grammy';
import type { BotContext, NotificationPayload } from '../../types/bot.js';
import { formatArticleNotification, formatPepiteNotification } from './templates.js';
import { getTopicIds } from './topic-router.js';
import { config } from '../../config.js';
import pino from 'pino';

const logger = pino({ name: 'notification-sender' });

// Rate limiting: max 20 messages per second
const MESSAGE_INTERVAL_MS = 50; // ~20 msg/s
let lastSentAt = 0;
const queue: Array<() => Promise<void>> = [];
let processing = false;

export function setupNotificationSender(bot: Bot<BotContext>): {
  sendArticle: (payload: NotificationPayload) => Promise<void>;
  sendPepite: (payload: NotificationPayload) => Promise<void>;
} {
  const groupId = config.TELEGRAM_GROUP_ID;

  async function sendWithRateLimit(fn: () => Promise<void>): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      queue.push(async () => {
        try {
          await fn();
          resolve();
        } catch (err) {
          reject(err);
        }
      });
      processQueue();
    });
  }

  async function processQueue(): Promise<void> {
    if (processing) return;
    processing = true;

    while (queue.length > 0) {
      const fn = queue.shift()!;
      const now = Date.now();
      const elapsed = now - lastSentAt;

      if (elapsed < MESSAGE_INTERVAL_MS) {
        await sleep(MESSAGE_INTERVAL_MS - elapsed);
      }

      try {
        await fn();
      } catch (err) {
        if (isTelegramRateLimitError(err)) {
          const retryAfter = extractRetryAfter(err) ?? 5;
          logger.warn({ retryAfter }, 'Telegram rate limit hit, waiting');
          await sleep(retryAfter * 1000);
          queue.unshift(fn); // Re-add to front of queue
        } else {
          logger.error({ err }, 'Failed to send notification');
        }
      }

      lastSentAt = Date.now();
    }

    processing = false;
  }

  async function sendArticle(payload: NotificationPayload): Promise<void> {
    if (!groupId) return;

    const topicIds = getTopicIds();
    const text = formatArticleNotification(payload);

    await sendWithRateLimit(async () => {
      if (payload.photoUrl) {
        await bot.api.sendPhoto(groupId, payload.photoUrl, {
          caption: text,
          parse_mode: 'HTML',
          message_thread_id: topicIds.feed ?? undefined,
        });
      } else {
        await bot.api.sendMessage(groupId, text, {
          parse_mode: 'HTML',
          message_thread_id: topicIds.feed ?? undefined,
          link_preview_options: { is_disabled: true },
        });
      }

      logger.debug({ articleId: payload.articleId }, 'Sent article notification');
    });
  }

  async function sendPepite(payload: NotificationPayload): Promise<void> {
    if (!groupId) return;

    const topicIds = getTopicIds();
    const text = formatPepiteNotification(payload);

    await sendWithRateLimit(async () => {
      if (payload.photoUrl) {
        await bot.api.sendPhoto(groupId, payload.photoUrl, {
          caption: text,
          parse_mode: 'HTML',
          message_thread_id: topicIds.pepites ?? undefined,
        });
      } else {
        await bot.api.sendMessage(groupId, text, {
          parse_mode: 'HTML',
          message_thread_id: topicIds.pepites ?? undefined,
          link_preview_options: { is_disabled: true },
        });
      }

      logger.debug({ articleId: payload.articleId }, 'Sent pepite notification');
    });
  }

  return { sendArticle, sendPepite };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isTelegramRateLimitError(err: unknown): boolean {
  if (err && typeof err === 'object' && 'error_code' in err) {
    return (err as { error_code: number }).error_code === 429;
  }
  return false;
}

function extractRetryAfter(err: unknown): number | null {
  if (err && typeof err === 'object' && 'parameters' in err) {
    const params = (err as { parameters?: { retry_after?: number } }).parameters;
    return params?.retry_after ?? null;
  }
  return null;
}
