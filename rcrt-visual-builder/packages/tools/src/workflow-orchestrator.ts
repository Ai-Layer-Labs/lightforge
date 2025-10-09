/**
 * Workflow Orchestrator Tool
 * Enables chaining of multiple tools with dependencies and variable interpolation
 * Designed collaboratively with the RCRT agent!
 */

import { RCRTTool, ToolExecutionContext } from './index.js';
import { RcrtClientEnhanced } from '@rcrt-builder/sdk';

interface WorkflowStep {
  id: string;
  tool: string;
  input: any;
  dependencies?: string[];
  depends_on?: string[];  // Support both naming conventions
  outputMapping?: Record<string, any>;
}

interface WorkflowInput {
  steps: WorkflowStep[];
  returnStep?: string; // Which step's output to return (default: all)
  continueOnError?: boolean; // Whether to continue if a step fails
}

export class WorkflowOrchestratorTool implements RCRTTool {
  name = 'workflow';
  description = 'Execute multi-step tool workflows with dependencies and variable interpolation';
  category = 'orchestration';
  version = '1.0.0';
  
  examples = [
    {
      title: 'Sequential calculation',
      input: {
        steps: [
          { id: 'num1', tool: 'random', input: { min: 1, max: 10 } },
          { id: 'num2', tool: 'random', input: { min: 1, max: 10 } },
          { 
            id: 'sum', 
            tool: 'calculator', 
            input: { expression: '${num1.numbers[0]} + ${num2.numbers[0]}' },
            dependencies: ['num1', 'num2']
          }
        ]
      },
      output: {
        results: {
          num1: { numbers: [7] },
          num2: { numbers: [3] },
          sum: { result: 10, expression: '7 + 3', formatted: '7 + 3 = 10' }
        },
        executionOrder: ['num1', 'num2', 'sum']
      },
      explanation: 'Dependencies ensure correct execution order. Use ${stepId.field} for variables.'
    },
    {
      title: 'Parallel execution',
      input: {
        steps: [
          { id: 'task1', tool: 'timer', input: { seconds: 1 } },
          { id: 'task2', tool: 'echo', input: { message: 'Running in parallel' } },
          { id: 'task3', tool: 'random', input: { min: 0, max: 100 } }
        ]
      },
      output: {
        results: {
          task1: { waited: 1, message: 'Waited 1 seconds' },
          task2: { echo: 'Running in parallel' },
          task3: { numbers: [42] }
        },
        executionOrder: ['task1', 'task2', 'task3']
      },
      explanation: 'Steps without dependencies run in parallel for better performance'
    }
  ];
  
  inputSchema = {
    type: 'object',
    properties: {
      steps: {
        type: 'array',
        description: 'Array of workflow steps to execute',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Unique identifier for this step' },
            tool: { type: 'string', description: 'Name of the tool to execute' },
            input: { type: 'object', description: 'Input parameters for the tool' },
            dependencies: {
              type: 'array',
              items: { type: 'string' },
              description: 'Step IDs that must complete before this step'
            },
            outputMapping: {
              type: 'object',
              description: 'Map step outputs to input fields for dependent steps'
            }
          },
          required: ['id', 'tool', 'input']
        }
      },
      returnStep: {
        type: 'string',
        description: 'ID of step whose output to return (default: return all)'
      },
      continueOnError: {
        type: 'boolean',
        description: 'Continue workflow even if a step fails',
        default: false
      }
    },
    required: ['steps']
  };
  
  outputSchema = {
    type: 'object',
    properties: {
      results: { type: 'object', description: 'Results from each step' },
      errors: { type: 'object', description: 'Any errors that occurred' },
      executionOrder: { type: 'array', description: 'Order in which steps were executed' }
    }
  };

  async execute(input: WorkflowInput, context: ToolExecutionContext): Promise<any> {
    // Validate input
    if (!input || typeof input !== 'object') {
      throw new Error('Invalid workflow input: must be an object');
    }
    
    if (!input.steps || !Array.isArray(input.steps)) {
      throw new Error(`Invalid workflow input: steps must be an array, got ${typeof input.steps}`);
    }
    
    const { steps, returnStep, continueOnError = false } = input;
    const results = new Map<string, any>();
    const errors = new Map<string, any>();
    const executionOrder: string[] = [];
    
    console.log(`[Workflow] Starting workflow with ${steps.length} steps`);
    
    // Auto-detect dependencies from variable references
    // Support both "dependencies" and "depends_on" field names
    const stepsWithAutoDeps = steps.map(step => ({
      ...step,
      dependencies: step.dependencies || step.depends_on || this.extractDependencies(step.input, steps.map(s => s.id))
    }));
    
    console.log('[Workflow] Dependencies resolved:', 
      stepsWithAutoDeps.map(s => ({ id: s.id, deps: s.dependencies || [] })));
    
    // Validate dependencies
    const stepIds = new Set(stepsWithAutoDeps.map(s => s.id));
    for (const step of stepsWithAutoDeps) {
      if (step.dependencies) {
        for (const dep of step.dependencies) {
          if (!stepIds.has(dep)) {
            throw new Error(`Step ${step.id} depends on non-existent step ${dep}`);
          }
        }
      }
    }
    
    // Group steps by dependency level
    const levels = this.topologicalSort(stepsWithAutoDeps);
    
    // Execute each level
    for (const level of levels) {
      console.log(`[Workflow] Executing level with steps: ${level.map(s => s.id).join(', ')}`);
      
      // Execute steps in parallel within each level
      const levelPromises = level.map(async (step) => {
        try {
          // Check if dependencies have errors (unless continueOnError)
          if (!continueOnError && step.dependencies) {
            for (const dep of step.dependencies) {
              if (errors.has(dep)) {
                throw new Error(`Dependency ${dep} failed`);
              }
            }
          }
          
          // Interpolate variables from previous results
          const interpolatedInput = this.interpolateVariables(
            step.input,
            results,
            step.outputMapping
          );
          
          console.log(`[Workflow] Step ${step.id}: Calling ${step.tool} with`, interpolatedInput);
          
          // Create tool request breadcrumb
          const requestId = `workflow-${step.id}-${Date.now()}`;
          await context.rcrtClient.createBreadcrumb({
            schema_name: 'tool.request.v1',
            title: `Workflow Step: ${step.tool}`,
            tags: ['tool:request', 'workflow:step', context.workspace],
            context: {
              tool: step.tool,
              input: interpolatedInput,
              requestId,
              workflowId: context.requestId,
              stepId: step.id,
              requestedBy: `workflow:${context.agentId}`
            }
          });
          
          // Wait for response (RCRT-Native: via event bridge)
          const response = await this.waitForToolResponse(
            context.rcrtClient,
            requestId,
            60000, // 60 second timeout
            context.waitForEvent // Pass event listener from context
          );
          
          if (response.status === 'error') {
            throw new Error(response.error || 'Tool execution failed');
          }
          
          results.set(step.id, response.output);
          executionOrder.push(step.id);
          
          console.log(`[Workflow] Step ${step.id} completed:`, response.output);
          
          // Emit progress update
          await context.rcrtClient.createBreadcrumb({
            schema_name: 'agent.response.v1',
            title: 'Workflow Progress',
            tags: ['workflow:progress', context.workspace],
            context: {
              message: `Completed step ${step.id} (${step.tool})`,
              stepId: step.id,
              result: response.output,
              workflowId: context.requestId
            }
          });
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`[Workflow] Step ${step.id} failed:`, errorMessage);
          errors.set(step.id, errorMessage);
          
          // Create instructional feedback for agents (RCRT self-teaching!)
          await this.createSystemFeedback(step, errorMessage, results, context);
          
          if (!continueOnError) {
            throw new Error(`Workflow failed at step ${step.id}: ${errorMessage}`);
          }
        }
      });
      
      await Promise.all(levelPromises);
    }
    
    // Prepare final result
    const finalResult = {
      results: Object.fromEntries(results),
      errors: Object.fromEntries(errors),
      executionOrder
    };
    
    // Return specific step result if requested
    if (returnStep) {
      if (results.has(returnStep)) {
        return results.get(returnStep);
      } else if (errors.has(returnStep)) {
        throw new Error(`Requested step ${returnStep} failed: ${errors.get(returnStep)}`);
      } else {
        throw new Error(`Step ${returnStep} not found in results`);
      }
    }
    
    return finalResult;
  }
  
  /**
   * Wait for a tool response with the given requestId (RCRT-Native: Event-Driven)
   */
  private async waitForToolResponse(
    client: RcrtClientEnhanced,
    requestId: string,
    timeout: number = 60000,
    waitForEvent?: (criteria: any, timeout?: number) => Promise<any>
  ): Promise<any> {
    // RCRT-Native: Use event bridge if available
    console.log(`[Workflow] waitForEvent available: ${!!waitForEvent}`);
    
    if (waitForEvent) {
      console.log(`[Workflow] ✅ Using event bridge to wait for ${requestId}`);
      
      try {
        const breadcrumb = await waitForEvent({
          schema_name: 'tool.response.v1',
          request_id: requestId
        }, timeout);
        
        console.log(`[Workflow] ✅ Received event for ${requestId}`);
        return breadcrumb.context;
      } catch (error) {
        console.error(`[Workflow] ⏰ Timeout waiting for ${requestId}:`, error);
        throw new Error(`Timeout waiting for tool response ${requestId}`);
      }
    }
    
    // Fallback to polling (should never happen if system is working correctly!)
    console.warn(`[Workflow] ⚠️  No event bridge available, falling back to polling (NOT RCRT-NATIVE!)`);
    return this.waitForToolResponsePolling(client, requestId, timeout);
  }
  
  /**
   * DEPRECATED: Polling-based wait (not RCRT-native, kept only as emergency fallback)
   */
  private async waitForToolResponsePolling(
    client: RcrtClientEnhanced,
    requestId: string,
    timeout: number = 60000
  ): Promise<any> {
    const startTime = Date.now();
    
    // Initial delay to allow for indexing
    await new Promise(resolve => setTimeout(resolve, 200));
    
    let attemptCount = 0;
    while (Date.now() - startTime < timeout) {
      attemptCount++;
      try {
        // Primary search: by tag
        console.log(`[Workflow] Attempt ${attemptCount}: Searching for response with request_id: ${requestId}`);
        
        // Search by tag (SDK uses 'tag' for single tag search)
        const responsesByTag = await client.searchBreadcrumbs({
          schema_name: 'tool.response.v1',
          tag: `request:${requestId}`
        });
        
        console.log(`[Workflow] Tag search returned ${responsesByTag.length} results`);
        if (responsesByTag.length > 0) {
          console.log(`[Workflow] Response breadcrumb found:`, {
            id: responsesByTag[0].id,
            tags: responsesByTag[0].tags,
            schema: responsesByTag[0].schema_name
          });
        }
        
        if (responsesByTag.length > 0) {
          const fullResp = await client.getBreadcrumb(responsesByTag[0].id);
          console.log(`[Workflow] ✅ Found response for ${requestId} by tag on attempt ${attemptCount}`);
          return fullResp.context;
        }
        
        // Secondary search: check recent responses by context
        console.log(`[Workflow] Tag search failed, trying context-based search...`);
        const recentResponses = await client.searchBreadcrumbs({
          schema_name: 'tool.response.v1'
        });
        
        console.log(`[Workflow] Got ${recentResponses.length} total tool responses`);
        
        // Sort by creation time (most recent first)
        const sortedResponses = recentResponses.sort((a, b) => 
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        ).slice(0, 20); // Only check last 20
        
        console.log(`[Workflow] Checking ${sortedResponses.length} recent responses for request_id match`);
        
        for (const resp of sortedResponses) {
          try {
            const fullResp = await client.getBreadcrumb(resp.id);
            console.log(`[Workflow] Checking breadcrumb ${resp.id}: request_id=${fullResp.context?.request_id}`);
            
            if (fullResp.context?.request_id === requestId || 
                fullResp.context?.requestId === requestId) {
              console.log(`[Workflow] ✅ Found response for ${requestId} by context search on attempt ${attemptCount}`);
              return fullResp.context;
            }
          } catch (e) {
            // Skip if breadcrumb fetch fails
            console.warn(`[Workflow] Failed to fetch breadcrumb ${resp.id}:`, e);
            continue;
          }
        }
      } catch (error) {
        console.warn(`[Workflow] Error searching for response ${requestId}:`, error);
      }
      
      // Wait before retry with exponential backoff
      const waitTime = Math.min(500 * Math.pow(1.5, (Date.now() - startTime) / 5000), 2000);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    // Log diagnostic info on timeout
    console.error(`[Workflow] Timeout waiting for response ${requestId} after ${timeout}ms`);
    throw new Error(`Timeout waiting for tool response ${requestId}`);
  }
  
  /**
   * Extract dependencies by scanning for variable references
   */
  private extractDependencies(input: any, allStepIds: string[]): string[] {
    const deps = new Set<string>();
    
    // Safety check: handle undefined/null input
    if (!input || typeof input !== 'object') {
      return [];
    }
    
    const json = JSON.stringify(input);
    
    // Match ${stepId} or {{stepId}} patterns
    // Fixed regex: properly match both ${...} and {{...}} syntax
    const varPattern = /\$\{([^}]+)\}|\{\{([^}]+)\}\}/g;
    const matches = json.matchAll(varPattern);
    
    for (const match of matches) {
      // match[1] is for ${...}, match[2] is for {{...}}
      const path = match[1] || match[2];
      if (!path) continue;
      
      // Get step ID (before any . or [ )
      const stepId = path.split('.')[0].split('[')[0].trim();
      
      // Only add if it's a valid step ID
      if (allStepIds.includes(stepId)) {
        deps.add(stepId);
      }
    }
    
    const detected = Array.from(deps);
    if (detected.length > 0) {
      console.log(`[Workflow] Auto-detected dependencies for step:`, detected);
    }
    
    return detected;
  }
  
  /**
   * Create system feedback to teach agents about errors (RCRT self-improving!)
   */
  private async createSystemFeedback(
    step: any,
    errorMessage: string,
    results: Map<string, any>,
    context: ToolExecutionContext
  ): Promise<void> {
    try {
      // Analyze the error and provide guidance
      let guidance = '';
      let correctedExample = null;
      
      // Analyze error for any calculator or field access issues
      const availableData = Array.from(results.entries()).map(([id, data]) => ({
        stepId: id,
        fields: Object.keys(data || {}),
        data: data
      }));
      
      // Check for calculator errors
      if (step.tool === 'calculator' || errorMessage.includes('is not defined') || 
          errorMessage.includes('undefined') || errorMessage.includes('not evaluate')) {
        
        guidance = `Workflow step "${step.id}" (${step.tool}) failed.\n\n` +
          `Error: ${errorMessage}\n\n` +
          `Available data from completed steps:\n` +
          availableData.map(({ stepId, fields, data }) => {
            const preview = JSON.stringify(data).slice(0, 100);
            return `- \${${stepId}}: { ${fields.join(', ')} }\n  Preview: ${preview}`;
          }).join('\n') + '\n\n' +
          `Your input: ${JSON.stringify(step.input, null, 2)}\n\n` +
          `Common issue: Check field access paths.\n` +
          `Example: If random tool returns { numbers: [42] }, use \${stepId.numbers[0]} not \${stepId.output}`;
        
        // Try to auto-correct common mistakes
        if (step.tool === 'calculator' && step.input?.expression) {
          const expr = step.input.expression;
          let corrected = expr;
          
          // Fix .output, .output.value, .result.number patterns
          // This intelligently maps wrong field access to actual data structure
          corrected = corrected.replace(/\$\{(\w+)\.output(\.[\w]+)?\}/g, (match: string, id: string, _subfield: string) => {
            const data = results.get(id);
            if (!data) return match;
            
            console.log(`[Workflow] Auto-correcting: ${match} for stepId=${id}, data=`, data);
            
            // Check actual structure and map to correct field
            if (data.numbers !== undefined) return `\${${id}.numbers[0]}`;
            if (data.result !== undefined) return `\${${id}.result}`;
            if (data.value !== undefined) return `\${${id}.value}`;
            if (data.echo !== undefined) return `\${${id}.echo}`;
            if (data.waited !== undefined) return `\${${id}.waited}`;
            
            // Return first number-like field
            const firstNum = Object.entries(data).find(([_k, v]) => typeof v === 'number');
            if (firstNum) return `\${${id}.${firstNum[0]}}`;
            
            // Return first array field's first element
            const firstArr = Object.entries(data).find(([_k, v]) => Array.isArray(v));
            if (firstArr) return `\${${id}.${firstArr[0]}[0]}`;
            
            return match;
          });
          
          // Also fix .result and .result.number patterns
          corrected = corrected.replace(/\$\{(\w+)\.result(\.[\w]+)?\}/g, (match: string, id: string, _subfield: string) => {
            const data = results.get(id);
            if (!data) return match;
            
            console.log(`[Workflow] Auto-correcting .result pattern: ${match} for stepId=${id}, data=`, data);
            
            // If data has .result field, that's correct
            if (data.result !== undefined) {
              return _subfield ? match : `\${${id}.result}`;
            }
            
            // Otherwise map to actual structure
            if (data.numbers !== undefined) return `\${${id}.numbers[0]}`;
            if (data.echo !== undefined) return `\${${id}.echo}`;
            if (data.waited !== undefined) return `\${${id}.waited}`;
            
            return match;
          });
          
          if (corrected !== expr) {
            correctedExample = corrected;
            guidance += `\n\n✅ SUGGESTED FIX:\n"${corrected}"\n\n` +
              `Explanation: The random tool returns { numbers: [array] }, not { output: value }.`;
          }
        }
      }
      
      // Create system.message breadcrumb for agent to learn from
      await context.rcrtClient.createBreadcrumb({
        schema_name: 'system.message.v1',
        title: 'Workflow Error Guidance',
        tags: ['system:message', 'workflow:error', 'agent:learning', context.workspace],
        context: {
          type: 'error_guidance',
          source: 'workflow-tool',
          targetAgent: context.agentId,
          error: {
            step: step.id,
            tool: step.tool,
            message: errorMessage
          },
          guidance: guidance,
          availableData: Array.from(results.entries()).map(([id, data]) => ({
            stepId: id,
            data: data
          })),
          correctedExample: correctedExample,
          timestamp: new Date().toISOString()
        }
      });
      
      console.log(`[Workflow] 📚 Created system feedback for agent learning`);
      
    } catch (feedbackError) {
      console.warn('[Workflow] Failed to create system feedback:', feedbackError);
      // Don't fail the workflow if feedback creation fails
    }
  }
  
  /**
   * Interpolate variables in the input using results from previous steps
   */
  private interpolateVariables(
    input: any,
    results: Map<string, any>,
    outputMapping?: Record<string, any>
  ): any {
    const interpolate = (value: any): any => {
      if (typeof value === 'string') {
        // First, convert {{variable}} syntax to ${variable} for compatibility
        let normalizedValue = value;
        if (value.includes('{{')) {
          normalizedValue = value.replace(/\{\{([^}]+)\}\}/g, '${$1}');
          console.log(`[Workflow] Auto-converted variable syntax: "${value}" → "${normalizedValue}"`);
        }
        
        // Replace ${stepId} or ${stepId.field} with actual values
        return normalizedValue.replace(/\$\{([^}]+)\}/g, (match, path) => {
          // Handle both numbers[0] and numbers.[0] syntax
          path = path.replace(/\.\[/g, '[');  // Fix .[ → [
          
          const parts = path.split('.');
          const stepId = parts[0];
          
          if (!results.has(stepId)) {
            return match; // Keep original if not found
          }
          
          let result = results.get(stepId);
          
          // Navigate nested fields
          let originalPath = path;
          for (let i = 1; i < parts.length; i++) {
            if (result && typeof result === 'object') {
              // Handle array index notation like array[0]
              const arrayMatch = parts[i].match(/^(.+)\[(\d+)\]$/);
              if (arrayMatch) {
                const [, fieldName, index] = arrayMatch;
                result = result[fieldName];
                if (Array.isArray(result)) {
                  result = result[parseInt(index, 10)];
                }
              } else {
                result = result[parts[i]];
              }
            } else {
              // Field doesn't exist - try smart mapping!
              result = undefined;
              break;
            }
          }
          
          // Smart auto-correction if field doesn't exist
          if (result === undefined && parts.length > 1) {
            const actualData = results.get(stepId);
            const attemptedField = parts.slice(1).join('.');
            
            console.log(`[Workflow] Field "${attemptedField}" not found in ${stepId}, attempting smart mapping...`);
            console.log(`[Workflow] Actual data structure:`, actualData);
            
            // Common wrong patterns → correct mappings
            if (attemptedField.match(/^output(\.value)?$/)) {
              // ${stepId.output} or ${stepId.output.value}
              if (actualData.numbers !== undefined) {
                result = actualData.numbers[0];
                console.log(`[Workflow] ✅ Auto-corrected ${stepId}.${attemptedField} → ${stepId}.numbers[0] = ${result}`);
              } else if (actualData.result !== undefined) {
                result = actualData.result;
                console.log(`[Workflow] ✅ Auto-corrected ${stepId}.${attemptedField} → ${stepId}.result = ${result}`);
              } else if (actualData.echo !== undefined) {
                result = actualData.echo;
                console.log(`[Workflow] ✅ Auto-corrected ${stepId}.${attemptedField} → ${stepId}.echo = ${result}`);
              }
            } else if (attemptedField.match(/^result(\.number)?$/)) {
              // ${stepId.result} or ${stepId.result.number}
              if (actualData.result !== undefined) {
                result = actualData.result;
                console.log(`[Workflow] ✅ Field ${stepId}.result exists = ${result}`);
              } else if (actualData.numbers !== undefined) {
                result = actualData.numbers[0];
                console.log(`[Workflow] ✅ Auto-corrected ${stepId}.${attemptedField} → ${stepId}.numbers[0] = ${result}`);
              }
            }
            
            // If still undefined, return the match (will likely cause error later)
            if (result === undefined) {
              console.warn(`[Workflow] ⚠️ Could not auto-correct ${originalPath}, available fields:`, Object.keys(actualData || {}));
              return match;
            }
          }
          
          return String(result);
        });
      } else if (Array.isArray(value)) {
        return value.map(v => interpolate(v));
      } else if (value && typeof value === 'object') {
        const interpolated: any = {};
        for (const [key, val] of Object.entries(value)) {
          interpolated[key] = interpolate(val);
        }
        return interpolated;
      }
      return value;
    };
    
    let interpolatedInput = interpolate(input);
    
    // Apply output mapping if provided
    if (outputMapping) {
      for (const [sourceRef, targetField] of Object.entries(outputMapping)) {
        const [stepId, ...fieldPath] = sourceRef.split('.');
        if (results.has(stepId)) {
          let value = results.get(stepId);
          for (const field of fieldPath) {
            if (value && typeof value === 'object') {
              value = value[field];
            }
          }
          // Set the mapped value
          if (typeof targetField === 'string') {
            interpolatedInput[targetField] = value;
          }
        }
      }
    }
    
    return interpolatedInput;
  }
  
  /**
   * Sort steps by dependency levels for execution
   */
  private topologicalSort(steps: WorkflowStep[]): WorkflowStep[][] {
    const levels: WorkflowStep[][] = [];
    const remaining = new Map(steps.map(s => [s.id, s]));
    const completed = new Set<string>();
    
    while (remaining.size > 0) {
      const currentLevel: WorkflowStep[] = [];
      
      for (const [, step] of remaining) {
        // Check if all dependencies are completed
        const ready = !step.dependencies || 
          step.dependencies.every(dep => completed.has(dep));
        
        if (ready) {
          currentLevel.push(step);
        }
      }
      
      if (currentLevel.length === 0) {
        throw new Error('Circular dependency detected in workflow');
      }
      
      // Remove from remaining and add to completed
      for (const step of currentLevel) {
        remaining.delete(step.id);
        completed.add(step.id);
      }
      
      levels.push(currentLevel);
    }
    
    return levels;
  }
}

// Export for registration
export const workflowOrchestrator = new WorkflowOrchestratorTool();

