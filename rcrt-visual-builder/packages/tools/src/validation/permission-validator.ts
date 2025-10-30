/**
 * Permission Validator
 * Validates tool permissions for security
 */

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
  
  /**
   * Validate tool permissions
   */
  static validate(permissions: ToolPermissions): ValidationResult {
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
    
    // Filesystem permissions (generally not allowed)
    if (permissions.read) {
      errors.push('Filesystem read access not allowed for user-created tools');
    }
    
    if (permissions.write) {
      errors.push('Filesystem write access not allowed for user-created tools');
    }
    
    // Environment variables (should use context.secrets)
    if (permissions.env) {
      warnings.push('Environment variable access detected. Use context.secrets instead.');
    }
    
    // Subprocess execution (not allowed)
    if (permissions.run) {
      errors.push('Subprocess execution not allowed for user-created tools');
    }
    
    // FFI (never allowed)
    if (permissions.ffi) {
      errors.push('FFI (Foreign Function Interface) not allowed');
    }
    
    // High-resolution timing (side-channel attack vector)
    if (permissions.hrtime) {
      errors.push('High-resolution timing not allowed (security risk)');
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

