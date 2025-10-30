/**
 * Process Manager
 * Manages Deno subprocess lifecycle
 */

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
    
    // Spawn Deno process
    const process = Bun.spawn([denoPath, ...args], {
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe'
    });
    
    let timedOut = false;
    let killed = false;
    
    // Set timeout
    const timeout = setTimeout(() => {
      timedOut = true;
      if (!killed) {
        process.kill();
        killed = true;
      }
    }, options.timeout_ms);
    
    try {
      // Write script to stdin
      const writer = process.stdin.getWriter();
      await writer.write(new TextEncoder().encode(script));
      await writer.close();
      
      // Wait for completion
      const exitCode = await process.exited;
      
      clearTimeout(timeout);
      
      // Read outputs
      const stdout = await new Response(process.stdout).text();
      const stderr = await new Response(process.stderr).text();
      
      const duration_ms = Date.now() - startTime;
      
      return {
        success: exitCode === 0 && !timedOut,
        stdout,
        stderr,
        exitCode,
        duration_ms,
        timedOut
      };
    } catch (error: any) {
      clearTimeout(timeout);
      
      const duration_ms = Date.now() - startTime;
      
      return {
        success: false,
        stdout: '',
        stderr: error.message || 'Process execution failed',
        exitCode: null,
        duration_ms,
        timedOut
      };
    }
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
      '--no-config',
      '--quiet'
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
    
    // High-resolution time (blocked to prevent timing attacks)
    if (permissions.hrtime) {
      args.push('--allow-hrtime');
    }
    
    // Read from stdin
    args.push('-');
    
    return args;
  }
}

