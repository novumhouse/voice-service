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
      logger.debug('langfuse_disabled_missing_env', { hasSecret: !!secretKey, hasPublic: !!publicKey, hasHost: !!host });
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
    return singleton;
  } catch (e) {
    logger.warn('langfuse_init_failed', { error: e instanceof Error ? e.message : 'unknown' });
    return null;
  }
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
  if (!client) return;
  try {
    const trace = client.trace({
      name: 'voice-conversation',
      userId: params.userUuid,
      id: params.sessionId,
      input: {
        agentId: params.agentId,
        conversationId: params.conversationId,
        elevenLabsConversationId: params.elevenLabsConversationId,
      },
      metadata: {
        durationSeconds: params.durationSeconds,
        startTime: params.startTime.toISOString(),
        endTime: params.endTime.toISOString(),
        ...params.metadata,
      },
      tags: ['conversation', 'voice'],
    });

    if (params.transcript) {
      // Attach transcript as an observation for searchability
      await trace.event({
        name: 'transcript',
        input: undefined,
        output: params.transcript,
        level: 'DEFAULT',
      });
    }

    if (typeof (client as any).flushAsync === 'function') {
      await (client as any).flushAsync();
    }
    logger.debug('langfuse_trace_created', { sessionId: params.sessionId });
  } catch (e) {
    logger.warn('langfuse_trace_failed', { error: e instanceof Error ? e.message : 'unknown' });
  }
}


