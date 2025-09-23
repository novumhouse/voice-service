# 🎤 Voice Service - Insomnia Testing Guide

This guide will help you test the Voice Service API using Insomnia REST Client.

## 📦 Quick Setup

### 1. Import Collection
1. Open **Insomnia**
2. Click **Import/Export** → **Import Data** → **From File**
3. Select `insomnia-collection.json` from this directory
4. The collection "🎤 Voice Service API" will be imported with all endpoints

### 2. Configure Environment
The collection includes four environments:

| **Environment** | **URL** | **Token** | **Usage** |
|-----------------|---------|-----------|-----------|
| **Base Environment** | `http://localhost:3000` | `test-token-123` | Default testing |
| **Local Development** | `http://localhost:3000` | `dev-token-456` | Development work |
| **Staging Environment** | `http://localhost:8080` | `staging-token-789` | Staging tests |
| **Production Environment** | `https://your-domain.com` | `your-production-token` | Production (update URL/token) |

**Default settings (Base Environment):**
```json
{
  "base_url": "http://localhost:3000",
  "api_token": "test-token-123",
  "timestamp": "{% now 'unix' %}"
}
```

**To switch environments:**
1. Click the **Environment dropdown** (top-left)
2. Select your desired environment
3. All requests will use that environment's settings

## 🧪 Test Scenarios

### 🏥 **Service Health Tests**

#### 1. Health Check
- **Endpoint**: `GET /health`
- **Purpose**: Verify service is running
- **Expected**: `200 OK` with service status

#### 2. API Documentation
- **Endpoint**: `GET /api/voice`
- **Purpose**: Get API documentation
- **Expected**: `200 OK` with endpoint list

### 🤖 **Agent Tests**

#### 3. List All Agents
- **Endpoint**: `GET /api/voice/agents`
- **Headers**: `X-API-TOKEN: test-token-123`
- **Expected**: List of 3 agents (Polish, English, Spanish)

#### 4. Get Specific Agent
- **Endpoint**: `GET /api/voice/agents/agent_1`
- **Headers**: `X-API-TOKEN: test-token-123`
- **Expected**: Agent details with ElevenLabs ID and configuration

### 💬 **Conversation Tests**

#### 5. Start Conversation (Agent 1 - Polish)
- **Endpoint**: `POST /api/voice/conversations/start`
- **Body**:
```json
{
  "agentId": "agent_1",
  "conversationId": "insomnia-test-{{ _.timestamp }}",
  "userId": "{{ _.api_token }}",
  "userName": "Insomnia User",
  "userToken": "{{ _.api_token }}",
  "userUuid": "insomnia-uuid-123"
}
```
- **Expected**: WebRTC token + overrides with Polish personalization

#### 6. Start Conversation (Agent 2 - English Support)
- **Body**: Same structure, `agentId: "agent_2"`
- **Expected**: English customer support configuration

#### 7. Start Conversation (Agent 3 - Spanish Sales)
- **Body**: Same structure, `agentId: "agent_3"`
- **Expected**: Spanish sales assistant configuration

#### 8. Get Session Status
- **Endpoint**: `GET /api/voice/conversations/{sessionId}/status`
- **Note**: Use `sessionId` from start conversation response
- **Expected**: Session details and status

#### 9. End Session
- **Endpoint**: `POST /api/voice/conversations/{sessionId}/end`
- **Body**:
```json
{
  "reason": "User ended conversation",
  "duration": 120
}
```
- **Expected**: Session ended successfully

### ❌ **Error Testing**

#### 10. Invalid Agent Error
- **Body**: `agentId: "invalid_agent"`
- **Expected**: `400 Bad Request` - Agent not found

#### 11. Missing Authentication
- **Remove**: `X-API-TOKEN` header
- **Expected**: `401 Unauthorized`

#### 12. Missing Required Fields
- **Body**: Only `{ "agentId": "agent_1" }`
- **Expected**: `400 Bad Request` - Missing required fields

## 🔍 **What to Look For**

### ✅ **Successful Responses**

#### Start Conversation Response:
```json
{
  "success": true,
  "data": {
    "sessionId": "voice_1758611604770_6139lip2z",
    "conversationData": {
      "token": "eyJhbGciOiJIUzI1NiIs...",
      "agentId": "agent_7401k56rrgbme4bvmb49ym9annev",
      "connectionType": "webrtc",
      "overrides": {
        "agent": {
          "prompt": {
            "prompt": "You are a helpful Polish voice assistant..."
          },
          "firstMessage": "Cześć Insomnia User! Miło Cię poznać...",
          "language": "pl"
        }
      }
    },
    "session": {
      "id": "voice_1758611604770_6139lip2z",
      "userId": "test-token-123",
      "agentId": "agent_1",
      "status": "active",
      "startTime": "2025-09-23T07:13:24.770Z"
    }
  }
}
```

### 🔑 **Key Validation Points**

1. **WebRTC Token**: JWT token for ElevenLabs connection
2. **Agent ID**: Real ElevenLabs agent ID (not our internal ID)
3. **Overrides**: Personalized prompt with user's name
4. **Language**: Correct language for each agent
5. **Session Tracking**: Unique session ID and metadata

### 📊 **Performance Expectations**

| **Endpoint** | **Expected Response Time** |
|--------------|----------------------------|
| Health Check | < 50ms |
| List Agents | < 100ms |
| Start Conversation | < 2000ms (ElevenLabs API call) |
| Session Status | < 100ms |

## 🚀 **Advanced Testing**

### Environment Variables
You can customize any environment for different scenarios:

**To customize an environment:**
1. Click **Manage Environments** (gear icon next to environment dropdown)
2. Select the environment you want to modify
3. Edit the JSON values:

```json
{
  "base_url": "http://localhost:4000",  // Change port if needed
  "api_token": "your-custom-token",     // Your actual API token
  "user_name": "Custom User Name",      // Optional: default user name
  "timestamp": "{% now 'unix' %}"       // Dynamic timestamp
}
```

**Common customizations:**
- **Different port**: Change `3000` to `4000`, `8080`, etc.
- **HTTPS**: Change `http://` to `https://` for secure connections
- **Custom domain**: Replace `localhost` with your domain
- **API tokens**: Use your actual authentication tokens

### Batch Testing
1. Use **Collection Runner** to run all tests
2. Set up **Test Suites** for different scenarios
3. Use **Environment switching** for dev/staging/prod

### Custom Variables
Add dynamic variables in request bodies:
- `{{ _.timestamp }}` - Current Unix timestamp
- `{{ _.api_token }}` - API token from environment
- `{{ _.user_name }}` - Custom user name

## 🔧 **Troubleshooting**

### Common Issues:

#### 1. **500 Internal Server Error**
- Check if Voice Service is running: `npm run dev`
- Verify ElevenLabs API key in `.env`
- Check server logs for detailed errors

#### 2. **401 Unauthorized**
- Ensure `X-API-TOKEN` header is set
- Verify token matches server configuration

#### 3. **400 Bad Request - Agent not found**
- Use valid agent IDs: `agent_1`, `agent_2`, `agent_3`
- Check agent configuration in `src/config/agents.ts`

#### 4. **ElevenLabs API Errors**
- Verify `ELEVENLABS_API_KEY` in environment
- Check ElevenLabs service status
- Ensure agent IDs exist in ElevenLabs

## 📝 **Testing Checklist**

- [ ] ✅ Service health check passes
- [ ] ✅ API documentation loads
- [ ] ✅ All 3 agents are listed
- [ ] ✅ Individual agent details load
- [ ] ✅ Start conversation with Agent 1 (Polish)
- [ ] ✅ Start conversation with Agent 2 (English)
- [ ] ✅ Start conversation with Agent 3 (Spanish)
- [ ] ✅ Session status retrieval works
- [ ] ✅ Session ending works
- [ ] ✅ Error handling for invalid agent
- [ ] ✅ Error handling for missing auth
- [ ] ✅ Error handling for missing fields
- [ ] ✅ Overrides contain personalized prompts
- [ ] ✅ WebRTC tokens are valid JWTs
- [ ] ✅ Response times are acceptable

## 🎯 **Success Criteria**

Your Voice Service is working correctly when:
1. **All health checks pass** ✅
2. **Agent configurations load** ✅
3. **Conversations start successfully** ✅
4. **Overrides contain user personalization** ✅
5. **WebRTC tokens are generated** ✅
6. **Error handling works properly** ✅
7. **Session management functions** ✅

**Happy Testing!** 🚀
