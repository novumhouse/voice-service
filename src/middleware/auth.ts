/**
 * Authentication Middleware
 * Handles user authentication and context extraction
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import { errorResponse } from '../utils/http.js';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';

interface RekeepClientMeResponse {
  data?: {
    uuid?: string;
    email?: string;
    phone_number?: string;
    preferred_language?: string;
    is_email_verified?: boolean;
    is_social?: boolean;
    marketing_consents?: Record<string, unknown>;
    token?: unknown;
    client_profile?: {
      uuid?: string;
      first_name?: string;
      last_name?: string;
      street?: string | null;
      postcode?: string | null;
      city?: string | null;
      gender?: string | null;
      birth_date?: string | null;
      diet_expectation?: string | null;
      lifestyle?: string | null;
      weight?: number | null;
      weight_goal?: number | null;
      height?: number | null;
      onboarding_completed?: boolean | null;
    };
  };
}

/**
 * Fetch user profile from existing API
 */
export async function fetchUserMe(token: string): Promise<RekeepClientMeResponse | null> {
  try {
    const base = process.env.REKEEP_API_BASE_URL;
    if (!base) return null;
    const url = `${base}/auth/api/client/me`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      logger.warn('Failed to fetch ReKeep client me', { status: response.status });
      return null;
    }

    const profile = await response.json() as RekeepClientMeResponse;
    return profile;
  } catch (error) {
    logger.warn('Error fetching ReKeep client me', { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

/**
 * Authentication middleware
 * Extracts and validates user context from various auth methods
 */
export async function authenticateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    let userToken: string | null = null;
    let userName: string = 'User';

    // Method 1: X-API-TOKEN header (preferred)
    const xApiToken = req.headers['x-api-token'] as string;
    if (xApiToken) {
      userToken = xApiToken;
      logger.info('Authentication via X-API-TOKEN');
    }
    // Method 2: Authorization Bearer token
    else if (req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        userToken = authHeader.substring(7);
        logger.info('Authentication via Authorization Bearer');
      }
    }
    // No environment fallback: require explicit token

    if (!userToken) {
      res.status(401).json(errorResponse(401, 'Unauthorized: invalid or missing token'));
      return;
    }

    // Enforce ReKeep verification when configured
    let userProfile: RekeepClientMeResponse | null = null;
    if (process.env.REKEEP_API_BASE_URL) {
      userProfile = await fetchUserMe(userToken);
      const data = userProfile?.data;
      if (!data?.uuid) {
        res.status(401).json(errorResponse(401, 'Unauthorized: invalid X-API-TOKEN'));
        return;
      }
      const firstName = data.client_profile?.first_name;
      if (firstName) {
        userName = firstName;
      }

      // Ensure user exists in local users table (by uuid). If not, create minimal record.
      try {
        const found = await db.select().from(users).where(eq(users.uuid, data.uuid)).limit(1);
        if (found.length === 0) {
          await db.insert(users).values({
            uuid: data.uuid,
            firstName: data.client_profile?.first_name || null as unknown as string,
            lastName: data.client_profile?.last_name || null as unknown as string,
          });
          logger.info('Created local user record', { uuid: data.uuid });
        }
      } catch (e) {
        logger.warn('Failed to ensure local user record', { error: e instanceof Error ? e.message : 'unknown' });
      }
    }

    // Attach user context to request (uuid only)
    req.user = {
      name: userName,
      token: userToken,
      uuid: userProfile?.data?.uuid || userProfile?.data?.client_profile?.uuid || undefined
    };

    logger.info('Authenticated user', { userName, uuid: req.user.uuid });
    next();

  } catch (error) {
    logger.error('Authentication error', { error: error instanceof Error ? error.message : 'Unknown error' });
    res.status(500).json(errorResponse(500, 'Authentication failed'));
  }
}

/**
 * Optional authentication middleware
 * Does not fail if no auth is provided, but extracts user context if available
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const xApiToken = req.headers['x-api-token'] as string;
    const authHeader = req.headers.authorization;

    if (xApiToken || authHeader) {
      await authenticateUser(req, res, next);
    } else {
      next();
    }
  } catch (error) {
    logger.warn('Optional auth failed', { error: error instanceof Error ? error.message : 'Unknown error' });
    next();
  }
}

/**
 * Admin authentication middleware
 * Requires admin-level access
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const bearerKey = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
  const headerKey = (req.headers['x-admin-key'] as string) || undefined;

  const expected = process.env.ADMIN_API_KEY || process.env.ADMIN_KEY; // support legacy env name

  if (!expected) {
    res.status(503).json(errorResponse(503, 'Admin functionality not configured'));
    return;
  }

  const provided = bearerKey || headerKey;
  if (!provided || provided !== expected) {
    res.status(403).json(errorResponse(403, 'Admin access required'));
    return;
  }

  next();
}

/**
 * Rate limiting middleware (simple implementation)
 */
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export function rateLimit(maxRequests = 100, windowMs = 15 * 60 * 1000): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip || 'unknown';
    const now = Date.now();
    
    let record = rateLimitStore.get(key);
    if (!record || now > record.resetTime) {
      record = { count: 0, resetTime: now + windowMs };
      rateLimitStore.set(key, record);
    }

    record.count++;

    if (record.count > maxRequests) {
      res.status(429).json(errorResponse(429, 'Too many requests'));
      return;
    }

    res.setHeader('X-RateLimit-Limit', maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - record.count).toString());
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000).toString());

    next();
  };
}

// Cleanup rate limit store every hour
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60 * 60 * 1000);
