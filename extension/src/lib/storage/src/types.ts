/**
 * Comprehensive TypeScript types for Unified Storage Client Library
 *
 * This file defines all interfaces, types, and enums used throughout the storage system.
 * Includes core storage types, domain-specific interfaces, offline queuing, and error handling.
 */

// ===================================================================================
// CORE STORAGE TYPES
// ===================================================================================

export interface StorageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: StorageError;
  timestamp: Date;
  cached?: boolean;
  source?: 'cache' | 'api' | 'queue';
}

export interface StorageOptions {
  ttl?: number; // Time-to-live in milliseconds
  skipCache?: boolean;
  retryCount?: number;
  timeout?: number;
  priority?: RequestPriority;
}

export type StorageKey = string;

export enum StorageError {
  NETWORK_ERROR = 'network_error',
  AUTHENTICATION_ERROR = 'authentication_error',
  VALIDATION_ERROR = 'validation_error',
  NOT_FOUND = 'not_found',
  SERVER_ERROR = 'server_error',
  TIMEOUT_ERROR = 'timeout_error',
  QUEUE_FULL = 'queue_full',
  CACHE_ERROR = 'cache_error',
}

export enum RequestPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3,
}

// ===================================================================================
// CACHE TYPES
// ===================================================================================

export interface CacheEntry<T = unknown> {
  data: T;
  timestamp: Date;
  ttl: number;
  accessCount: number;
  lastAccess: Date;
  size: number;
}

export interface CacheStats {
  totalEntries: number;
  memoryUsage: number;
  hitRate: number;
  missCount: number;
  evictionCount: number;
  oldestEntry?: Date;
  newestEntry?: Date;
}

// ===================================================================================
// REQUEST QUEUE TYPES
// ===================================================================================

export interface QueuedRequest {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  endpoint: string;
  data?: unknown;
  options?: StorageOptions;
  timestamp: Date;
  retryCount: number;
  priority: RequestPriority;
  maxRetries: number;
  lastError?: string;
}

export interface QueueStatus {
  totalRequests: number;
  pendingRequests: number;
  failedRequests: number;
  processingRequests: number;
  isOnline: boolean;
  lastProcessed?: Date;
  averageProcessingTime?: number;
}

// ===================================================================================
// AUTHENTICATION TYPES
// ===================================================================================

export interface TokenManagerCredentials {
  token: string;
  refreshToken?: string;
  expiresAt?: Date;
  baseUrl: string;
}

export interface ClientConfig {
  baseUrl?: string;
  token: string;
  retryOptions?: RetryOptions;
  cacheOptions?: CacheOptions;
  queueOptions?: QueueOptions;
}

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  exponentialBase?: number;
  retryableErrors?: StorageError[];
}

export interface CacheOptions {
  maxSize?: number;
  defaultTtl?: number;
  maxMemoryUsage?: number;
  cleanupInterval?: number;
}

export interface QueueOptions {
  maxQueueSize?: number;
  processingBatchSize?: number;
  processingInterval?: number;
  persistQueue?: boolean;
}

// ===================================================================================
// SETTINGS TYPES
// ===================================================================================

export interface GeneralSettingsConfig {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  notifications: boolean;
  autoSave: boolean;
  debugMode: boolean;
  analyticsEnabled: boolean;
  maxConcurrentRequests: number;
  requestTimeout: number;
  // Legacy compatibility properties
  replayHistoricalTasks?: boolean;
  minWaitPageLoad?: number;
  displayHighlights?: boolean;
  maxSteps?: number;
  maxFailures?: number;
  maxActionsPerStep?: number;
}

export interface AgentModelConfig {
  [agentName: string]: ModelConfig;
}

export interface ModelConfig {
  provider: string;
  model: string;
  temperature: number;
  maxTokens: number;
  enabled: boolean;
  customEndpoint?: string;
  apiKey?: string;
  // Legacy compatibility properties
  modelName?: string;
  model_name?: string; // API snake_case format
  reasoningEffort?: string;
  reasoning_effort?: string; // API snake_case format
  parameters?: Record<string, unknown>;
}

export enum AgentNameEnum {
  WEB_NAVIGATOR = 'web-navigator',
  CONTENT_ANALYZER = 'content-analyzer',
  TASK_MANAGER = 'task-manager',
  RESEARCH_ASSISTANT = 'research-assistant',
  DATA_PROCESSOR = 'data-processor',
  // Legacy compatibility aliases (with different values to avoid duplicates)
  Navigator = 'navigator',
  Planner = 'planner',
  Validator = 'validator',
}

export enum ProviderTypeEnum {
  OpenAI = 'openai',
  Anthropic = 'anthropic',
  Google = 'google',
  Gemini = 'gemini',
  XAI = 'xai',
  Grok = 'grok',
  Groq = 'groq',
  Cerebras = 'cerebras',
  Ollama = 'ollama',
  DeepSeek = 'deepseek',
  OpenRouter = 'openrouter',
  AzureOpenAI = 'azure_openai',
  CustomOpenAI = 'custom_openai',
}

export interface FirewallConfig {
  enabled: boolean;
  allowedDomains: string[];
  blockedDomains: string[];
  allowFileUploads: boolean;
  allowExternalAPIs: boolean;
  rateLimiting: {
    requestsPerMinute: number;
    burstLimit: number;
  };
  contentFiltering: {
    enabled: boolean;
    blockedKeywords: string[];
    scanImages: boolean;
  };
  // Legacy compatibility properties
  allowList?: string[];
  denyList?: string[];
}

export interface LLMProviderConfig {
  [providerName: string]: {
    name: string;
    type?: string; // Legacy compatibility - provider type
    baseUrl: string;
    apiKey?: string;
    models: string[];
    enabled: boolean;
    rateLimits?: {
      requestsPerMinute: number;
      tokensPerMinute: number;
    };
    // Legacy Azure-specific properties
    azureDeploymentNames?: string[];
  };
}

export interface SpeechToTextConfig {
  provider: 'browser' | 'openai' | 'google';
  language: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  confidence: number;
}

export interface PersonalityGenerationConfig {
  enabled: boolean;
  basePersonality: string;
  traits: PersonalityTrait[];
  adaptationRate: number;
  contextWindow: number;
}

export interface PersonalityTrait {
  name: string;
  value: number; // -1 to 1
  weight: number; // 0 to 1
}

// ===================================================================================
// USER DATA TYPES
// ===================================================================================

export interface UserProfile {
  id: string;
  username: string;
  email?: string;
  displayName: string;
  avatar?: string;
  preferences: UserPreferences;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  timezone: string;
  dateFormat: string;
  notifications: NotificationPreferences;
  privacy: PrivacySettings;
}

export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  desktop: boolean;
  sound: boolean;
  frequency: 'immediate' | 'hourly' | 'daily' | 'weekly';
}

export interface PrivacySettings {
  shareAnalytics: boolean;
  shareUsageData: boolean;
  allowPersonalization: boolean;
  dataRetentionDays: number;
}

// ===================================================================================
// CHAT HISTORY TYPES
// ===================================================================================

export interface ChatSession {
  id: string;
  title: string;
  type: 'general' | 'research' | 'analysis' | 'support';
  participantCount: number;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
  lastActivity: Date;
  metadata: Record<string, unknown>;
  tags: string[];
  isArchived: boolean;
}

export interface Message {
  id: string;
  sessionId: string;
  senderId: string;
  senderType: 'user' | 'agent' | 'system';
  content: string;
  contentType: 'text' | 'markdown' | 'html' | 'code' | 'image' | 'file';
  timestamp: Date;
  editedAt?: Date;
  replyToId?: string;
  reactions: MessageReaction[];
  attachments: MessageAttachment[];
  metadata: Record<string, unknown>;
  isDeleted: boolean;
  isImportant: boolean;
}

export interface MessageReaction {
  emoji: string;
  count: number;
  users: string[];
}

export interface MessageAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  thumbnail?: string;
}

// ===================================================================================
// ANALYTICS TYPES
// ===================================================================================

export interface AnalyticsEvent {
  id: string;
  type: EventType;
  category: string;
  action: string;
  label?: string;
  value?: number;
  userId?: string;
  sessionId?: string;
  timestamp: Date;
  properties: Record<string, unknown>;
  context: EventContext;
}

export enum EventType {
  USER_ACTION = 'user_action',
  SYSTEM_EVENT = 'system_event',
  ERROR_EVENT = 'error_event',
  PERFORMANCE_EVENT = 'performance_event',
  BUSINESS_EVENT = 'business_event',
}

export interface EventContext {
  userAgent: string;
  platform: string;
  version: string;
  url?: string;
  referrer?: string;
  viewport?: {
    width: number;
    height: number;
  };
}

export interface UsageRecord {
  id: string;
  userId?: string;
  feature: string;
  component: string;
  action: string;
  duration?: number;
  count: number;
  timestamp: Date;
  metadata: Record<string, unknown>;
}

export interface PerformanceMetric {
  id: string;
  component: string;
  metric: string;
  value: number;
  unit: 'ms' | 'bytes' | 'count' | 'percentage' | 'ratio';
  timestamp: Date;
  tags: Record<string, string>;
  threshold?: {
    warning: number;
    critical: number;
  };
}

export interface EventFilter {
  startDate?: Date;
  endDate?: Date;
  eventType?: EventType;
  category?: string;
  action?: string;
  userId?: string;
  limit?: number;
  offset?: number;
}

export interface TimeRange {
  start: Date;
  end: Date;
  granularity?: 'hour' | 'day' | 'week' | 'month';
}

export interface UsageStats {
  totalEvents: number;
  uniqueUsers: number;
  topFeatures: Array<{
    feature: string;
    count: number;
    percentage: number;
  }>;
  timeRange: TimeRange;
  trends: Array<{
    date: Date;
    count: number;
  }>;
}

// ===================================================================================
// API TYPES
// ===================================================================================

export interface RequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
}

export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    timestamp: Date;
    requestId: string;
    version: string;
  };
}

// ===================================================================================
// MIGRATION TYPES
// ===================================================================================

export interface MigrationResult {
  results: CategoryMigrationResult[];
  totalMigrated: number;
  totalErrors: number;
  duration: number;
  timestamp: Date;
}

export interface CategoryMigrationResult {
  category: string;
  recordCount: number;
  successCount: number;
  errorCount: number;
  errors: MigrationError[];
}

export interface MigrationError {
  key: string;
  error: string;
  originalValue?: unknown;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  summary: {
    totalChecked: number;
    passed: number;
    failed: number;
  };
}

export interface ValidationError {
  category: string;
  key: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export interface ValidationWarning {
  category: string;
  message: string;
  suggestion?: string;
}
