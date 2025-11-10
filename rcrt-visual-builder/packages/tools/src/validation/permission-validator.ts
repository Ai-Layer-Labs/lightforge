/**
 * Permission Validator
 * Validates tool permissions for security
 * THE RCRT WAY: Loads trusted tools from breadcrumb (like context-builder's blacklist)
 */

import { RcrtClientEnhanced } from '@rcrt-builder/sdk';

export interface ToolPermissions {
  net?: boolean | string[];
  read?: boolean | string[];
  write?: boolean | string[];
  env?: boolean | string[];
  run?: boolean | string[];
  ffi?: boolean;
  hrtime?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class PermissionValidator {
  private static BLOCKED_DOMAINS = [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '10.',
    '172.16.',
    '192.168.'
  ];
  
  private static MAX_NET_DOMAINS = 5;
  
  // Trusted tools cache (loaded from tool.security.policy.v1 breadcrumb)
  private static trustedToolsCache: Map<string, Set<string>> = new Map();
  private static policyLoaded: boolean = false;
  
  /**
   * Load trusted tools from breadcrumb (THE RCRT WAY)
   * Pattern: Same as context-builder's blacklist loader
   */
  static async loadTrustedTools(client: RcrtClientEnhanced): Promise<void> {
    try {
      const policies = await client.searchBreadcrumbs({
        schema_name: 'tool.security.policy.v1',
        tag: 'system:bootstrap'
      });
      
      if (policies.length === 0) {
        console.warn('⚠️  No tool.security.policy.v1 found - all tools restricted to default sandbox');
        this.policyLoaded = true;
        return;
      }
      
      const policy = await client.getBreadcrumb(policies[0].id);
      const trustedTools = policy.context.trusted_tools || [];
      
      this.trustedToolsCache.clear();
      for (const entry of trustedTools) {
        const allowed = new Set<string>();
        const perms = entry.allowed_permissions || {};
        
        if (perms.net) allowed.add('net');
        if (perms.read) allowed.add('read');
        if (perms.write) allowed.add('write');
        if (perms.run) allowed.add('run');
        if (perms.hrtime) allowed.add('hrtime');
        if (perms.env) allowed.add('env');
        
        this.trustedToolsCache.set(entry.tool_name, allowed);
      }
      
      this.policyLoaded = true;
      console.log(`✅ Tool security policy loaded: ${trustedTools.length} trusted tools`);
      
      if (trustedTools.length > 0) {
        const toolNames = trustedTools.map((t: any) => t.tool_name).join(', ');
        console.log(`   Trusted: ${toolNames}`);
      }
    } catch (error) {
      console.error('❌ Failed to load tool security policy:', error);
      this.policyLoaded = true; // Mark as loaded to prevent retry loops
    }
  }
  
  /**
   * Check if tool is trusted for specific permission
   */
  private static isTrustedForPermission(toolName: string, permission: string): boolean {
    if (!this.policyLoaded) {
      // Policy not loaded yet - deny by default
      return false;
    }
    
    const allowed = this.trustedToolsCache.get(toolName);
    return allowed ? allowed.has(permission) : false;
  }
  
  /**
   * Validate tool permissions (with breadcrumb-based whitelist)
   */
  static validate(permissions: ToolPermissions, toolName?: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Network permissions
    if (permissions.net) {
      if (permissions.net === true) {
        warnings.push('Allowing all network access - consider limiting to specific domains');
      } else if (Array.isArray(permissions.net)) {
        if (permissions.net.length > this.MAX_NET_DOMAINS) {
          errors.push(`Too many network domains (${permissions.net.length}). Maximum: ${this.MAX_NET_DOMAINS}`);
        }
        
        for (const domain of permissions.net) {
          if (this.isBlockedDomain(domain)) {
            errors.push(`Blocked domain: ${domain}. Private/local networks not allowed.`);
          }
        }
      }
    }
    
    // Filesystem read (allowed for trusted tools)
    if (permissions.read) {
      if (!toolName || !this.isTrustedForPermission(toolName, 'read')) {
        errors.push('Filesystem read access not allowed for user-created tools');
      } else {
        warnings.push(`Trusted tool '${toolName}' has filesystem read access (per security policy)`);
      }
    }
    
    // Filesystem write (allowed for trusted tools)
    if (permissions.write) {
      if (!toolName || !this.isTrustedForPermission(toolName, 'write')) {
        errors.push('Filesystem write access not allowed for user-created tools');
      } else {
        warnings.push(`Trusted tool '${toolName}' has filesystem write access (per security policy)`);
      }
    }
    
    // Environment variables (should use context.secrets)
    if (permissions.env) {
      if (!toolName || !this.isTrustedForPermission(toolName, 'env')) {
        warnings.push('Environment variable access detected. Use context.secrets instead.');
      } else {
        warnings.push(`Trusted tool '${toolName}' has environment access (per security policy)`);
      }
    }
    
    // Subprocess execution (allowed for trusted tools like browser automation)
    if (permissions.run) {
      if (!toolName || !this.isTrustedForPermission(toolName, 'run')) {
        errors.push('Subprocess execution not allowed for user-created tools');
      } else {
        warnings.push(`Trusted tool '${toolName}' can execute subprocesses (per security policy)`);
      }
    }
    
    // FFI (never allowed, even for trusted tools)
    if (permissions.ffi) {
      errors.push('FFI (Foreign Function Interface) not allowed');
    }
    
    // High-resolution timing (allowed for trusted tools)
    if (permissions.hrtime) {
      if (!toolName || !this.isTrustedForPermission(toolName, 'hrtime')) {
        errors.push('High-resolution timing not allowed (security risk)');
      } else {
        warnings.push(`Trusted tool '${toolName}' has hrtime access (per security policy)`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  /**
   * Check if domain is blocked
   */
  private static isBlockedDomain(domain: string): boolean {
    const lower = domain.toLowerCase();
    return this.BLOCKED_DOMAINS.some(blocked => lower.includes(blocked));
  }
  
  /**
   * Sanitize permissions (remove invalid/dangerous ones)
   */
  static sanitize(permissions: ToolPermissions): ToolPermissions {
    const sanitized: ToolPermissions = {};
    
    // Only allow specific network domains
    if (Array.isArray(permissions.net)) {
      const validDomains = permissions.net
        .filter(d => !this.isBlockedDomain(d))
        .slice(0, this.MAX_NET_DOMAINS);
      
      if (validDomains.length > 0) {
        sanitized.net = validDomains;
      }
    }
    
    // Never allow filesystem, env, run, ffi, hrtime for user tools
    // (These are always false or undefined in sanitized version)
    
    return sanitized;
  }
}

