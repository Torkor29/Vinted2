import Redis from 'ioredis';
import { config } from '../config.js';

let redis: Redis;
let subscriber: Redis;

export function getRedis(): Redis {
  if (!redis) {
    throw new Error('Redis not initialized. Call connectRedis() first.');
  }
  return redis;
}

export function getSubscriber(): Redis {
  if (!subscriber) {
    throw new Error('Redis subscriber not initialized. Call connectRedis() first.');
  }
  return subscriber;
}

export async function connectRedis(): Promise<void> {
  redis = new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      return Math.min(times * 200, 5000);
    },
  });

  subscriber = new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      return Math.min(times * 200, 5000);
    },
  });

  await redis.ping();
  await subscriber.ping();
}

export async function closeRedis(): Promise<void> {
  if (subscriber) {
    subscriber.disconnect();
  }
  if (redis) {
    redis.disconnect();
  }
}

// Dedup helpers
export const dedup = {
  async has(vintedId: string): Promise<boolean> {
    const exists = await getRedis().exists(`dedup:${vintedId}`);
    return exists === 1;
  },

  async add(vintedId: string, ttlSeconds: number = 172800): Promise<void> {
    await getRedis().setex(`dedup:${vintedId}`, ttlSeconds, '1');
  },

  async addMany(vintedIds: string[], ttlSeconds: number = 172800): Promise<void> {
    const pipeline = getRedis().pipeline();
    for (const id of vintedIds) {
      pipeline.setex(`dedup:${id}`, ttlSeconds, '1');
    }
    await pipeline.exec();
  },
};

// Cache helpers
export const cache = {
  async get<T>(key: string): Promise<T | null> {
    const data = await getRedis().get(`cache:${key}`);
    if (!data) return null;
    return JSON.parse(data) as T;
  },

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    await getRedis().setex(`cache:${key}`, ttlSeconds, JSON.stringify(value));
  },

  async del(key: string): Promise<void> {
    await getRedis().del(`cache:${key}`);
  },
};

// Pub/Sub helpers
export const pubsub = {
  async publish(channel: string, data: unknown): Promise<void> {
    await getRedis().publish(channel, JSON.stringify(data));
  },

  async subscribe(channel: string, handler: (data: unknown) => void): Promise<void> {
    await getSubscriber().subscribe(channel);
    getSubscriber().on('message', (ch, message) => {
      if (ch === channel) {
        try {
          handler(JSON.parse(message));
        } catch {
          // ignore parse errors
        }
      }
    });
  },
};
