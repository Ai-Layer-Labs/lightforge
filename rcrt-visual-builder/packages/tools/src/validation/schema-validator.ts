/**
 * Schema Validator
 * Validates JSON schemas for tool input/output
 */

export interface SchemaValidationResult {
  valid: boolean;
  errors: string[];
}

export class SchemaValidator {
  /**
   * Validate a JSON schema
   */
  static validate(schema: any, schemaType: 'input' | 'output'): SchemaValidationResult {
    const errors: string[] = [];
    
    // Must be an object
    if (!schema || typeof schema !== 'object') {
      errors.push(`${schemaType} schema must be an object`);
      return { valid: false, errors };
    }
    
    // Must have 'type' property
    if (!schema.type) {
      errors.push(`${schemaType} schema must have a 'type' property`);
    }
    
    // For object types, should have properties
    if (schema.type === 'object') {
      if (!schema.properties || typeof schema.properties !== 'object') {
        errors.push(`${schemaType} schema with type 'object' should have 'properties'`);
      } else {
        // Validate each property
        for (const [key, value] of Object.entries(schema.properties)) {
          if (!value || typeof value !== 'object') {
            errors.push(`Invalid property definition for '${key}'`);
            continue;
          }
          
          const prop = value as any;
          
          // Each property should have a type
          if (!prop.type) {
            errors.push(`Property '${key}' must have a 'type'`);
          }
          
          // Each property should have a description
          if (!prop.description) {
            errors.push(`Property '${key}' should have a 'description'`);
          }
        }
      }
      
      // Required fields should exist in properties
      if (schema.required && Array.isArray(schema.required)) {
        for (const requiredField of schema.required) {
          if (!schema.properties || !schema.properties[requiredField]) {
            errors.push(`Required field '${requiredField}' not found in properties`);
          }
        }
      }
    }
    
    // For array types, should have items
    if (schema.type === 'array') {
      if (!schema.items) {
        errors.push(`${schemaType} schema with type 'array' must have 'items'`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Validate tool examples
   */
  static validateExamples(
    examples: any[],
    inputSchema: any,
    outputSchema: any
  ): SchemaValidationResult {
    const errors: string[] = [];
    
    if (!Array.isArray(examples)) {
      errors.push('Examples must be an array');
      return { valid: false, errors };
    }
    
    if (examples.length === 0) {
      errors.push('At least one example is required');
    }
    
    for (let i = 0; i < examples.length; i++) {
      const example = examples[i];
      
      if (!example || typeof example !== 'object') {
        errors.push(`Example ${i} must be an object`);
        continue;
      }
      
      // Should have description
      if (!example.description) {
        errors.push(`Example ${i} should have a 'description'`);
      }
      
      // Should have input
      if (example.input === undefined) {
        errors.push(`Example ${i} must have 'input'`);
      }
      
      // Should have output
      if (example.output === undefined) {
        errors.push(`Example ${i} must have 'output'`);
      }
      
      // Should have explanation
      if (!example.explanation) {
        errors.push(`Example ${i} should have an 'explanation'`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}

