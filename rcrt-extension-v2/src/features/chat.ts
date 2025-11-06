/**
 * Chat Feature
 * Send messages and receive agent responses
 */

import type { RCRTClient } from '../lib/rcrt-client';
import type { Message } from '../lib/types';

/**
 * Send a message to chat
 */
export async function sendMessage(
  client: RCRTClient,
  content: string,
  conversationId: string
): Promise<void> {
  // Create user.message.v1 breadcrumb
  await client.createBreadcrumb({
    schema_name: 'user.message.v1',
    title: 'User Message',
    tags: ['user:message', `conversation:${conversationId}`],
    context: {
      content,
      conversation_id: conversationId,
      timestamp: new Date().toISOString()
    }
  });

  // Agent will automatically respond via SSE
}

/**
 * Subscribe to agent responses for a conversation
 */
export async function subscribeToResponses(
  client: RCRTClient,
  conversationId: string,
  onResponse: (message: Message) => void
): Promise<() => void> {
  return await client.subscribeToSSE(
    {
      schema_name: 'agent.response.v1',
      any_tags: [`conversation:${conversationId}`]
    },
    (event) => {
      const response = event.breadcrumb;
      onResponse({
        id: response.id,
        role: 'assistant',
        content: response.context.content || response.context.text || '',
        timestamp: Date.now(),
        conversation_id: conversationId
      });
    }
  );
}

/**
 * Add current page to conversation context
 */
export async function addPageToContext(
  client: RCRTClient,
  conversationId: string
): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab) return;

  // Get active tab context breadcrumb
  const results = await client.searchBreadcrumbs({
    schema_name: 'browser.tab.context.v1',
    any_tags: ['browser:active-tab'],
    limit: 1
  });

  if (results.length > 0) {
    const tabContext = results[0];
    
    // Create context breadcrumb for conversation
    await client.createBreadcrumb({
      schema_name: 'conversation.context.v1',
      title: `Page Context: ${tabContext.context.title}`,
      tags: [`conversation:${conversationId}`, 'context:page'],
      context: {
        conversation_id: conversationId,
        page_title: tabContext.context.title,
        page_url: tabContext.context.url,
        page_content: tabContext.context.content.mainText,
        added_at: new Date().toISOString()
      }
    });
  }
}

