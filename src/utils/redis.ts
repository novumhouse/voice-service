import { config } from 'dotenv';
config();

import { Redis } from '@upstash/redis';

export interface CacheOptions {
  ttlSeconds?: number; // expire after seconds
}

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

const _redis = redisUrl && redisToken
  ? new Redis({ url: redisUrl, token: redisToken })
  : null;

export function getRedis(): Redis {
  if (!_redis) {
    throw new Error('Redis is not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN');
  }
  return _redis;
}

export async function cacheSet<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
  const redis = getRedis();
  const payload = JSON.stringify(value);
  if (options?.ttlSeconds && options.ttlSeconds > 0) {
    await redis.set(key, payload, { ex: options.ttlSeconds });
  } else {
    await redis.set(key, payload);
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  const payload = await redis.get<string | null>(key);
  if (!payload) return null;
  try {
    return JSON.parse(payload) as T;
  } catch {
    return null;
  }
}

export async function cacheDel(key: string): Promise<void> {
  const redis = getRedis();
  await redis.del(key);
}

export async function cacheIncrBy(key: string, amount: number, ttlSeconds?: number): Promise<number> {
  const redis = getRedis();
  const current = await redis.incrby(key, amount);
  if (ttlSeconds && ttlSeconds > 0) {
    // Only set expiry if key is new or has no TTL
    const ttl = await redis.ttl(key);
    if (ttl < 0) {
      await redis.expire(key, ttlSeconds);
    }
  }
  return current;
}

export async function cacheExpire(key: string, ttlSeconds: number): Promise<void> {
  const redis = getRedis();
  await redis.expire(key, ttlSeconds);
}

export async function cacheSAdd(key: string, member: string, ttlSeconds?: number): Promise<void> {
  const redis = getRedis();
  await redis.sadd(key, member);
  if (ttlSeconds && ttlSeconds > 0) {
    await redis.expire(key, ttlSeconds);
  }
}

export async function cacheSMembers(key: string): Promise<string[]> {
  const redis = getRedis();
  const members = await redis.smembers(key);
  return (members as unknown as string[]) || [];
}

export async function cacheSRem(key: string, member: string): Promise<void> {
  const redis = getRedis();
  await redis.srem(key, member);
}


