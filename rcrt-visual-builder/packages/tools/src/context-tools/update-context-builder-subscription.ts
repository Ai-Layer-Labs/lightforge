/**
 * Update context-builder tool to have proper subscriptions
 * This makes it work like any other auto-triggered tool
 */

import { RcrtClientEnhanced } from '@rcrt-builder/sdk';

/**
 * Update context-builder tool.v1 to include subscription that matches
 * all context.config.v1 breadcrumbs
 */
export async function updateContextBuilderSubscription(
  client: RcrtClientEnhanced,
  workspace: string
): Promise<void> {
  try {
    // Find context-builder tool.v1
    const tools = await client.searchBreadcrumbs({
      schema_name: 'tool.v1',
      tag: 'tool:context-builder'
    });
    
    if (tools.length === 0) {
      console.warn('⚠️ context-builder tool.v1 not found');
      return;
    }
    
    const tool = await client.getBreadcrumb(tools[0].id);
    
    // Add subscriptions to context-builder
    const updatedContext = {
      ...tool.context,
      subscriptions: {
        comment: 'context-builder auto-triggers when context configs exist',
        selectors: [
          {
            comment: 'React to user messages and update all registered agent contexts',
            schema_name: 'user.message.v1',
            any_tags: ['user:message', 'extension:chat']
          },
          {
            comment: 'React to tool responses and update relevant agent contexts',
            schema_name: 'tool.response.v1',
            all_tags: ['workspace:tools']
          },
          {
            comment: 'Discover new context.config.v1 breadcrumbs',
            schema_name: 'context.config.v1'
          }
        ]
      }
    };
    
    await client.updateBreadcrumb(tools[0].id, tool.version, {
      context: updatedContext
    });
    
    console.log('✅ Updated context-builder with subscriptions');
    
  } catch (error) {
    console.error('Failed to update context-builder subscriptions:', error);
  }
}

