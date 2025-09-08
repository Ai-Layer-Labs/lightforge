/**
 * Router LLM Node
 * Routes requests to different outputs based on content analysis
 */

import { RegisterNode, NodeMetadata, NodeExecutionResult } from '@rcrt-builder/node-sdk';
import { LLMNode } from './base-llm-node';

interface Route {
  name: string;
  description: string;
  conditions?: string;
}

@RegisterNode({
  schema_name: 'node.template.v1',
  title: 'Router LLM Node',
  tags: ['node:template', 'llm', 'router'],
  context: {
    node_type: 'RouterLLMNode',
    category: 'llm',
    icon: '🔀',
    color: '#f31260',
  },
})
export class RouterLLMNode extends LLMNode {
  getMetadata(): NodeMetadata {
    const base = super.getMetadata();
    
    // Dynamic outputs based on routes
    const routes: Route[] = this.context.config.routes || [];
    const outputs = [
      {
        id: 'response',
        type: 'response',
        schema: 'llm.response.v1',
        description: 'LLM routing decision',
      },
      {
        id: 'selected_route',
        type: 'data',
        description: 'Selected route name',
      },
    ];
    
    // Add an output port for each route
    for (const route of routes) {
      outputs.push({
        id: `route_${route.name}`,
        type: 'event',
        description: `Activated when ${route.name} is selected`,
        optional: true,
      });
    }
    
    return {
      ...base,
      type: 'RouterLLMNode',
      icon: '🔀',
      color: '#f31260',
      description: 'Routes requests based on content analysis',
      outputs,
    };
  }
  
  validateConfig(config: any): boolean {
    if (!super.validateConfig(config)) {
      return false;
    }
    
    // Routes are required
    if (!config.routes || !Array.isArray(config.routes) || config.routes.length === 0) {
      return false;
    }
    
    // Validate each route
    for (const route of config.routes) {
      if (!route.name || !route.description) {
        return false;
      }
    }
    
    return true;
  }
  
  async execute(inputs: Record<string, any>): Promise<NodeExecutionResult> {
    // Prepare routing prompt
    const routes: Route[] = this.context.config.routes;
    const routingStrategy = this.context.config.routing_strategy || 'best_match';
    
    // Build system prompt for routing
    let systemPrompt = this.buildRoutingPrompt(routes, routingStrategy);
    
    // Override system prompt
    const originalPrompt = this.context.config.system_prompt;
    this.context.config.system_prompt = this.context.config.system_prompt_template
      ? this.context.config.system_prompt_template
          .replace('{routes}', this.formatRoutes(routes))
      : systemPrompt;
    
    // Execute base LLM
    const result = await super.execute(inputs);
    
    // Restore original prompt
    this.context.config.system_prompt = originalPrompt;
    
    // Parse routing decision
    if (result.outputs.response) {
      const content = result.outputs.response.content;
      const selectedRoute = this.parseRoute(content, routes);
      
      // Add routing metadata
      result.outputs.response.metadata = {
        ...result.outputs.response.metadata,
        routing: {
          routes: routes.map(r => r.name),
          selected: selectedRoute,
          strategy: routingStrategy,
        },
      };
      
      // Set selected route output
      result.outputs.selected_route = selectedRoute;
      
      // Activate the corresponding route output
      if (selectedRoute) {
        result.outputs[`route_${selectedRoute}`] = {
          activated: true,
          timestamp: new Date().toISOString(),
        };
      }
      
      // Set all other routes as inactive
      for (const route of routes) {
        if (route.name !== selectedRoute) {
          result.outputs[`route_${route.name}`] = {
            activated: false,
          };
        }
      }
    }
    
    return result;
  }
  
  private buildRoutingPrompt(routes: Route[], strategy: string): string {
    let prompt = 'You are a routing system that directs requests to the appropriate destination.\n\n';
    prompt += 'Available routes:\n';
    
    for (const route of routes) {
      prompt += `- ${route.name}: ${route.description}`;
      if (route.conditions) {
        prompt += ` (Conditions: ${route.conditions})`;
      }
      prompt += '\n';
    }
    
    switch (strategy) {
      case 'best_match':
        prompt += '\nAnalyze the input and select the single best matching route. Return only the route name.';
        break;
        
      case 'first_match':
        prompt += '\nSelect the first route that matches the input criteria. Return only the route name.';
        break;
        
      case 'weighted':
        prompt += '\nReturn a JSON object with route names as keys and confidence scores (0-1) as values.';
        break;
        
      case 'fallback':
        prompt += `\nSelect the best matching route, or "${routes[routes.length - 1].name}" if no clear match. Return only the route name.`;
        break;
        
      default:
        prompt += '\nSelect the appropriate route and return only the route name.';
    }
    
    return prompt;
  }
  
  private formatRoutes(routes: Route[]): string {
    return routes
      .map(r => `${r.name}: ${r.description}`)
      .join(', ');
  }
  
  private parseRoute(content: string, routes: Route[]): string | null {
    const cleaned = content.trim().toLowerCase();
    const routeNames = routes.map(r => r.name.toLowerCase());
    
    // Try exact match first
    for (const route of routes) {
      if (cleaned === route.name.toLowerCase()) {
        return route.name;
      }
    }
    
    // Try contains match
    for (const route of routes) {
      if (cleaned.includes(route.name.toLowerCase())) {
        return route.name;
      }
    }
    
    // Try parsing as JSON for weighted strategy
    try {
      const parsed = JSON.parse(content);
      if (typeof parsed === 'object') {
        // Find highest confidence route
        let bestRoute = null;
        let bestScore = 0;
        
        for (const [routeName, score] of Object.entries(parsed)) {
          if (typeof score === 'number' && score > bestScore) {
            bestScore = score;
            bestRoute = routeName;
          }
        }
        
        if (bestRoute) {
          // Find matching route (case-insensitive)
          const match = routes.find(r => r.name.toLowerCase() === bestRoute.toLowerCase());
          return match ? match.name : null;
        }
      }
    } catch {
      // Not JSON, continue with other parsing methods
    }
    
    // Fallback to first route if configured
    if (this.context.config.default_route) {
      const defaultRoute = routes.find(r => r.name === this.context.config.default_route);
      return defaultRoute ? defaultRoute.name : null;
    }
    
    return null;
  }
}
