/**
 * Voice Service Main Application
 * Express.js server for ElevenLabs voice conversation API
 */
import { config } from 'dotenv';
config();

import process from 'node:process';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { voiceRoutes } from './routes/voice-routes.js';
import { errorResponse } from './utils/http.js';
import { logger } from './utils/logger.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Allow ElevenLabs WebRTC connections
}));

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://your-web-app.com'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-API-TOKEN',
    'X-Admin-Key',
    'x-api-key'
  ]
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info('request', { method: req.method, path: req.path, ip: req.ip });
  next();
});

// Health check endpoint (before auth)
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Voice Service',
    version: process.env.npm_package_version || '1.0.0',
    uptime: process.uptime()
  });
});

// API routes
app.use('/api/voice', voiceRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Voice Service API',
    version: '1.0.0',
    description: 'ElevenLabs Voice Conversation API for multi-client consumption',
    documentation: '/api/voice',
    health: '/health',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json(errorResponse(404, 'Endpoint not found'));
});

// Global error handler
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('global_error', { error: error instanceof Error ? error.message : 'unknown' });
  res.status(500).json(errorResponse(500, 'Internal server error'));
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Process terminated');
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Process terminated');
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`🎤 Voice Service API running on port ${PORT}`);
  console.log(`📝 API Documentation: http://localhost:${PORT}/api/voice`);
  console.log(`❤️  Health Check: http://localhost:${PORT}/health`);
  console.log(`🚀 Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Log available agents
  console.log('🤖 Available Agents:');
  console.log(`   - Agent 1: ${process.env.AGENT_1_ID || 'not configured'}`);
  console.log(`   - Agent 2: ${process.env.AGENT_2_ID || 'not configured'}`);
  console.log(`   - Agent 3: ${process.env.AGENT_3_ID || 'not configured'}`);
  console.log(`   - Agent 4: ${process.env.AGENT_4_ID || 'not configured'}`);
});

export { app };
