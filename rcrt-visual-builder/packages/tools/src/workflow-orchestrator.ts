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
    const { steps, returnStep, continueOnError = false } = input;
    const results = new Map<string, any>();
    const errors = new Map<string, any>();
    const executionOrder: string[] = [];
    
    console.log(`[Workflow] Starting workflow with ${steps.length} steps`);
    
    // Validate dependencies
    const stepIds = new Set(steps.map(s => s.id));
    for (const step of steps) {
      if (step.dependencies) {
        for (const dep of step.dependencies) {
          if (!stepIds.has(dep)) {
            throw new Error(`Step ${step.id} depends on non-existent step ${dep}`);
          }
        }
      }
    }
    
    // Group steps by dependency level
    const levels = this.topologicalSort(steps);
    
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
          
          // Wait for response
          const response = await this.waitForToolResponse(
            context.rcrtClient,
            requestId,
            30000 // 30 second timeout
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
          console.error(`[Workflow] Step ${step.id} failed:`, error);
          errors.set(step.id, String(error));
          
          if (!continueOnError) {
            throw new Error(`Workflow failed at step ${step.id}: ${error}`);
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
   * Wait for a tool response with the given requestId
   */
  private async waitForToolResponse(
    client: RcrtClientEnhanced,
    requestId: string,
    timeout: number = 30000
  ): Promise<any> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      // Search for response breadcrumb
      const responses = await client.searchBreadcrumbs({
        schema_name: 'tool.response.v1',
        tag: `request:${requestId}`
      });
      
      // Also check by context.request_id
      if (responses.length === 0) {
        const allResponses = await client.searchBreadcrumbs({
          schema_name: 'tool.response.v1'
        });
        
        for (const resp of allResponses) {
          const fullResp = await client.getBreadcrumb(resp.id);
          if (fullResp.context?.request_id === requestId || 
              fullResp.context?.requestId === requestId) {
            return fullResp.context;
          }
        }
      } else {
        const fullResp = await client.getBreadcrumb(responses[0].id);
        return fullResp.context;
      }
      
      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    throw new Error(`Timeout waiting for tool response ${requestId}`);
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
        // Replace ${stepId} or ${stepId.field} with actual values
        return value.replace(/\$\{([^}]+)\}/g, (match, path) => {
          const parts = path.split('.');
          const stepId = parts[0];
          
          if (!results.has(stepId)) {
            return match; // Keep original if not found
          }
          
          let result = results.get(stepId);
          
          // Navigate nested fields
          for (let i = 1; i < parts.length; i++) {
            if (result && typeof result === 'object') {
              result = result[parts[i]];
            } else {
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
      
      for (const [id, step] of remaining) {
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

