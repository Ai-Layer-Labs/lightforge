/**
 * Code Validator
 * Validates tool code for safety and correctness
 */

export interface CodeValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class CodeValidator {
  private static DANGEROUS_PATTERNS = [
    /(?<![.$])\beval\s*\(/,  // Block standalone eval(), allow .$eval() and .evaluate()
    /(?<![.$])\bFunction\s*\(/,  // Block Function constructor, allow method names with "Function"
    /require\s*\(/,
    /import\s*\(/,
    /__dirname/,
    /__filename/,
    /process\.(exit|kill|abort)/,
    /child_process/,
    /fs\./,
    /require\s*\(\s*['"]fs['"]\s*\)/
  ];
  
  private static REQUIRED_EXPORTS = ['execute'];
  
  /**
   * Validate tool code
   */
  static validate(code: string, toolName: string): CodeValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Must not be empty
    if (!code || code.trim().length === 0) {
      errors.push('Code cannot be empty');
      return { valid: false, errors, warnings };
    }
    
    // Check for dangerous patterns
    for (const pattern of this.DANGEROUS_PATTERNS) {
      if (pattern.test(code)) {
        errors.push(`Dangerous pattern detected: ${pattern.source}`);
      }
    }
    
    // Must export execute function
    if (!this.hasRequiredExports(code)) {
      errors.push('Code must export an async function named "execute"');
      errors.push('Example: export async function execute(input, context) { ... }');
    }
    
    // Should have Input/Output interfaces
    if (!/interface\s+Input\s*\{/.test(code)) {
      warnings.push('Consider defining an Input interface for type safety');
    }
    
    if (!/interface\s+Output\s*\{/.test(code)) {
      warnings.push('Consider defining an Output interface for type safety');
    }
    
    // Should have error handling
    if (!code.includes('try') && !code.includes('catch')) {
      warnings.push('Consider adding try/catch error handling');
    }
    
    // Should validate input
    if (!code.includes('if (!input')) {
      warnings.push('Consider validating input parameters');
    }
    
    // Warn about console.log (use sparingly)
    const consoleLogCount = (code.match(/console\.log/g) || []).length;
    if (consoleLogCount > 5) {
      warnings.push(`Found ${consoleLogCount} console.log statements - use sparingly`);
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  /**
   * Check if code has required exports
   */
  private static hasRequiredExports(code: string): boolean {
    // Check for: export async function execute
    const hasExecuteExport = /export\s+async\s+function\s+execute\s*\(/.test(code);
    
    return hasExecuteExport;
  }
  
  /**
   * Extract function signature
   */
  static extractExecuteSignature(code: string): string | null {
    const match = code.match(/export\s+async\s+function\s+execute\s*\([^)]*\)/);
    return match ? match[0] : null;
  }
}

