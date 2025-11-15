/**
 * Context Serializer
 * Builds serializable execution context for Deno tools
 * Provides HTTP API wrapper for RCRT operations
 */

import { RcrtClientEnhanced } from '@rcrt-builder/sdk';

/**
 * Tool execution context passed to Deno process
 * Must be fully serializable (JSON-compatible)
 */
export interface ToolExecutionContext {
  // HTTP API for RCRT operations
  api: {
    baseUrl: string;
    token: string;
  };
  
  // Secrets (decrypted by tools-runner before passing)
  secrets: Record<string, string>;
  
  // Request metadata
  request: {
    id: string;
    workspace: string;
    agentId?: string;
    trigger_event?: any;
  };
  
  // Utility functions available in context
  utils: {
    waitForEventSupported: boolean;
  };
}

/**
 * Context serializer class
 * Converts RcrtClientEnhanced and secrets into serializable context
 */
export class ContextSerializer {
  constructor(
    private client: RcrtClientEnhanced,
    private workspace: string
  ) {}
  
  /**
   * Build execution context for a tool
   */
  async buildContext(
    requestId: string,
    agentId: string | undefined,
    requiredSecrets: string[],
    triggerEvent?: any
  ): Promise<ToolExecutionContext> {
    // Get authentication token
    const token = await this.client.getToken();
    if (!token) {
      throw new Error('No authentication token available');
    }
    
    // Fetch required secrets
    const secrets: Record<string, string> = {};
    for (const secretName of requiredSecrets) {
      try {
        const decrypted = await this.getSecret(secretName);
        secrets[secretName] = decrypted;
      } catch (error) {
        console.warn(`Failed to load secret ${secretName}:`, error);
        // Continue - tool will handle missing secret
      }
    }
    
    // Build serializable context
    return {
      api: {
        baseUrl: this.client['baseUrl'], // Access private property
        token
      },
      secrets,
      request: {
        id: requestId,
        workspace: this.workspace,
        agentId,
        trigger_event: triggerEvent
      },
      utils: {
        waitForEventSupported: false // Will be implemented in Phase 5
      }
    };
  }
  
  /**
   * Get secret by name
   * First tries RCRT secrets API, falls back to env vars
   */
  private async getSecret(secretName: string): Promise<string> {
    try {
      // Try to find secret breadcrumb by name
      // Get all secrets for the authenticated owner (no scope filtering needed)
      const secrets = await this.client.listSecrets();
      const secret = secrets.find(s => s.name === secretName);
      
      if (secret) {
        const decrypted = await this.client.getSecret(
          secret.id,
          `ToolExecution:${secretName}`
        );
        return decrypted.value;
      }
    } catch (error) {
      console.warn(`RCRT secrets lookup failed for ${secretName}:`, error);
    }
    
    // Fallback to environment variables
    const envValue = process.env[secretName];
    if (envValue) {
      return envValue;
    }
    
    throw new Error(`Secret not found: ${secretName}`);
  }
  
  // REMOVED: generateContextApiWrapper() - 175 lines deleted!
  // Now generated inline in deno-executor.ts with all v2.3.0 methods
}

