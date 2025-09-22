/**
 * Authentication Middleware
 * Handles user authentication and context extraction
 */

import { Request, Response, NextFunction } from 'express';

interface UserProfile {
  uuid?: string;
  client_profile?: {
    first_name?: string;
    last_name?: string;
    diet_expectation?: string;
  };
}

/**
 * Extract user ID from token (format: "1711|rest_of_token")
 */
function getUserIdFromToken(token: string): string {
  const parts = token.split('|');
  return parts[0] || '';
}

/**
 * Extract user name from token or use fallback
 */
function getUserNameFromToken(token: string, fallback = 'User'): string {
  // In a real implementation, you might decode the JWT to get the user name
  // For now, using the user ID as a fallback
  return fallback;
}

/**
 * Fetch user profile from existing API
 */
async function fetchUserProfile(token: string): Promise<UserProfile | null> {
  try {
    const response = await fetch(`${process.env.REKEEP_API_BASE_URL}/client/profile`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn(`⚠️ Failed to fetch user profile: ${response.status}`);
      return null;
    }

    const profile = await response.json() as UserProfile;
    return profile;
  } catch (error) {
    console.warn('⚠️ Error fetching user profile:', error);
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
    let userId: string = '';
    let userName: string = 'User';

    // Method 1: X-API-TOKEN header (preferred)
    const xApiToken = req.headers['x-api-token'] as string;
    if (xApiToken) {
      userToken = xApiToken;
      userId = getUserIdFromToken(xApiToken);
      console.log(`🔑 Authentication via X-API-TOKEN for user: ${userId}`);
    }
    
    // Method 2: Authorization Bearer token
    else if (req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        userToken = authHeader.substring(7);
        userId = getUserIdFromToken(userToken);
        console.log(`🔑 Authentication via Authorization Bearer for user: ${userId}`);
      }
    }
    
    // Method 3: API_KEY from environment (fallback)
    else if (process.env.API_KEY) {
      userToken = process.env.API_KEY;
      userId = getUserIdFromToken(userToken);
      userName = 'Default User';
      console.log(`🔑 Authentication via API_KEY fallback for user: ${userId}`);
    }

    if (!userToken || !userId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        details: 'Provide X-API-TOKEN header or Authorization Bearer token'
      });
      return;
    }

    // Try to get user profile for additional context
    let userProfile: UserProfile | null = null;
    if (process.env.REKEEP_API_BASE_URL) {
      userProfile = await fetchUserProfile(userToken);
      if (userProfile?.client_profile) {
        const profile = userProfile.client_profile;
        userName = profile.first_name || profile.last_name || userName;
        if (profile.first_name && profile.last_name) {
          userName = `${profile.first_name} ${profile.last_name}`;
        }
      }
    }

    // Attach user context to request
    req.user = {
      id: userId,
      name: userName,
      token: userToken,
      uuid: userProfile?.uuid || undefined
    };

    console.log(`✅ Authenticated user: ${userName} (${userId})`);
    next();

  } catch (error) {
    console.error('❌ Authentication error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Optional authentication middleware
 * Does not fail if no auth is provided, but extracts user context if available
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Try to authenticate, but don't fail if no auth provided
    const xApiToken = req.headers['x-api-token'] as string;
    const authHeader = req.headers.authorization;

    if (xApiToken || authHeader) {
      await authenticateUser(req, res, next);
    } else {
      next();
    }
  } catch (error) {
    // Log the error but continue without auth
    console.warn('⚠️ Optional auth failed:', error);
    next();
  }
}

/**
 * Admin authentication middleware
 * Requires admin-level access
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const adminKey = req.headers['x-admin-key'] as string;
  const expectedAdminKey = process.env.ADMIN_KEY;

  if (!expectedAdminKey) {
    res.status(503).json({
      success: false,
      error: 'Admin functionality not configured'
    });
    return;
  }

  if (!adminKey || adminKey !== expectedAdminKey) {
    res.status(403).json({
      success: false,
      error: 'Admin access required'
    });
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
      res.status(429).json({
        success: false,
        error: 'Too many requests',
        retryAfter: Math.ceil((record.resetTime - now) / 1000)
      });
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
