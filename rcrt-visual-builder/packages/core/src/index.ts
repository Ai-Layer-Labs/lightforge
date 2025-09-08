// Core exports for RCRT Visual Builder

// Export all schemas
export * from './schemas';

// Export all types
export * from './types';

// Export validators
export * from './validators';

// Version
export const VERSION = '1.0.0';

// Re-export commonly used types for convenience
export type {
  BreadcrumbBase,
  Selector,
  NodePort,
  Connection,
  Position,
} from './schemas/base';

export type {
  LLMMessage,
  LLMMessagesV1,
  LLMResponseV1,
  ToolCall,
  ToolDefinition,
} from './schemas/llm';

export type {
  NodeTemplateV1,
  NodeInstanceV1,
  NodeRegistryV1,
} from './schemas/node';

export type {
  FlowDefinitionV1,
  FlowNode,
  FlowExecutionStateV1,
} from './schemas/flow';

export type {
  AgentDefinitionV1,
  AgentMemoryV1,
  AgentMetricsV1,
} from './schemas/agent';

export type {
  WorkspaceDefinitionV1,
  ToolsCatalogV1,
  SecretsVaultV1,
} from './schemas/workspace';

export type {
  UIComponentV1,
  UIInstanceV1,
} from './schemas/ui';
