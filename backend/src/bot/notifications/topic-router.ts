import type { Bot } from 'grammy';
import type { BotContext, TopicIds } from '../../types/bot.js';
import pino from 'pino';
import { config } from '../../config.js';

const logger = pino({ name: 'topic-router' });

let topicIds: TopicIds = {
  general: null,
  feed: null,
  pepites: null,
};

export function getTopicIds(): TopicIds {
  return topicIds;
}

export async function initTopics(bot: Bot<BotContext>): Promise<void> {
  const groupId = config.TELEGRAM_GROUP_ID;
  if (!groupId) {
    logger.warn('TELEGRAM_GROUP_ID not set, topic routing disabled');
    return;
  }

  try {
    // Try to create topics (will fail if they already exist)
    try {
      const feedTopic = await bot.api.createForumTopic(groupId, '📦 Feed');
      topicIds.feed = feedTopic.message_thread_id;
      logger.info({ topicId: topicIds.feed }, 'Created Feed topic');
    } catch {
      logger.debug('Feed topic may already exist');
    }

    try {
      const pepitesTopic = await bot.api.createForumTopic(groupId, '💎 Pepites');
      topicIds.pepites = pepitesTopic.message_thread_id;
      logger.info({ topicId: topicIds.pepites }, 'Created Pepites topic');
    } catch {
      logger.debug('Pepites topic may already exist');
    }

    logger.info({ topicIds }, 'Topics initialized');
  } catch (err) {
    logger.warn({ err }, 'Failed to initialize topics (group might not have forum enabled)');
  }
}

export function setTopicIds(ids: Partial<TopicIds>): void {
  topicIds = { ...topicIds, ...ids };
}
