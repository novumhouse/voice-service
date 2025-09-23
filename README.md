# 🎤 Voice Service API

**ElevenLabs Voice Conversation API for Multi-Client Consumption**

A standalone microservice that provides RESTful APIs for ElevenLabs voice conversations, designed to support multiple client applications (Web, Flutter, Mobile) with centralized session management, usage tracking, and agent selection.

## 📊 Current Status

✅ **Production Ready** - Complete implementation with enterprise features  
✅ **Multi-Client Support** - Web, Flutter, and Mobile client examples  
✅ **Direct WebRTC** - Optimized for <100ms latency  
✅ **Docker Ready** - Full containerization support  
✅ **Documentation Complete** - Comprehensive guides and examples  

**Latest Version**: 1.0.0 🎉

## 🏗️ Architecture Overview

### **Hybrid Architecture: Control Plane + Direct Data Plane**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Client    │    │  Flutter App    │    │   Mobile App    │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
    ┌────▼───────────────────────▼───────────────────────▼────┐
    │              CONTROL PLANE (REST API)                  │
    │                                                         │
    │  ┌─────────────────┐  ┌─────────────────┐             │
    │  │  Voice Service  │  │  ReKeep API     │             │
    │  │      API        │  │  (User Profile) │             │
    │  └─────────────────┘  └─────────────────┘             │
    │           │                     │                      │
    │           ▼                     ▼                      │
    │  ┌─────────────────┐  ┌─────────────────┐             │
    │  │ Session Manager │  │ Agent Manager   │             │
    │  │ Usage Tracking  │  │ (4 Agents)      │             │
    │  └─────────────────┘  └─────────────────┘             │
    └─────────────────────────┬───────────────────────────────┘
                              │ Token Generation
                              ▼
                    ┌─────────────────┐
                    │  ElevenLabs     │
                    │  Token API      │
                    └─────────────────┘
                              │
    ┌─────────────────────────┼───────────────────────────────┐
    │              DATA PLANE (Direct WebRTC)                 │
    │                         │                               │
    │  ┌─────────────────┐    │    ┌─────────────────┐       │
    │  │   Web Client    │◄───┼───►│  ElevenLabs     │       │
    │  │                 │    │    │  WebRTC API     │       │
    │  └─────────────────┘    │    └─────────────────┘       │
    │                         │             │                │
    │  ┌─────────────────┐    │    ┌─────────────────┐       │
    │  │  Flutter App    │◄───┼───►│ AI Voice Agent  │       │
    │  │                 │    │    │ (Real-time)     │       │
    │  └─────────────────┘    │    └─────────────────┘       │
    │                         │                               │
    │  ┌─────────────────┐    │    🚀 <100ms Latency        │
    │  │   Mobile App    │◄───┘    📊 Direct Audio Stream    │
    │  │                 │          🔒 End-to-End Encrypted  │
    │  └─────────────────┘                                   │
    └─────────────────────────────────────────────────────────┘
```

### **🔄 Two-Phase Architecture Explained**

**Phase 1: Control Plane (Voice Service API)**
- 🔐 Authentication & Authorization
- 🎯 Agent Selection & Configuration  
- 📊 Session Management & Tracking
- ⏱️ Usage Limits & Monitoring
- 🎫 ElevenLabs Token Generation

**Phase 2: Data Plane (Direct WebRTC)**
- 🎤 Real-time Voice Streaming
- 🤖 AI Agent Processing
- ⚡ Sub-100ms Latency
- 🔒 End-to-End Encryption
- 📡 Global CDN Optimization

### **🔧 Core Components**

#### **Voice Service API (Express.js)**
```typescript
// Main application with middleware stack
app.use(helmet(), cors(), compression())
app.use('/api/voice', voiceRoutes)
```
- **Port**: 3001 (configurable)
- **Middleware**: Security, CORS, Rate Limiting, Request Logging
- **Health Check**: `/health` endpoint
- **API Documentation**: `/api/voice` endpoint

#### **Authentication System**
```typescript
// Multi-method authentication
X-API-TOKEN: 1711|JPcIqtiocWWw0XUDu94YsyaoVw3n6ZST50n9rxtJ90e4e4f6
Authorization: Bearer <token>
// No environment fallback (401 when missing/invalid)
```
- **ReKeep API Integration**: Fetches user profiles
- **Token Validation**: Extracts user ID from token format
- **Rate Limiting**: 200 requests per 15 minutes

#### **Agent Management System**
```typescript
// 4 Specialized Agents
agent_1: Support Agent Florek (customer_support)
agent_2: Diet Expert Agent (diet_consultation)  
agent_3: Sales Agent (sales)
agent_4: Technical Support Agent (technical_support)
```
- **Dynamic Configuration**: Environment-based agent IDs
- **Specializations**: Each agent has specific expertise
- **Language**: Polish language support
- **Validation**: Agent availability and status checks

#### **Session Management**
```typescript
// Session lifecycle tracking
VoiceSession {
  id, userUuid, agentId, startTime, duration,
  status: 'starting' | 'active' | 'ended',
  clientType: 'web' | 'flutter' | 'mobile'
}
```
- **Usage Tracking**: Daily time limits (600s default)
- **Memory Storage**: In-memory with database persistence hooks
- **Auto-cleanup**: Expired session removal (30min timeout)
- **Multi-client**: Tracks client type for analytics

#### **ElevenLabs Integration**
```typescript
// Token generation and WebRTC setup
GET https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=X
// Returns: { token, dynamicVariables, connectionType: 'webrtc' }
```
- **Dynamic Variables**: User context injection
- **WebRTC Tokens**: Direct connection credentials
- **Agent Selection**: Runtime agent switching
- **Error Handling**: Comprehensive ElevenLabs API error management

### **📊 Data Flow Sequence**

```mermaid
sequenceDiagram
    participant C as Client App
    participant VS as Voice Service
    participant RA as ReKeep API
    participant EL as ElevenLabs API
    participant WR as WebRTC Connection
    
    Note over C,WR: 🔧 SETUP PHASE (Control Plane)
    C->>VS: POST /api/voice/conversations/start
    VS->>VS: Authenticate user (X-API-TOKEN)
    VS->>RA: GET /client/profile (optional)
    RA-->>VS: User profile data
    VS->>VS: Validate agent & check usage limits
    VS->>VS: Create session in SessionManager
    VS->>EL: GET /v1/convai/conversation/token?agent_id=X
    EL-->>VS: WebRTC token + configuration
    VS->>VS: Prepare dynamic variables (user context)
    VS-->>C: { sessionId, token, dynamicVariables }
    
    Note over C,WR: 🎤 VOICE PHASE (Data Plane - Direct)
    C->>WR: Start WebRTC session (DIRECT to ElevenLabs)
    WR-->>C: Bidirectional audio stream
    WR-->>C: Real-time AI responses
    
    Note over C,WR: 🔄 SESSION TRACKING (Control Plane)
    C->>VS: POST /api/voice/conversations/:id/end
    VS->>VS: Calculate duration & update usage
    VS->>VS: Clean up session data
    VS-->>C: Session summary
```

**Key Architecture Benefits:**
- ⚡ **Optimal Latency**: Voice data never touches Voice Service
- 🔄 **Clean Separation**: Control plane vs data plane
- 📊 **Enterprise Features**: Session tracking, usage limits, multi-client
- 🚀 **Scalability**: ElevenLabs handles voice traffic, Voice Service handles logic

## ✨ Features

- **🎯 Multi-Agent Support**: 4 configurable ElevenLabs agents
- **📱 Multi-Client**: Web, Flutter, and Mobile support
- **⏱️ Usage Tracking**: Daily voice usage limits and monitoring
- **🔒 Authentication**: Multiple auth methods (X-API-TOKEN, Bearer)
- **🔄 Session Management**: Conversation state and lifecycle management
- **📊 Health Monitoring**: Built-in health checks and metrics
- **🚀 Scalable**: Docker and PM2 deployment ready
- **⚡ Rate Limiting**: Built-in rate limiting and security

## 📋 API Endpoints

### Agent Management
```http
GET    /api/voice/agents              # List available agents
GET    /api/voice/agents/:agentId     # Get specific agent info
```

### Conversation Management
```http
POST   /api/voice/conversations/start          # Start conversation
POST   /api/voice/conversations/:id/end        # End conversation
GET    /api/voice/conversations/:id/status     # Get conversation status
```

### Session Management
```http
GET    /api/voice/sessions/usage               # Get usage statistics
GET    /api/voice/sessions/active              # Get active sessions
```

### Admin (Privileged)
```http
GET    /api/voice/admin/sessions               # List ALL active sessions (admin)
POST   /api/voice/admin/sessions/end           # End ALL active sessions (admin)

# Auth headers (one of):
Authorization: Bearer <ADMIN_API_KEY>
X-Admin-Key: <ADMIN_API_KEY>
```

### Health & Monitoring
```http
GET    /api/voice/health                       # Health check
```

## 🚀 Quick Start

### 1. Environment Setup

```bash
# Clone the repository
git clone git@github.com:miekki-jerry/rekeep-voice.git
cd rekeep-voice

# Copy environment configuration
cp config.example.env .env

# Edit environment variables (required!)
nano .env
```

**⚠️ Important**: You must configure the following environment variables:
- `ELEVENLABS_API_KEY` - Your ElevenLabs API key
- `AGENT_1_ID`, `AGENT_2_ID`, etc. - Your ElevenLabs agent IDs
- `REKEEP_API_TOKEN` - Authentication token for ReKeep API integration
# - `ADMIN_API_KEY` - Admin access key for privileged endpoints

### 2. Environment Variables

```bash
# Server Configuration
NODE_ENV=development
PORT=3001

# ElevenLabs Configuration
ELEVENLABS_API_KEY=sk_your_elevenlabs_api_key_here

# Agent Configuration
AGENT_1_ID=agent_7401k56rrgbme4bvmb49ym9annev
AGENT_2_ID=agent_0801k4z2a4cdfz2tms20kdyvav1a  
AGENT_3_ID=agent_0801k4z2a4cdfz2tms20kdyvav1a
AGENT_4_ID=agent_0801k4z2a4cdfz2tms20kdyvav1a

# Voice Time Limits (in seconds)
VOICE_TIME_LIMIT=600

# Authentication
REKEEP_API_TOKEN=1711|JPcIqtiocWWw0XUDu94YsyaoVw3n6ZST50n9rxtJ90e4e4f6
# Admin (Privileged)
ADMIN_API_KEY=your_admin_api_key_here

# ReKeep API Configuration
REKEEP_API_BASE_URL=https://rekeep-crm-dev-api.invo.ventures
```

### 3. Development

```bash
# Install dependencies
yarn install

# Start development server with hot reload
yarn dev

# The service will be available at:
# - API: http://localhost:3001
# - Health Check: http://localhost:3001/health
# - Documentation: http://localhost:3001/api/voice

# Build for production
yarn build

# Start production server
yarn start
```

**Development Notes**:
- Service runs on port 3001 by default
- Hot reload enabled in development mode
- TypeScript compilation with source maps
- Automatic agent configuration validation on startup

## 🐳 Docker Deployment

### Simple Docker Run
```bash
# Build image
docker build -t voice-service .

# Run container
docker run -p 3001:3001 --env-file .env voice-service
```

### Docker Compose (Recommended)
```bash
# Start all services
docker-compose up -d

# With Redis session storage
docker-compose --profile with-redis up -d

# With PostgreSQL database
docker-compose --profile with-db up -d

# Full stack with proxy
docker-compose --profile with-proxy up -d

# View logs
docker-compose logs -f voice-service
```

## ⚙️ PM2 Production Deployment

```bash
# Install PM2 globally
yarn global add pm2

# Build the application
yarn build

# Start with PM2
yarn pm2:start

# Monitor
pm2 monit

# View logs
pm2 logs voice-service

# Restart
yarn pm2:restart

# Stop
yarn pm2:stop
```

## 📊 Usage Examples

### 🔑 **User Context & Dynamic Variables**

The Voice Service automatically extracts user context and passes it to ElevenLabs agents:

```typescript
// When you call startConversation(), the service automatically:
// 1. Extracts user ID from token (e.g., "1711" from "1711|JPcIqtiocWWw...")
// 2. Fetches user profile from ReKeep API (name, uuid, etc.)
// 3. Prepares dynamic variables for the ElevenLabs agent

const { conversationData } = await client.startConversation('agent_1', 'conv_123');

// conversationData contains:
// {
//   token: "eyJhbGciOiJIUzI1NiIs...",  // WebRTC JWT token for direct connection
//   agentId: "agent_7401k56rrgbme4bvmb49ym9annev",
//   connectionType: "webrtc",
//   dynamicVariables: {
//     user_id: "1711",
//     user_uuid: "uuid-from-rekeep-api", 
//     user_name: "Rafał Kowalski",        // Fetched from ReKeep API
//     user_token: "1711|JPcIqtiocWWw...", // Original auth token
//     bearer_token: "Bearer 1711|JPcIq...", // For agent API calls
//     conversation_id: "conv_123"
//   }
// }
```

### Web Client (TypeScript/JavaScript)

```typescript
import { VoiceServiceClient } from './voice-service-client';

const client = new VoiceServiceClient(
  'http://localhost:3001',
  '1711|JPcIqtiocWWw0XUDu94YsyaoVw3n6ZST50n9rxtJ90e4e4f6'
);

// Get available agents
const agents = await client.getAgents();

// Start conversation (user context handled automatically)
const { sessionId, conversationData } = await client.startConversation(
  'agent_1',
  'conversation_123'
);

// Use the WebRTC token for DIRECT ElevenLabs connection
// (No ElevenLabs SDK required - implement WebRTC directly)
const webrtcConnection = await establishDirectWebRTC({
  token: conversationData.token,           // JWT for WebRTC room
  dynamicVariables: conversationData.dynamicVariables, // User context
  connectionType: conversationData.connectionType      // 'webrtc'
});

// End conversation
await client.endConversation(sessionId);
```

### Flutter Client (Dart)

```dart
final client = VoiceServiceClient(
  baseUrl: 'http://localhost:3001',
  userToken: '1711|JPcIqtiocWWw0XUDu94YsyaoVw3n6ZST50n9rxtJ90e4e4f6',
);

// Get agents
final agents = await client.getAgents();

// Start conversation (user context handled automatically)
final result = await client.startConversation(
  agentId: 'agent_1',
  conversationId: 'flutter_conversation_123',
);

// Extract WebRTC connection data
final conversationData = result['conversationData'];
final webrtcToken = conversationData['token'];           // JWT for WebRTC room
final dynamicVariables = conversationData['dynamicVariables']; // User context
final roomInfo = decodeJWT(webrtcToken);                 // Room name, permissions

// Establish direct WebRTC connection to ElevenLabs
// (No ElevenLabs Flutter SDK - implement WebRTC directly)
final webrtcConnection = await FlutterWebRTC.connect(
  roomName: roomInfo['video']['room'],
  permissions: roomInfo['video'],
  userContext: dynamicVariables,
);

// End conversation
await client.endConversation(result['sessionId']);
```

### cURL Examples

```bash
# Get agents
curl -X GET \
  'http://localhost:3001/api/voice/agents' \
  -H 'X-API-TOKEN: 1711|JPcIqtiocWWw0XUDu94YsyaoVw3n6ZST50n9rxtJ90e4e4f6'

# Start conversation
curl -X POST \
  'http://localhost:3001/api/voice/conversations/start' \
  -H 'X-API-TOKEN: 1711|JPcIqtiocWWw0XUDu94YsyaoVw3n6ZST50n9rxtJ90e4e4f6' \
  -H 'Content-Type: application/json' \
  -d '{
    "agentId": "agent_1",
    "conversationId": "test_conversation_123",  //format: uuidv4
    "clientType": "web"
  }'

# Get usage statistics
curl -X GET \
  'http://localhost:3001/api/voice/sessions/usage' \
  -H 'X-API-TOKEN: 1711|JPcIqtiocWWw0XUDu94YsyaoVw3n6ZST50n9rxtJ90e4e4f6'

# List ALL active sessions (admin)
curl -X GET \
  'http://localhost:3001/api/voice/admin/sessions' \
  -H 'Authorization: Bearer your_admin_api_key_here'

# End ALL active sessions (admin)
curl -X POST \
  'http://localhost:3001/api/voice/admin/sessions/end' \
  -H 'Authorization: Bearer your_admin_api_key_here'
```

## 🔐 Authentication Methods

The Voice Service supports multiple authentication methods:

1. **X-API-TOKEN Header** (Preferred)
   ```
   X-API-TOKEN: 1711|JPcIqtiocWWw0XUDu94YsyaoVw3n6ZST50n9rxtJ90e4e4f6
   ```

2. **Authorization Bearer Token**
   ```
   Authorization: Bearer 1711|JPcIqtiocWWw0XUDu94YsyaoVw3n6ZST50n9rxtJ90e4e4f6
   ```

3. Missing token behavior
```
If X-API-TOKEN and Authorization Bearer are missing/invalid → 401 Unauthorized
```

## 🤖 Agent Configuration

The service supports 4 configurable agents:

| Agent ID | Environment Variable | Specialization |
|----------|---------------------|----------------|
| agent_1  | AGENT_1_ID          | Customer Support |
| agent_2  | AGENT_2_ID          | Diet Consultation |
| agent_3  | AGENT_3_ID          | Sales |
| agent_4  | AGENT_4_ID          | Technical Support |

## 📈 Monitoring & Health Checks

### Health Check Endpoint
```bash
curl http://localhost:3001/health
```

### Service Statistics
```bash
curl http://localhost:3001/api/voice/health
```

### Docker Health Check
```bash
docker ps  # Check container health status
```

### PM2 Monitoring
```bash
pm2 monit
pm2 logs voice-service
```

## 🔧 Configuration Options

### Rate Limiting
- **Default**: 200 requests per 15 minutes per IP
- **Configurable**: via RATE_LIMIT_MAX_REQUESTS and RATE_LIMIT_WINDOW_MS

### Voice Usage Limits
- **Default**: 600 seconds (10 minutes) per day per user
- **Configurable**: via VOICE_TIME_LIMIT environment variable

### CORS Configuration
- **Default**: localhost:3000, localhost:3001
- **Configurable**: via ALLOWED_ORIGINS environment variable

## 🚨 Error Handling

The API returns standardized error responses:

```json
{
  "success": false,
  "error": "Error description",
  "details": "Detailed error message"
}
```

Common HTTP status codes:
- **401**: Authentication required
- **403**: Access denied
- **404**: Resource not found
- **429**: Rate limit exceeded
- **500**: Internal server error

## 🛠️ Development

### Project Structure
```
voice-service/
├── src/                              # 🎯 Core Application
│   ├── app.ts                       # Express.js server & middleware
│   ├── config/
│   │   └── agents.ts                # 🤖 Agent configuration (4 agents)
│   ├── controllers/
│   │   └── voice-controller.ts      # 📡 REST API endpoints
│   ├── middleware/
│   │   └── auth.ts                  # 🔐 Multi-method authentication
│   ├── routes/
│   │   └── voice-routes.ts          # 🛣️  Route definitions & rate limiting
│   └── services/
│       ├── elevenlabs-service.ts    # 🎤 ElevenLabs API integration
│       └── session-manager.ts       # 📊 Session & usage tracking
├── examples/                         # 📚 Client Implementation Examples
│   ├── web-client.ts               # 🌐 TypeScript/JavaScript client
│   └── flutter-client.dart         # 📱 Dart/Flutter client
├── docs/                            # 📖 Architecture Documentation
│   ├── VOICE_CALL_ARCHITECTURE.md  # 🏗️  Detailed architecture guide
│   ├── LATENCY_COMPARISON.md        # ⚡ Performance analysis
│   └── MIGRATION_GUIDE.md           # 🔄 Migration instructions
├── Dockerfile                       # 🐳 Container configuration
├── docker-compose.yml               # 🐙 Multi-service deployment
├── ecosystem.config.js              # 🚀 PM2 production deployment
├── config.example.env               # ⚙️  Environment template
└── README.md                        # 📋 This documentation
```

**Architecture Mapping:**
- **Control Plane**: `app.ts`, `controllers/`, `middleware/`, `services/`
- **Data Plane**: Direct client ↔ ElevenLabs WebRTC (bypasses Voice Service)
- **Configuration**: `config/`, environment variables
- **Client Examples**: `examples/` directory

### Testing
```bash
# Run tests (when implemented)
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Manual API testing
curl http://localhost:3001/health
curl -H "X-API-TOKEN: your_token" http://localhost:3001/api/voice/agents
```

**Note**: Test suite is configured but tests need to be implemented. The service includes comprehensive error handling and logging for debugging.

### Linting
```bash
# Run linter
yarn lint

# Fix linting issues
yarn lint:fix
```

## 📚 Client Integration Examples

Complete client examples are available in the `/examples` directory:

- **Web Client**: `examples/web-client.ts`
- **Flutter Client**: `examples/flutter-client.dart`

## 🏗️ Architecture Documentation

Detailed architecture and implementation guides:

- **[Voice Call Architecture](VOICE_CALL_ARCHITECTURE.md)** - Direct WebRTC connection flow
- **[Latency Comparison](LATENCY_COMPARISON.md)** - Performance analysis and optimization
- **[Migration Guide](MIGRATION_GUIDE.md)** - Migrating from existing ElevenLabs integration

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Create an issue on [GitHub](https://github.com/novumhouse/rekeep-voice-service/issues)
- Contact the ReKeep development team
- Check the API documentation at `http://localhost:3001/api/voice`

## 🔗 Related Repositories

- **[ReKeep UI](https://github.com/novumhouse/rekeep-ui)** - Main frontend application
- **[ReKeep Voice Service](https://github.com/novumhouse/rekeep-voice-service)** - This voice service API

---

**Made with ❤️ by the ReKeep Team**
