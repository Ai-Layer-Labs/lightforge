/**
 * Secrets Provider Node
 * Manages and provides secrets to other nodes
 */

import { BaseNode, RegisterNode, NodeExecutionResult } from '@rcrt-builder/node-sdk';

@RegisterNode({
  schema_name: "node.template.v1",
  title: "Secrets Provider Node",
  tags: ["node:template", "security", "secrets"],
  context: {
    node_type: "SecretsNode",
    category: "security",
    icon: "🔐",
    color: "#dc2626",
    description: "Provide secrets and credentials to nodes"
  }
})
export class SecretsNode extends BaseNode {
  private secretsCache: Map<string, string> = new Map();
  private lastRefresh: Date | null = null;
  private refreshInterval = 300000; // 5 minutes
  
  getMetadata() {
    return {
      type: 'SecretsNode',
      category: 'security',
      icon: '🔐',
      inputs: [
        { id: 'request', type: 'data', schema: 'secrets.request.v1' }
      ],
      outputs: [
        { id: 'credentials', type: 'data', schema: 'secrets.credentials.v1' },
        { id: 'passthrough', type: 'data', description: 'Original request for chaining' }
      ]
    };
  }
  
  validateConfig(config: any): boolean {
    return !!config.secrets_breadcrumb_id || !!config.secrets_selector || !!config.vault_id;
  }
  
  async execute(inputs: Record<string, any>): Promise<NodeExecutionResult> {
    const { request } = inputs;
    const requestedKeys = request?.keys || [];
    const optionalKeys = request?.optional || [];
    const credentials: Record<string, any> = {};
    
    // Refresh cache if needed
    if (this.shouldRefreshCache()) {
      await this.loadSecrets();
    }
    
    // Provide requested secrets
    const missingKeys: string[] = [];
    for (const key of requestedKeys) {
      const secret = this.secretsCache.get(key);
      if (!secret && !optionalKeys.includes(key)) {
        missingKeys.push(key);
      }
      if (secret) {
        credentials[key] = secret;
      }
    }
    
    // Handle missing required secrets
    if (missingKeys.length > 0) {
      // Log security event
      await this.createBreadcrumb({
        schema_name: 'security.alert.v1',
        title: 'Missing Required Secrets',
        tags: ['security:alert', 'secrets:missing', this.context.workspace],
        context: {
          missing_keys: missingKeys,
          requesting_node: request?.node_id,
          timestamp: new Date().toISOString()
        }
      });
      
      throw new Error(`Required secrets not found: ${missingKeys.join(', ')}`);
    }
    
    // Log access audit (without exposing secrets)
    await this.createBreadcrumb({
      schema_name: 'secrets.access.v1',
      title: 'Secrets Accessed',
      tags: ['security:audit', 'secrets:access', this.context.workspace],
      context: {
        requested_keys: requestedKeys,
        provided_keys: Object.keys(credentials),
        requesting_node: request?.node_id || 'unknown',
        timestamp: new Date().toISOString(),
        access_granted: true
      }
    });
    
    return {
      outputs: {
        credentials,
        passthrough: request
      }
    };
  }
  
  private shouldRefreshCache(): boolean {
    if (this.secretsCache.size === 0) return true;
    if (!this.lastRefresh) return true;
    
    const now = new Date();
    const timeSinceRefresh = now.getTime() - this.lastRefresh.getTime();
    return timeSinceRefresh > this.refreshInterval;
  }
  
  private async loadSecrets() {
    try {
      // Clear existing cache
      this.secretsCache.clear();
      
      // Load from native RCRT secrets service if vault ID is provided
      if (this.context.config.vault_id) {
        await this.loadFromVault(this.context.config.vault_id);
      }
      // Load from vault tag
      else if (this.context.config.vault_tag) {
        await this.loadFromVaultTag(this.context.config.vault_tag);
      }
      // Load from breadcrumb selector (legacy method)
      else if (this.context.config.secrets_selector) {
        await this.loadFromBreadcrumbs(this.context.config.secrets_selector);
      }
      // Load from specific breadcrumb ID
      else if (this.context.config.secrets_breadcrumb_id) {
        await this.loadFromBreadcrumb(this.context.config.secrets_breadcrumb_id);
      }
      
      this.lastRefresh = new Date();
      
      // Log refresh event
      await this.createBreadcrumb({
        schema_name: 'secrets.refresh.v1',
        title: 'Secrets Cache Refreshed',
        tags: ['security:audit', 'secrets:refresh', this.context.workspace],
        context: {
          secrets_count: this.secretsCache.size,
          refresh_time: this.lastRefresh.toISOString(),
          node_id: this.context.breadcrumb_id
        }
      });
    } catch (error: any) {
      // Log error but don't expose details
      await this.createBreadcrumb({
        schema_name: 'security.error.v1',
        title: 'Secrets Load Failed',
        tags: ['security:error', 'secrets:load', this.context.workspace],
        context: {
          error_type: error.name,
          timestamp: new Date().toISOString(),
          node_id: this.context.breadcrumb_id
        }
      });
      
      throw new Error('Failed to load secrets');
    }
  }
  
  private async loadFromVault(vaultId: string) {
    // This would use RCRT's native secrets service
    // For now, we'll simulate with a breadcrumb lookup
    const vaultBreadcrumb = await this.getBreadcrumb(vaultId);
    
    if (vaultBreadcrumb.schema_name === 'secrets.vault.v1') {
      const secretIds = vaultBreadcrumb.context.secret_ids || {};
      
      // In a real implementation, these IDs would be used to fetch
      // encrypted secrets from RCRT's native service
      for (const [key, secretId] of Object.entries(secretIds)) {
        // Simulated secret fetch - in production this would be encrypted
        const secret = await this.fetchSecret(secretId as string);
        if (secret) {
          this.cacheSecret(key, secret);
        }
      }
    }
  }
  
  private async loadFromVaultTag(vaultTag: string) {
    const vaults = await this.searchWorkspace({
      tag: vaultTag,
      schema_name: 'secrets.vault.v1'
    });
    
    for (const vault of vaults) {
      await this.loadFromVault(vault.id);
    }
  }
  
  private async loadFromBreadcrumbs(selector: any) {
    const secretsBreadcrumbs = await this.searchWorkspace({
      ...selector,
      tag: this.context.workspace
    });
    
    for (const sb of secretsBreadcrumbs) {
      const full = await this.getBreadcrumb(sb.id);
      if (full.context.secrets) {
        this.cacheSecrets(full.context.secrets);
      }
    }
  }
  
  private async loadFromBreadcrumb(breadcrumbId: string) {
    const breadcrumb = await this.getBreadcrumb(breadcrumbId);
    if (breadcrumb.context.secrets) {
      this.cacheSecrets(breadcrumb.context.secrets);
    } else if (breadcrumb.context.secret_ids) {
      // Load from vault format
      await this.loadFromVault(breadcrumbId);
    }
  }
  
  private async fetchSecret(secretId: string): Promise<string | null> {
    // In production, this would use RCRT's native secrets service
    // with proper encryption/decryption
    try {
      // Simulated secret fetch
      const secretBreadcrumb = await this.getBreadcrumb(secretId);
      return secretBreadcrumb.context.value || null;
    } catch {
      return null;
    }
  }
  
  private cacheSecret(key: string, value: string) {
    this.secretsCache.set(key, value);
  }
  
  private cacheSecrets(secrets: Record<string, string>) {
    for (const [key, value] of Object.entries(secrets)) {
      this.secretsCache.set(key, value);
    }
  }
  
  async destroy() {
    // Clear secrets from memory on node destruction
    this.secretsCache.clear();
    this.lastRefresh = null;
    
    // Log cleanup
    await this.createBreadcrumb({
      schema_name: 'security.audit.v1',
      title: 'Secrets Node Destroyed',
      tags: ['security:audit', 'secrets:cleanup', this.context.workspace],
      context: {
        node_id: this.context.breadcrumb_id,
        timestamp: new Date().toISOString()
      }
    });
  }
}
