/**
 * JSON Repair Utility
 * Provides safe JSON parsing with automatic repair of common issues
 */

import { jsonrepair } from 'jsonrepair';

export interface SafeParseOptions {
  /** If true, returns null instead of throwing on unrecoverable errors */
  allowFailure?: boolean;
  /** Custom error handler */
  onError?: (error: Error, input: string) => void;
}

/**
 * Safely parse JSON with automatic repair
 * @param input - The potentially malformed JSON string
 * @param options - Parsing options
 * @returns Parsed JSON object or null if allowFailure is true and parsing fails
 */
export function safeParseJSON<T = any>(input: string, options: SafeParseOptions = {}): T | null {
  try {
    // First try regular parsing for performance
    return JSON.parse(input);
  } catch (firstError) {
    try {
      // If regular parsing fails, try to repair the JSON
      const repaired = jsonrepair(input);
      return JSON.parse(repaired);
    } catch (repairError) {
      const error = new Error(
        `Failed to parse JSON: ${firstError instanceof Error ? firstError.message : 'Unknown error'}. ` +
        `Repair attempt also failed: ${repairError instanceof Error ? repairError.message : 'Unknown error'}`
      );
      
      if (options.onError) {
        options.onError(error, input);
      }
      
      if (options.allowFailure) {
        return null;
      }
      
      throw error;
    }
  }
}

/**
 * Extract and parse JSON from various formats
 * Handles markdown code blocks, JSONP, text wrappers, and finds embedded JSON
 */
export function extractAndParseJSON<T = any>(input: string, options: SafeParseOptions = {}): T | null {
  let content = input.trim();
  
  // Handle markdown code blocks
  const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    content = codeBlockMatch[1];
  }
  
  // Handle JSONP callback notation
  const jsonpMatch = content.match(/^\w+\(([\s\S]*)\)$/);
  if (jsonpMatch) {
    content = jsonpMatch[1];
  }
  
  // Try to extract JSON from text (Claude often wraps JSON in explanatory text)
  // Look for the largest complete JSON object with "action" and "breadcrumb" fields
  const jsonObjectMatch = content.match(/\{[^{}]*"action"[^{}]*"breadcrumb"[\s\S]*?\{[\s\S]*?"schema_name"[\s\S]*?\}[\s\S]*?\}/);
  if (jsonObjectMatch) {
    // Found a JSON object with required fields, try to parse it
    try {
      // Find the complete JSON by counting braces
      let braceCount = 0;
      let startIdx = -1;
      let endIdx = -1;
      
      for (let i = 0; i < content.length; i++) {
        if (content[i] === '{') {
          if (braceCount === 0) startIdx = i;
          braceCount++;
        } else if (content[i] === '}') {
          braceCount--;
          if (braceCount === 0 && startIdx !== -1) {
            endIdx = i + 1;
            // Check if this JSON has required fields
            const candidate = content.substring(startIdx, endIdx);
            if (candidate.includes('"action"') && candidate.includes('"breadcrumb"')) {
              content = candidate;
              break;
            }
          }
        }
      }
    } catch (e) {
      // If extraction fails, continue with original content
    }
  }
  
  return safeParseJSON<T>(content, options);
}

/**
 * Log-friendly JSON parsing that includes context on failure
 */
export function parseJSONWithLogging<T = any>(
  input: string, 
  context: string,
  logger: (message: string) => void = console.log
): T | null {
  return safeParseJSON<T>(input, {
    allowFailure: true,
    onError: (error, originalInput) => {
      logger(`⚠️ JSON parsing failed in ${context}`);
      logger(`   Error: ${error.message}`);
      logger(`   Input preview: ${originalInput.substring(0, 200)}${originalInput.length > 200 ? '...' : ''}`);
    }
  });
}
