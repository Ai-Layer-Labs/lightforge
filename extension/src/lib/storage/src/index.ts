/**
 * Unified Storage Client Library - Main Export
 *
 * This is the main entry point for the unified storage system. It exports all
 * the managers, types, and utilities needed to use the storage system.
 */

// Import classes for use in factory function
import { UnifiedStorageClient } from './unified-client.js';
import { SettingsManager } from './managers/settings-manager.js';
import { UserDataManager } from './managers/user-data-manager.js';
import { ChatHistoryManager } from './managers/chat-history-manager.js';
import { AnalyticsManager } from './managers/analytics-manager.js';
import type { RetryOptions, CacheOptions, QueueOptions } from './types.js';

// ===================================================================================
// CORE CLIENT AND INFRASTRUCTURE
// ===================================================================================

export { UnifiedStorageClient } from './unified-client.js';
export { CacheManager } from './cache-manager.js';
export { RequestQueue } from './request-queue.js';
export { RetryHandler } from './retry-handler.js';

// ===================================================================================
// DOMAIN-SPECIFIC MANAGERS
// ===================================================================================

export { SettingsManager } from './managers/settings-manager.js';
export { UserDataManager } from './managers/user-data-manager.js';
export { ChatHistoryManager } from './managers/chat-history-manager.js';
export { AnalyticsManager } from './managers/analytics-manager.js';

// ===================================================================================
// TYPES AND INTERFACES
// ===================================================================================

// Core storage types
export type {
  StorageResponse,
  StorageOptions,
  StorageKey,
  ClientConfig,
  TokenManagerCredentials,
  RequestOptions,
  APIResponse,
} from './types.js';

// Error and status types
export type {
  RetryOptions,
  CacheOptions,
  QueueOptions,
  CacheEntry,
  CacheStats,
  QueuedRequest,
  QueueStatus,
} from './types.js';

// Settings types
export type {
  GeneralSettingsConfig,
  AgentModelConfig,
  FirewallConfig,
  LLMProviderConfig,
  SpeechToTextConfig,
  PersonalityGenerationConfig,
  ModelConfig,
  PersonalityTrait,
} from './types.js';

// User data types
export type { UserProfile, UserPreferences, NotificationPreferences, PrivacySettings } from './types.js';

// Chat history types
export type { ChatSession, Message, MessageReaction, MessageAttachment } from './types.js';

// Analytics types
export type {
  AnalyticsEvent,
  UsageRecord,
  PerformanceMetric,
  EventFilter,
  TimeRange,
  UsageStats,
  EventContext,
} from './types.js';

// Migration and validation types
export type {
  MigrationResult,
  CategoryMigrationResult,
  MigrationError,
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from './types.js';

// Enums
export { StorageError, RequestPriority, AgentNameEnum, EventType } from './types.js';

// ===================================================================================
// CONVENIENCE FACTORY FUNCTIONS
// ===================================================================================

/**
 * Creates a fully configured storage client with all managers
 *
 * @param config - Client configuration
 * @returns Object containing the client and all managers
 */
export function createStorageClient(config: {
  baseUrl?: string;
  token: string;
  retryOptions?: RetryOptions;
  cacheOptions?: CacheOptions;
  queueOptions?: QueueOptions;
}) {
  // Create core client
  const client = new UnifiedStorageClient(config);

  // Create all domain managers
  const settings = new SettingsManager(client);
  const userData = new UserDataManager(client);
  const chatHistory = new ChatHistoryManager(client);
  const analytics = new AnalyticsManager(client);

  return {
    // Core client
    client,

    // Domain managers
    settings,
    userData,
    chatHistory,
    analytics,

    // Utility methods
    getCacheStats: () => client.getCacheStats(),
    getQueueStatus: () => client.getQueueStatus(),
    processQueue: () => client.processQueue(),
    invalidateCache: (pattern: string) => client.invalidateCache(pattern),

    // Cleanup
    destroy: () => client.destroy(),
  };
}

/**
 * Type for the complete storage client instance
 */
export type StorageClientInstance = ReturnType<typeof createStorageClient>;

// ===================================================================================
// RE-EXPORT IMPORTANT CLASSES FOR DIRECT USE
// ===================================================================================

// Re-export the main classes for direct instantiation if needed
export { UnifiedStorageClient as Client } from './unified-client.js';
export { SettingsManager as Settings } from './managers/settings-manager.js';
export { UserDataManager as UserData } from './managers/user-data-manager.js';
export { ChatHistoryManager as ChatHistory } from './managers/chat-history-manager.js';
export { AnalyticsManager as Analytics } from './managers/analytics-manager.js';
