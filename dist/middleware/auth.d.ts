/**
 * Authentication Middleware
 * Handles user authentication and context extraction
 */
import { Request, Response, NextFunction } from 'express';
/**
 * Authentication middleware
 * Extracts and validates user context from various auth methods
 */
export declare function authenticateUser(req: Request, res: Response, next: NextFunction): Promise<void>;
/**
 * Optional authentication middleware
 * Does not fail if no auth is provided, but extracts user context if available
 */
export declare function optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void>;
/**
 * Admin authentication middleware
 * Requires admin-level access
 */
export declare function requireAdmin(req: Request, res: Response, next: NextFunction): void;
export declare function rateLimit(maxRequests?: number, windowMs?: number): (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=auth.d.ts.map