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
      const processResult = await ProcessManager.executeWithTimeout(
        this.denoPath,
        args,
        script,
        {
          timeout_ms: limits.timeout_ms,
          memory_mb: limits.memory_mb,
          cpu_percent: limits.cpu_percent
        }
      );
      
      // Handle timeout
      if (processResult.timedOut) {
        return {
          success: false,
          error: `Tool execution timed out after ${limits.timeout_ms}ms`,
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
    // Inject context as global constants
    const contextInjection = `
// Injected Context
const CONTEXT_API_BASE_URL = ${JSON.stringify(context.api.baseUrl)};
const CONTEXT_API_TOKEN = ${JSON.stringify(context.api.token)};

${ContextSerializer.generateContextApiWrapper()}

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

