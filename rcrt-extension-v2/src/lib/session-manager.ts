/**
 * Session Manager Library
 * THE RCRT WAY: Sessions are managed via agent.context.v1 breadcrumbs
 * Only ONE context breadcrumb should have 'consumer:default-chat-assistant' tag at a time
 */

import type { RCRTClient } from './rcrt-client';
import type { Breadcrumb } from './types';

export interface SessionInfo {
  sessionId: string;
  contextBreadcrumbId: string | null;
  title: string;
  isActive: boolean;
  created_at: string;
  updated_at: string;
  messageCount?: number;
}

/**
 * Ensure only one active context breadcrumb
 * Deactivates all context breadcrumbs, keeping the system in a clean state
 */
export async function ensureSingleActiveContext(client: RCRTClient): Promise<void> {
  try {
    const activeContexts = await client.searchBreadcrumbs({
      schema_name: 'agent.context.v1',
      any_tags: ['consumer:default-chat-assistant']
    });

    if (activeContexts.length > 1) {
      console.warn(`⚠️ Found ${activeContexts.length} active contexts, deactivating all except most recent`);
      
      // Sort by updated_at, keep most recent
      const sorted = activeContexts.sort((a, b) => 
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
      
      // Deactivate all except first
      for (let i = 1; i < sorted.length; i++) {
        await deactivateContext(client, sorted[i]);
      }
      
      console.log(`✅ Kept session active: ${extractSessionIdFromTags(sorted[0].tags)}`);
      return;
    }

    if (activeContexts.length === 0) {
      console.log('ℹ️ No active context breadcrumbs (normal for new extension)');
    } else {
      console.log(`✅ Exactly one active context: ${extractSessionIdFromTags(activeContexts[0].tags)}`);
    }
  } catch (error) {
    console.error('[SessionManager] Failed to ensure single active context:', error);
  }
}

/**
 * Deactivate all active context breadcrumbs
 */
export async function deactivateAllContexts(client: RCRTClient): Promise<void> {
  const activeContexts = await client.searchBreadcrumbs({
    schema_name: 'agent.context.v1',
    any_tags: ['consumer:default-chat-assistant']
  });

  for (const ctx of activeContexts) {
    await deactivateContext(client, ctx);
  }
  
  console.log(`✅ Deactivated ${activeContexts.length} context breadcrumb(s)`);
}

/**
 * Deactivate a specific context breadcrumb
 */
export async function deactivateContext(client: RCRTClient, context: Breadcrumb): Promise<void> {
  try {
    const newTags = context.tags.filter(t => t !== 'consumer:default-chat-assistant');
    
    await client.updateBreadcrumb(context.id, context.version, {
      tags: newTags
    });
    
    console.log(`⏸️ Deactivated context: ${context.id}`);
  } catch (error) {
    console.error('[SessionManager] Failed to deactivate context:', error);
    throw error;
  }
}

/**
 * Activate a specific context breadcrumb
 * Ensures only this one is active by deactivating others first
 */
export async function activateContext(client: RCRTClient, context: Breadcrumb): Promise<void> {
  // FIRST: Deactivate all other contexts (robustness!)
  await deactivateAllContexts(client);
  
  // THEN: Activate this one
  try {
    const newTags = [...context.tags];
    if (!newTags.includes('consumer:default-chat-assistant')) {
      newTags.push('consumer:default-chat-assistant');
    }
    
    await client.updateBreadcrumb(context.id, context.version, {
      tags: newTags
    });
    
    console.log(`▶️ Activated context: ${context.id}`);
  } catch (error) {
    console.error('[SessionManager] Failed to activate context:', error);
    throw error;
  }
}

/**
 * Find context breadcrumb for a specific session
 */
export async function findContextBreadcrumb(
  client: RCRTClient,
  sessionId: string
): Promise<Breadcrumb | null> {
  const contexts = await client.searchBreadcrumbs({
    schema_name: 'agent.context.v1',
    any_tags: [`session:${sessionId}`]
  });

  return contexts.length > 0 ? contexts[0] : null;
}

/**
 * Extract session ID from breadcrumb tags
 * Looks for tag like: session:session-1762277876136
 */
export function extractSessionIdFromTags(tags: string[]): string | null {
  const sessionTag = tags.find(tag => tag.startsWith('session:session-'));
  return sessionTag ? sessionTag.replace('session:', '') : null;
}

/**
 * Load all sessions (from agent.context.v1 breadcrumbs)
 */
export async function loadAllSessions(client: RCRTClient): Promise<SessionInfo[]> {
  try {
    // Get all agent.context.v1 breadcrumbs
    const contexts = await client.searchBreadcrumbs({
      schema_name: 'agent.context.v1',
      any_tags: ['extension:chat']
    });

    // Map to session info
    const sessions: SessionInfo[] = contexts.map(ctx => {
      const sessionId = extractSessionIdFromTags(ctx.tags);
      const isActive = ctx.tags.includes('consumer:default-chat-assistant');
      
      return {
        sessionId: sessionId || 'unknown',
        contextBreadcrumbId: ctx.id,
        title: ctx.title || `Session ${new Date(ctx.created_at).toLocaleTimeString()}`,
        isActive,
        created_at: ctx.created_at,
        updated_at: ctx.updated_at,
        messageCount: 0 // Will be populated if needed
      };
    });

    // Sort by updated_at (most recent first)
    sessions.sort((a, b) => 
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );

    return sessions;
  } catch (error) {
    console.error('[SessionManager] Failed to load sessions:', error);
    return [];
  }
}

/**
 * Create new session
 * Returns timestamp-based session ID
 */
export async function createNewSession(client: RCRTClient): Promise<string> {
  // FIRST: Deactivate all existing contexts (robustness!)
  await deactivateAllContexts(client);
  
  // THEN: Generate new session ID (timestamp-based)
  const sessionId = `session-${Date.now()}`;
  
  console.log(`✅ New session ID created: ${sessionId}`);
  console.log(`   Context breadcrumb will be created by context-builder on first message`);
  
  return sessionId;
}

/**
 * Switch to a different session
 * Pauses current, activates target
 */
export async function switchToSession(
  client: RCRTClient,
  targetSessionId: string,
  currentSessionId: string | null
): Promise<void> {
  try {
    console.log(`🔄 Switching from ${currentSessionId || 'none'} to ${targetSessionId}`);
    
    // FIRST: Deactivate all contexts (robustness!)
    await deactivateAllContexts(client);
    
    // THEN: Activate target session's context (if it exists)
    const targetContext = await findContextBreadcrumb(client, targetSessionId);
    
    if (targetContext) {
      await activateContext(client, targetContext);
      console.log(`✅ Switched to session: ${targetSessionId}`);
    } else {
      console.log(`ℹ️ Target session has no context breadcrumb yet (will be created on first message)`);
    }
  } catch (error) {
    console.error('[SessionManager] Failed to switch session:', error);
    throw error;
  }
}

/**
 * Load conversation history for a session
 * Uses /full endpoint to get complete breadcrumb data
 */
export async function loadSessionHistory(
  client: RCRTClient,
  sessionId: string
): Promise<Breadcrumb[]> {
  try {
    // 1. List all breadcrumbs with session tag
    const breadcrumbs = await client.listBreadcrumbs({
      tag: `session:${sessionId}`
    });

    // 2. Fetch full details using /full endpoint (not LLM-optimized)
    const fullBreadcrumbs = await Promise.all(
      breadcrumbs.map(bc => client.getBreadcrumb(bc.id, true)) // true = use /full
    );

    // 3. Filter to conversation messages
    const conversation = fullBreadcrumbs.filter(bc => 
      bc.schema_name === 'user.message.v1' || 
      bc.schema_name === 'agent.response.v1'
    );

    // 4. Sort by created_at (chronological order)
    conversation.sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    console.log(`📜 Loaded ${conversation.length} messages for session ${sessionId}`);

    return conversation;
  } catch (error) {
    console.error('[SessionManager] Failed to load session history:', error);
    return [];
  }
}

/**
 * Get the currently active session
 */
export async function getActiveSession(client: RCRTClient): Promise<SessionInfo | null> {
  try {
    const activeContexts = await client.searchBreadcrumbs({
      schema_name: 'agent.context.v1',
      any_tags: ['consumer:default-chat-assistant', 'extension:chat']
    });

    if (activeContexts.length === 0) {
      return null;
    }

    if (activeContexts.length > 1) {
      console.warn(`⚠️ Multiple active contexts found, using most recent`);
      activeContexts.sort((a, b) => 
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
    }

    const context = activeContexts[0];
    const sessionId = extractSessionIdFromTags(context.tags);

    return {
      sessionId: sessionId || 'unknown',
      contextBreadcrumbId: context.id,
      title: context.title || `Session ${new Date(context.created_at).toLocaleTimeString()}`,
      isActive: true,
      created_at: context.created_at,
      updated_at: context.updated_at
    };
  } catch (error) {
    console.error('[SessionManager] Failed to get active session:', error);
    return null;
  }
}

