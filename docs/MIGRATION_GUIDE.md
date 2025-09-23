# 🔄 Migration Guide: Frontend to Voice Service API

This guide shows how to migrate the existing ChatWindow.tsx ElevenLabs integration to use the new Voice Service API.

## 📋 Migration Overview

**Before**: Tightly coupled ElevenLabs logic in ChatWindow.tsx (2781 lines)
**After**: Clean API calls to Voice Service + simplified frontend

## 🎯 Step-by-Step Migration

### 1. Install Voice Service Client

Create the client utility in your frontend:

```typescript
// frontend/lib/voice-service-client.ts
import { VoiceServiceClient } from '../path/to/voice-service-client';

export const voiceServiceClient = new VoiceServiceClient(
  process.env.NEXT_PUBLIC_VOICE_SERVICE_URL || 'http://localhost:8080',
  currentUser.token
);
```

### 2. Replace ElevenLabs Token Generation

**Before** (frontend/app/api/elevenlabs-token/route.ts):
```typescript
// Complex 195-line file with ElevenLabs API calls
export async function GET(request: NextRequest): Promise<Response> {
  // ... 195 lines of complex logic
}
```

**After**:
```typescript
// DELETE THIS FILE - Voice Service handles token generation
// The Voice Service API replaces this entire functionality
```

### 3. Update ChatWindow Component

**Before** (Lines 1786-1922):
```typescript
const getConversationToken = async (): Promise<{ token: string; userContext?: any }> => {
  // ... 28 lines of token generation
};

const startElevenLabsConversation = async (confirmedUser?: User) => {
  // ... 94 lines of complex conversation start logic
};
```

**After**:
```typescript
// Replace with simple API calls
const startElevenLabsConversation = async (confirmedUser?: User) => {
  try {
    const agentId = 'agent_1'; // Or let user choose
    const conversationId = getConversationId();
    
    // Start conversation via Voice Service API (user context handled automatically)
    const { sessionId, conversationData } = await voiceServiceClient.startConversation(
      agentId,
      conversationId
    );

    // conversationData now contains:
    // - token: WebRTC JWT token for direct connection
    // - dynamicVariables: User context (name, uuid, etc.) automatically fetched
    console.log("🔍 User context for agent:", conversationData.dynamicVariables);
    // {
    //   user_id: "1711",
    //   user_uuid: "uuid-from-rekeep",
    //   user_name: "Rafał Kowalski",  // Automatically fetched from ReKeep API
    //   user_token: "1711|JPcIqtiocWWw...",
    //   bearer_token: "Bearer 1711|JPcIq...",
    //   conversation_id: "conversation_123"
    // }

    // OPTION A: Using ElevenLabs SDK (Web only)
    const elevenLabsConversationId = await conversation.startSession({
      conversationToken: conversationData.token,        // WebRTC JWT token
      connectionType: conversationData.connectionType, // 'webrtc'
      dynamicVariables: conversationData.dynamicVariables // User context
    });

    // OPTION B: Direct WebRTC (Universal - Web, Flutter, Mobile)
    // Decode JWT token to get WebRTC room info
    const tokenPayload = JSON.parse(atob(conversationData.token.split('.')[1]));
    const roomName = tokenPayload.video.room;
    const permissions = tokenPayload.video;
    
    // Establish direct WebRTC connection without SDK
    const webrtcConnection = await establishDirectWebRTC({
      roomName: roomName,
      permissions: permissions,
      userContext: conversationData.dynamicVariables
    });

    console.log("✅ Started ElevenLabs conversation:", elevenLabsConversationId);
    startVoiceTimer();
    return sessionId;

  } catch (error) {
    console.error("❌ Failed to start ElevenLabs conversation:", error);
    toast.error("Nie udało się połączyć z asystentem głosowym ElevenLabs");
  }
};
```

### 4. Update Voice Usage Tracking

**Before** (frontend/hooks/useVoiceState.ts lines 144-169):
```typescript
const loadVoiceUsage = async () => {
  const response = await fetch('/api/voice-usage', {
    method: 'GET',
    headers: {
      'X-API-TOKEN': userToken,
      'Content-Type': 'application/json',
    },
  });
  // ... complex local logic
};
```

**After**:
```typescript
const loadVoiceUsage = async () => {
  const usage = await voiceServiceClient.getVoiceUsage();
  setDailyVoiceUsage(usage.totalDuration);
  setIsVoiceLimitReached(usage.isLimitReached);
};
```

### 5. Add Agent Selection UI

**New Feature** - Add agent selection to your frontend:

```typescript
// Add to ChatWindow.tsx
const [availableAgents, setAvailableAgents] = useState<VoiceAgent[]>([]);
const [selectedAgent, setSelectedAgent] = useState<string>('agent_1');

// Load agents on component mount
useEffect(() => {
  const loadAgents = async () => {
    const agents = await voiceServiceClient.getAgents();
    setAvailableAgents(agents);
  };
  loadAgents();
}, []);

// Add agent selector to your UI
const AgentSelector = () => (
  <select 
    value={selectedAgent} 
    onChange={(e) => setSelectedAgent(e.target.value)}
    className="agent-selector"
  >
    {availableAgents.map(agent => (
      <option key={agent.id} value={agent.id}>
        {agent.name} - {agent.description}
      </option>
    ))}
  </select>
);
```

### 6. Update Voice Mode Toggle Component

**Update** your VoiceModeToggle to include agent selection:

```typescript
// In VoiceModeToggle component
interface VoiceModeToggleProps {
  // ... existing props
  selectedAgent?: string;
  availableAgents?: VoiceAgent[];
  onAgentChange?: (agentId: string) => void;
}

export function VoiceModeToggle(props: VoiceModeToggleProps) {
  return (
    <div className="voice-mode-toggle">
      {/* Existing mode toggle buttons */}
      
      {/* New agent selection */}
      {props.availableAgents && (
        <select 
          value={props.selectedAgent || 'agent_1'}
          onChange={(e) => props.onAgentChange?.(e.target.value)}
        >
          {props.availableAgents.map(agent => (
            <option key={agent.id} value={agent.id}>
              {agent.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
```

### 7. Update Environment Variables

**Add to your frontend .env**:
```bash
# Voice Service Configuration
NEXT_PUBLIC_VOICE_SERVICE_URL=http://localhost:8080

# Remove these (now handled by Voice Service):
# ELEVENLABS_API_KEY - moved to Voice Service
# ELEVENLABS_AGENT_ID - replaced with agent selection
```

### 8. Remove Deprecated Files

**Delete these files** (now handled by Voice Service):
```
frontend/app/api/elevenlabs-token/route.ts  ❌ DELETE
frontend/app/api/voice-usage/route.ts       ❌ DELETE  
frontend/app/api/voice-usage/add/route.ts   ❌ DELETE
frontend/app/api/voice-usage/today/route.ts ❌ DELETE
```

**Keep these files** (still needed):
```
frontend/hooks/useVoiceState.ts            ✅ KEEP (update to use Voice Service)
frontend/components/ChatWindow.tsx         ✅ KEEP (simplify ElevenLabs logic)
frontend/lib/voice-session-helpers.ts     ✅ KEEP (update to use Voice Service)
```

## 🔄 Testing the Migration

### 1. Start Voice Service
```bash
cd voice-service
yarn install
yarn dev
```

### 2. Update Frontend
```bash
cd frontend
# Update your ChatWindow.tsx with the simplified logic
yarn dev
```

### 3. Test Agent Selection
1. Open your web app
2. Click ElevenLabs voice mode
3. Select different agents from dropdown
4. Verify conversations work with each agent

### 4. Test Multi-Client Support
```bash
# Test the same Voice Service with Flutter client
cd flutter_app
flutter run
```

## 📊 Benefits After Migration

| Before | After |
|--------|--------|
| 195-line token generation API | ✅ Single API call |
| 94-line conversation start logic | ✅ 15-line simplified logic |
| Hardcoded single agent | ✅ 4 selectable agents |
| Web-only support | ✅ Multi-client support (Web, Flutter, Mobile) |
| Complex usage tracking | ✅ Centralized usage management |
| Tightly coupled code | ✅ Clean separation of concerns |
| Manual user context handling | ✅ Automatic user profile fetching |
| ElevenLabs SDK dependency | ✅ Direct WebRTC option (no SDK required) |
| Limited to Web SDK | ✅ Universal WebRTC implementation |

## 🚨 Common Migration Issues

### Issue: "Agent not found"
**Solution**: Ensure AGENT_1_ID, AGENT_2_ID, etc. are set in Voice Service environment

### Issue: "Authentication failed"  
**Solution**: Verify X-API-TOKEN is passed correctly from frontend to Voice Service

### Issue: "Voice Service connection failed"
**Solution**: Check NEXT_PUBLIC_VOICE_SERVICE_URL points to running Voice Service

### Issue: "Dynamic variables missing"
**Solution**: Ensure user.uuid is available (fetched by Voice Service automatically)

## 🎯 Next Steps

1. **Deploy Voice Service** to your production environment
2. **Update mobile apps** to use Voice Service APIs
3. **Add monitoring** for Voice Service health
4. **Scale horizontally** by adding more Voice Service instances

## 📞 Support

If you encounter issues during migration:
1. Check Voice Service logs: `docker-compose logs voice-service`
2. Test Voice Service health: `curl http://localhost:8080/health`
3. Verify agent configuration: `curl http://localhost:8080/api/voice/agents`

---

**Migration Complete!** 🎉 Your ElevenLabs integration is now scalable and multi-client ready.
