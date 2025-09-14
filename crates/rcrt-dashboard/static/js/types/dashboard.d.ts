/**
 * TypeScript definitions for RCRT Dashboard
 * These types make the codebase TypeScript-ready for future migration
 */

// ============ CORE DATA TYPES ============

export interface Breadcrumb {
  id: string;
  title: string;
  tags: string[];
  version: number;
  updated_at: string;
  schema_name?: string;
  context?: Record<string, any>;
}

export interface Agent {
  id: string;
  roles: AgentRole[];
  created_at: string;
}

export type AgentRole = 'curator' | 'emitter' | 'subscriber';

export interface Tool {
  id: string;
  name: string;
  description: string;
  category: string;
  status: 'active' | 'inactive';
  index: number;
}

export interface Subscription {
  id: string;
  agent_id: string;
  selector: BreadcrumbSelector;
}

export interface BreadcrumbSelector {
  any_tags?: string[];
  all_tags?: string[];
  schema_name?: string;
  context_match?: ContextMatch[];
}

export interface ContextMatch {
  path: string;
  op: string;
  value: any;
}

// ============ UI STATE TYPES ============

export interface NodePosition {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CanvasTransform {
  x: number;
  y: number;
}

export interface EventLogEntry {
  type: string;
  breadcrumb_id?: string;
  title?: string;
  tags?: string[];
  timestamp: string;
  schema_name?: string;
  context?: Record<string, any>;
  displayTime: string;
  rawEventData: string;
}

// ============ 3D TYPES ============

export interface SemanticCluster {
  llm: ClusterInfo;
  system: ClusterInfo;
  ui: ClusterInfo;
  tools: ClusterInfo;
  agents: ClusterInfo;
  misc: ClusterInfo;
}

export interface ClusterInfo {
  center: [number, number, number];
  items: any[];
}

export interface SemanticPosition {
  item: any;
  position: [number, number, number];
  cluster: string;
}

// ============ CONNECTION TYPES ============

export interface Connection {
  agent?: string;
  tool?: string;
  breadcrumb: string;
  line: HTMLElement;
  type?: 'tool-creation';
}

// ============ API RESPONSE TYPES ============

export interface CreateBreadcrumbResponse {
  id: string;
  version: number;
}

export interface BulkDeleteProgress {
  processed: number;
  total: number;
  successes: number;
  failures: number;
  error?: string;
}

export interface BulkDeleteResult {
  successCount: number;
  failedCount: number;
}

export interface HygieneResult {
  ttl_purged: number;
  health_checks_purged: number;
  expired_purged: number;
}

export interface AuthTokenResponse {
  token: string;
  rcrt_base_url?: string;
}

// ============ STATE LISTENER TYPES ============

export type StateChangeCallback<T = any> = (value: T, key: string) => void;

export type UnsubscribeFunction = () => void;

// ============ MODULE INTERFACE TYPES ============

export interface DashboardModule {
  init(): void;
  cleanup?(): void;
}

export interface CanvasEngineInterface extends DashboardModule {
  canvas: HTMLElement;
  canvasContainer: HTMLElement;
  updateCanvasSize(): void;
  updateCanvasTransform(): void;
  centerViewOnContent(): void;
  resetView(): void;
  resetNodePositions(): void;
  clear(): void;
  showLoading(message?: string): void;
  showError(message: string): void;
}

export interface ThreeDEngineInterface extends DashboardModule {
  scene: THREE.Scene | null;
  camera: THREE.Camera | null;
  renderer: THREE.WebGLRenderer | null;
  controls: any | null;
  toggle3DView(): void;
  render3DView(): void;
  cleanup3DScene(): void;
  handle3DResize(): void;
}

// ============ TEMPLATE TYPES ============

export interface BreadcrumbTemplate {
  title: string;
  context: Record<string, any>;
  tags: string[];
}

export interface ToolRequest {
  tool: string;
  input: Record<string, any>;
}

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface LLMInput {
  messages: LLMMessage[];
  model: string;
  temperature: number;
  max_tokens: number;
}

// ============ LEGACY COMPATIBILITY ============

export interface LegacyDashboardAPI {
  selectBreadcrumbForDetails(id: string): Promise<void>;
  selectAgentForDetails(agent: Agent): void;
  refreshData(): Promise<void>;
  resetView(): void;
  resetNodePositions(): void;
  centerView(): void;
  toggleTagFilter(tag: string): void;
  clearFilters(): void;
  applyFilters(): void;
  editBreadcrumbById(id: string): void;
  editAgentById(id: string): void;
  showAdminPanel(): Promise<void>;
  toggle3DView(): Promise<void>;
  state: DashboardState;
  api: ApiClient;
}

// ============ GLOBAL WINDOW EXTENSIONS ============

declare global {
  interface Window {
    dashboard: LegacyDashboardAPI;
    adminManager?: any;
    crudManager?: any;
    chatManager?: any;
    eventStreamManager?: any;
    THREE: any;
  }
}
