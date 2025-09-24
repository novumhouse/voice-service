import Langfuse from 'langfuse';
import { logger } from './logger.js';

let singleton: Langfuse | null = null;

function getClient(): Langfuse | null {
  try {
    if (singleton) return singleton;
    const secretKey = process.env.LANGFUSE_SECRET_KEY;
    const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
    const host = process.env.LANGFUSE_BASEURL || process.env.LANGFUSE_HOST; // support both

    if (!secretKey || !publicKey || !host) {
      logger.warn('langfuse_disabled_missing_env', { hasSecret: !!secretKey, hasPublic: !!publicKey, hasHost: !!host });
      return null;
    }

    singleton = new Langfuse({
      secretKey,
      publicKey,
      baseUrl: host,
      release: process.env.APP_RELEASE,
      environment: process.env.NODE_ENV || 'development',
      enabled: true,
    });
    logger.info('langfuse_client_initialized', { host, env: process.env.NODE_ENV || 'development' });
    return singleton;
  } catch (e) {
    logger.warn('langfuse_init_failed', { error: e instanceof Error ? e.message : 'unknown' });
    return null;
  }
}

function toTimestamp(totalSeconds: number | undefined): string | undefined {
  if (typeof totalSeconds !== 'number' || !isFinite(totalSeconds)) return undefined;
  const sec = Math.max(0, Math.floor(totalSeconds));
  const mm = String(Math.floor(sec / 60)).padStart(2, '0');
  const ss = String(sec % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function formatTranscriptPlain(transcript: unknown): string | null {
  if (!Array.isArray(transcript)) return null;
  const lines: string[] = [];
  for (const item of transcript as Array<Record<string, unknown>>) {
    const roleRaw = (item?.role as string) || '';
    const speaker = roleRaw === 'user' ? 'User' : roleRaw === 'agent' ? 'AI' : (roleRaw || 'Unknown');
    const message = typeof item?.message === 'string' ? item.message : '';
    const ts = toTimestamp(typeof item?.time_in_call_secs === 'number' ? (item.time_in_call_secs as number) : undefined);
    const prefix = ts ? `[${ts}] ${speaker}` : speaker;
    if (message) {
      lines.push(`${prefix}: ${message}`);
    }
  }
  return lines.length > 0 ? lines.join('\n') : null;
}

export async function createEndConversationTrace(params: {
  sessionId: string;
  userUuid: string;
  agentId: string;
  conversationId: string;
  elevenLabsConversationId?: string;
  durationSeconds: number;
  startTime: Date;
  endTime: Date;
  transcript?: unknown;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const client = getClient();
  if (!client) {
    logger.warn('langfuse_trace_skipped_no_client', { sessionId: params.sessionId, reason: 'no_client' });
    return;
  }
  try {
    logger.info('langfuse_trace_start', {
      sessionId: params.sessionId,
      userUuid: params.userUuid,
      agentId: params.agentId,
      conversationId: params.conversationId,
      hasTranscript: params.transcript != null,
    });
    const lfSessionId = params.elevenLabsConversationId || params.conversationId || params.sessionId;
    const baseTags = ['conversation', 'voice'];
    const clientTypeTag = typeof (params.metadata as any)?.clientType === 'string' && (params.metadata as any).clientType.trim()
      ? (params.metadata as any).clientType.trim()
      : undefined;

    const trace = client.trace({
      name: 'voice-conversation',
      userId: params.userUuid,
      id: params.sessionId,
      sessionId: lfSessionId,
      input: {
        agentId: params.agentId,
        conversationId: params.conversationId,
        elevenLabsConversationId: params.elevenLabsConversationId,
      },
      metadata: {
        durationSeconds: params.durationSeconds,
        startTime: params.startTime.toISOString(),
        endTime: params.endTime.toISOString(),
        // mirrored columns for convenience in Langfuse filters
        total_cost_cents: (params.metadata as any)?.elevenlabs_cost ?? null,
        duration_seconds: params.durationSeconds,
        ...params.metadata,
      },
      tags: clientTypeTag ? [...baseTags, clientTypeTag] : baseTags,
    });

    if (params.transcript) {
      // Attach transcript as an observation for searchability
      await trace.event({
        name: 'transcript',
        input: undefined,
        output: params.transcript,
        level: 'DEFAULT',
      });
      const length = Array.isArray(params.transcript) ? (params.transcript as unknown[]).length : undefined;
      logger.info('langfuse_transcript_attached', { sessionId: params.sessionId, length });

      // Also attach a human-readable conversation view
      const pretty = formatTranscriptPlain(params.transcript);
      if (pretty) {
        await trace.event({
          name: 'conversation',
          input: undefined,
          output: pretty,
          level: 'DEFAULT',
        });
        logger.info('langfuse_transcript_pretty_attached', { sessionId: params.sessionId, length });
      }
    }

    if (typeof (client as any).flushAsync === 'function') {
      await (client as any).flushAsync();
    }
    logger.info('langfuse_trace_created', { sessionId: params.sessionId });
  } catch (e) {
    logger.warn('langfuse_trace_failed', { error: e instanceof Error ? e.message : 'unknown' });
  }
}


