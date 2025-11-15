/**
 * Process Manager
 * Manages Deno subprocess lifecycle
 */

import { spawn } from 'child_process';

export interface ProcessOptions {
  timeout_ms: number;
  memory_mb?: number;
  cpu_percent?: number;
}

export interface ProcessResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  duration_ms: number;
  timedOut: boolean;
}

export class ProcessManager {
  /**
   * Execute Deno process with timeout and resource limits
   */
  static async executeWithTimeout(
    denoPath: string,
    args: string[],
    script: string,
    options: ProcessOptions
  ): Promise<ProcessResult> {
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      // Spawn Deno process
      const process = spawn(denoPath, args, {
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let timedOut = false;
      let killed = false;
      let stdout = '';
      let stderr = '';
      let exitCode: number | null = null;
      
      // Set timeout
      const timeout = setTimeout(() => {
        timedOut = true;
        if (!killed) {
          process.kill('SIGTERM');
          killed = true;
        }
      }, options.timeout_ms);
      
      // Collect stdout
      process.stdout?.on('data', (data) => {
        stdout += data.toString();
      });
      
      // Collect stderr
      process.stderr?.on('data', (data) => {
        stderr += data.toString();
      });
      
      // Handle process exit
      process.on('exit', (code) => {
        exitCode = code;
        clearTimeout(timeout);
        
        const duration_ms = Date.now() - startTime;
        
        resolve({
          success: code === 0 && !timedOut,
          stdout,
          stderr,
          exitCode,
          duration_ms,
          timedOut
        });
      });
      
      // Handle process error
      process.on('error', (error) => {
        clearTimeout(timeout);
        
        const duration_ms = Date.now() - startTime;
        
        resolve({
          success: false,
          stdout,
          stderr: stderr + '\n' + error.message,
          exitCode: null,
          duration_ms,
          timedOut
        });
      });
      
      // Write script to stdin
      try {
        process.stdin?.write(script);
        process.stdin?.end();
      } catch (error: any) {
        clearTimeout(timeout);
        
        const duration_ms = Date.now() - startTime;
        
        resolve({
          success: false,
          stdout: '',
          stderr: error.message || 'Failed to write to process stdin',
          exitCode: null,
          duration_ms,
          timedOut
        });
      }
    });
  }
  
  /**
   * Build Deno command args from permissions
   */
  static buildDenoArgs(
    permissions: {
      net?: boolean | string[];
      read?: boolean | string[];
      write?: boolean | string[];
      env?: boolean | string[];
      run?: boolean | string[];
      ffi?: boolean;
      hrtime?: boolean;
    }
  ): string[] {
    const args: string[] = [
      'run',
      '--no-prompt',
      '--no-config'
      // Note: --quiet removed to capture import errors and permission denials
    ];
    
    // Network permissions
    if (permissions.net === true) {
      args.push('--allow-net');
    } else if (Array.isArray(permissions.net) && permissions.net.length > 0) {
      args.push(`--allow-net=${permissions.net.join(',')}`);
    }
    
    // Read permissions (generally not allowed for user tools)
    if (permissions.read === true) {
      args.push('--allow-read');
    } else if (Array.isArray(permissions.read) && permissions.read.length > 0) {
      args.push(`--allow-read=${permissions.read.join(',')}`);
    }
    
    // Write permissions (generally not allowed for user tools)
    if (permissions.write === true) {
      args.push('--allow-write');
    } else if (Array.isArray(permissions.write) && permissions.write.length > 0) {
      args.push(`--allow-write=${permissions.write.join(',')}`);
    }
    
    // Env permissions (should use context.secrets instead)
    if (permissions.env === true) {
      args.push('--allow-env');
    } else if (Array.isArray(permissions.env) && permissions.env.length > 0) {
      args.push(`--allow-env=${permissions.env.join(',')}`);
    }
    
    // Run permissions (generally not allowed)
    if (permissions.run === true) {
      args.push('--allow-run');
    } else if (Array.isArray(permissions.run) && permissions.run.length > 0) {
      args.push(`--allow-run=${permissions.run.join(',')}`);
    }
    
    // FFI permissions (never allowed for user tools)
    if (permissions.ffi) {
      args.push('--allow-ffi');
    }
    
    // Note: hrtime permission removed in Deno 2 (always allowed)
    // if (permissions.hrtime) { args.push('--allow-hrtime'); }
    
    // Read from stdin
    args.push('-');
    
    return args;
  }
}

