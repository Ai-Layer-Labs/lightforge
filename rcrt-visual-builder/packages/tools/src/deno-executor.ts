/**
 * Deno Executor
 * Executes a single tool in sandboxed Deno environment
 */

import { spawn } from 'child_process';
import { ProcessManager, ProcessOptions } from './utils/process-manager';
import { ContextSerializer, ToolExecutionContext } from './context-serializer';

export interface ToolCode {
  language: 'typescript' | 'javascript';
  source: string;
}

export interface ToolLimits {
  timeout_ms: number;
  memory_mb?: number;
  cpu_percent?: number;
}

export interface ToolPermissions {
  net?: boolean | string[];
  read?: boolean | string[];
  write?: boolean | string[];
  env?: boolean | string[];
  run?: boolean | string[];
  ffi?: boolean;
  hrtime?: boolean;
}

export interface ExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
  metadata: {
    duration_ms: number;
    timedOut: boolean;
    exitCode: number | null;
  };
}

export class DenoExecutor {
  private denoPath: string;
  
  constructor(denoPath: string = 'deno') {
    this.denoPath = denoPath;
  }
  
  /**
   * Execute tool code with context
   */
  async execute(
    toolName: string,
    code: ToolCode,
    input: any,
    context: ToolExecutionContext,
    permissions: ToolPermissions,
    limits: ToolLimits
  ): Promise<ExecutionResult> {
    try {
      // Build execution script
      const script = this.buildExecutionScript(code, input, context);
      
      // Build Deno args from permissions
      const args = ProcessManager.buildDenoArgs(permissions);
      
      // Execute with timeout
      // Support both timeout_ms and legacy 'timeout' field
      const timeout_ms = limits.timeout_ms || (limits as any).timeout || 300000;
      const processResult = await ProcessManager.executeWithTimeout(
        this.denoPath,
        args,
        script,
        {
          timeout_ms,
          memory_mb: limits.memory_mb,
          cpu_percent: limits.cpu_percent
        }
      );
      
      // Handle timeout
      if (processResult.timedOut) {
        return {
          success: false,
          error: `Tool execution timed out after ${timeout_ms}ms`,
          metadata: {
            duration_ms: processResult.duration_ms,
            timedOut: true,
            exitCode: processResult.exitCode
          }
        };
      }
      
      // Handle process failure
      if (!processResult.success) {
        return {
          success: false,
          error: processResult.stderr || 'Tool execution failed',
          metadata: {
            duration_ms: processResult.duration_ms,
            timedOut: false,
            exitCode: processResult.exitCode
          }
        };
      }
      
      // Parse result from stdout
      try {
        const result = JSON.parse(processResult.stdout);
        
        return {
          success: true,
          result,
          metadata: {
            duration_ms: processResult.duration_ms,
            timedOut: false,
            exitCode: processResult.exitCode
          }
        };
      } catch (parseError: any) {
        return {
          success: false,
          error: `Failed to parse tool output: ${parseError.message}\n\nStdout: ${processResult.stdout}\n\nStderr: ${processResult.stderr}`,
          metadata: {
            duration_ms: processResult.duration_ms,
            timedOut: false,
            exitCode: processResult.exitCode
          }
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: `Execution error: ${error.message}`,
        metadata: {
          duration_ms: 0,
          timedOut: false,
          exitCode: null
        }
      };
    }
  }
  
  /**
   * Build complete execution script
   */
  private buildExecutionScript(
    code: ToolCode,
    input: any,
    context: ToolExecutionContext
  ): string {
    // Inject context - use inline SDK (Deno doesn't support npm: imports in dynamic code)
    const contextInjection = `
// Injected Context
const CONTEXT_API_BASE_URL = ${JSON.stringify(context.api.baseUrl)};
const CONTEXT_API_TOKEN = ${JSON.stringify(context.api.token)};

${this.generateInlineSDK()}

// Build context object
const context = {
  api,
  secrets: ${JSON.stringify(context.secrets)},
  request: ${JSON.stringify(context.request)},
  utils: ${JSON.stringify(context.utils)}
};

// Input data
const input = ${JSON.stringify(input)};
`;
    
    // Main execution wrapper
    const executionWrapper = `
// Main execution
(async () => {
  try {
    // Execute tool
    const result = await execute(input, context);
    
    // Output result as JSON
    console.log(JSON.stringify(result));
    Deno.exit(0);
  } catch (error) {
    // Output error as JSON
    console.log(JSON.stringify({
      success: false,
      error: error.message,
      error_type: error.name,
      stack: error.stack
    }));
    Deno.exit(1);
  }
})();
`;
    
    // Combine all parts
    return `${contextInjection}\n\n${code.source}\n\n${executionWrapper}`;
  }

  /**
   * Generate inline SDK (copied from sdk-core)
   * We can't use npm: imports in dynamic Deno code, so we inline the SDK
   */
  private generateInlineSDK(): string {
    return `
// RCRT SDK - Inline version for Deno tools
// Auto-synced with @rcrt-builder/sdk-core

class RcrtClient {
  constructor(options) {
    this.baseUrl = (options.baseUrl || options).replace(/\\/$/, '');
    this.token = options.token || options;
  }

  async request(path, init = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(init.headers || {})
    };
    
    if (this.token) {
      headers['Authorization'] = \`Bearer \${this.token}\`;
    }

    const response = await fetch(\`\${this.baseUrl}\${path}\`, {
      ...init,
      headers
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(\`API error \${response.status}: \${error}\`);
    }

    return response.json();
  }

  async getBreadcrumb(id) {
    return this.request(\`/breadcrumbs/\${id}/full\`);
  }

  async createBreadcrumb(data, idempotencyKey) {
    const headers = {};
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
    return this.request('/breadcrumbs', { method: 'POST', headers, body: JSON.stringify(data) });
  }

  async updateBreadcrumb(id, version, updates) {
    return this.request(\`/breadcrumbs/\${id}\`, {
      method: 'PATCH',
      headers: { 'If-Match': version.toString() },
      body: JSON.stringify(updates)
    });
  }

  async deleteBreadcrumb(id, version) {
    const headers = {};
    if (version) headers['If-Match'] = version.toString();
    await this.request(\`/breadcrumbs/\${id}\`, { method: 'DELETE', headers });
  }

  async searchBreadcrumbs(params) {
    const q = new URLSearchParams();
    if (params.schema_name) q.set('schema_name', params.schema_name);
    if (params.tag) q.set('tag', params.tag);
    if (params.limit) q.set('limit', params.limit.toString());
    if (params.offset) q.set('offset', params.offset.toString());
    if (params.include_context) q.set('include_context', 'true');
    return this.request(\`/breadcrumbs?\${q}\`);
  }

  async vectorSearch(params) {
    const q = new URLSearchParams();
    if (params.q) q.set('q', params.q);
    if (params.qvec) q.set('qvec', JSON.stringify(params.qvec));
    if (params.nn) q.set('nn', params.nn.toString());
    if (params.tag) q.set('tag', params.tag);
    if (params.schema_name) q.set('schema_name', params.schema_name);
    q.set('include_context', 'true');
    return this.request(\`/breadcrumbs/search?\${q}\`);
  }

  // ============ LLM-Friendly Operations (v2.3.0) ============

  async addTags(id, tags) {
    return this.request(\`/breadcrumbs/\${id}/tags/add\`, {
      method: 'POST',
      body: JSON.stringify({ tags })
    });
  }

  async removeTags(id, tags) {
    return this.request(\`/breadcrumbs/\${id}/tags/remove\`, {
      method: 'POST',
      body: JSON.stringify({ tags })
    });
  }

  async mergeContext(id, context) {
    return this.request(\`/breadcrumbs/\${id}/context/merge\`, {
      method: 'POST',
      body: JSON.stringify({ context })
    });
  }

  async approveBreadcrumb(id, reason) {
    return this.request(\`/breadcrumbs/\${id}/approve\`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  }

  async rejectBreadcrumb(id, reason) {
    return this.request(\`/breadcrumbs/\${id}/reject\`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  }

  // ============ Secrets ============

  async getSecret(secretId, reason) {
    return this.request(\`/secrets/\${secretId}/decrypt\`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason || 'Tool execution' })
    });
  }

  async listSecrets(scopeType, scopeId) {
    const q = new URLSearchParams();
    if (scopeType) q.set('scope_type', scopeType);
    if (scopeId) q.set('scope_id', scopeId);
    const query = q.toString();
    return this.request(\`/secrets\${query ? \`?\${query}\` : ''}\`);
  }
}

const api = new RcrtClient({ baseUrl: CONTEXT_API_BASE_URL, token: CONTEXT_API_TOKEN });
`;
  }
  
  /**
   * Check if Deno is available
   */
  async checkDeno(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const process = spawn(this.denoPath, ['--version'], {
          stdio: 'pipe'
        });
        
        process.on('exit', (code) => {
          resolve(code === 0);
        });
        
        process.on('error', () => {
          resolve(false);
        });
      } catch {
        resolve(false);
      }
    });
  }
  
  /**
   * Get Deno version
   */
  async getDenoVersion(): Promise<string | null> {
    return new Promise((resolve) => {
      try {
        const process = spawn(this.denoPath, ['--version'], {
          stdio: 'pipe'
        });
        
        let output = '';
        
        process.stdout?.on('data', (data) => {
          output += data.toString();
        });
        
        process.on('exit', () => {
          // Extract version from output
          const match = output.match(/deno\s+(\d+\.\d+\.\d+)/);
          resolve(match ? match[1] : null);
        });
        
        process.on('error', () => {
          resolve(null);
        });
      } catch {
        resolve(null);
      }
    });
  }
}

