# Voice Service Docker Configuration

# Use Node.js 20 LTS as base image
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json yarn.lock ./
COPY tsconfig.json ./

# Install dependencies
RUN apk add --no-cache yarn \
  && yarn install --frozen-lockfile

# Copy source code
COPY src/ ./src/

# Build the application
RUN yarn build

# Production stage
FROM node:20-alpine AS production

# Create app user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S voiceservice -u 1001

# Set working directory
WORKDIR /app

# Copy built application from builder stage
COPY --from=builder --chown=voiceservice:nodejs /app/dist ./dist
COPY --from=builder --chown=voiceservice:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=voiceservice:nodejs /app/package.json ./

# Create logs directory
RUN mkdir -p /app/logs && chown voiceservice:nodejs /app/logs

# Switch to non-root user
USER voiceservice

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["node", "dist/app.js"]
