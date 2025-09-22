/**
 * PM2 Ecosystem Configuration
 * Production deployment configuration for Voice Service
 */

module.exports = {
  apps: [
    {
      name: 'voice-service',
      script: './dist/app.js',
      instances: 'max', // Use all CPU cores
      exec_mode: 'cluster',
      
      // Environment variables
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      
      // Logging
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Auto-restart configuration
      watch: false,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '5s',
      max_memory_restart: '500M',
      
      // Graceful shutdown
      kill_timeout: 5000,
      
      // Health monitoring
      health_check_grace_period: 3000,
      
      // Cron restart (daily at 3 AM)
      cron_restart: '0 3 * * *',
      
      // Source map support
      node_args: '--enable-source-maps',
    }
  ],
  
  // Deployment configuration
  deploy: {
    production: {
      user: 'deploy',
      host: ['your-server.com'],
      ref: 'origin/main',
      repo: 'git@github.com:novumhouse/rekeep-voice-service.git',
      path: '/var/www/voice-service',
      
      'pre-deploy-local': '',
      'post-deploy': 'npm ci && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': 'git clone git@github.com:novumhouse/rekeep-voice-service.git .',
      
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      }
    },
    
    staging: {
      user: 'deploy',
      host: 'staging-server.com',
      ref: 'origin/develop',
      repo: 'git@github.com:novumhouse/rekeep-voice-service.git',
      path: '/var/www/voice-service-staging',
      
      'post-deploy': 'npm ci && npm run build && pm2 reload ecosystem.config.js --env staging',
      
      env: {
        NODE_ENV: 'staging',
        PORT: 3002,
      }
    }
  }
};
