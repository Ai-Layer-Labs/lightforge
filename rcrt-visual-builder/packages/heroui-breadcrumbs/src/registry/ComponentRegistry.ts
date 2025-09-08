/**
 * Component Registry
 * Maps component types to React components
 */

import { ComponentType } from 'react';

export class ComponentRegistryClass {
  private components: Map<string, ComponentType<any>> = new Map();
  
  /**
   * Register a component
   */
  register(type: string, component: ComponentType<any>) {
    this.components.set(type, component);
  }
  
  /**
   * Get a component by type
   */
  get(type: string): ComponentType<any> | undefined {
    return this.components.get(type);
  }
  
  /**
   * Check if a component is registered
   */
  has(type: string): boolean {
    return this.components.has(type);
  }
  
  /**
   * Get all registered component types
   */
  getTypes(): string[] {
    return Array.from(this.components.keys());
  }
  
  /**
   * Clear all registrations
   */
  clear() {
    this.components.clear();
  }
  
  /**
   * Batch register components
   */
  registerBatch(components: Record<string, ComponentType<any>>) {
    Object.entries(components).forEach(([type, component]) => {
      this.register(type, component);
    });
  }
}

// Singleton instance
export const ComponentRegistry = new ComponentRegistryClass();

// Export a convenience function for batch registration
export function registerComponents(components: Record<string, ComponentType<any>>) {
  ComponentRegistry.registerBatch(components);
}
