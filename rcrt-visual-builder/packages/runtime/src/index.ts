/**
 * RCRT Runtime Package
 * Flow and agent execution runtime
 */

// Export only agent executor for now (flow executor has node-sdk dependency issues)
export { AgentExecutor, AgentExecutorOptions } from './agent/agent-executor';

// Export tool prompt adapter (temporary until server implements context transforms)
export { ToolPromptAdapter, ToolInfo, ToolCatalogBreadcrumb } from './agent/tool-prompt-adapter';

// Re-export SSE client wrapper
export { SSEClient } from './sse/sse-client';
