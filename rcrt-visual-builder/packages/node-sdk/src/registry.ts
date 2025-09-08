/**
 * Node Registry System
 * Manages node templates and auto-discovery
 */

import { RcrtClientEnhanced } from '@rcrt-builder/sdk';
import { NodeTemplateV1, NodeRegistryV1 } from '@rcrt-builder/core';
import { BaseNode, NodeTemplate } from './index';
import * as fs from 'fs';
import * as path from 'path';

export interface RegistryOptions {
  rcrtClient: RcrtClientEnhanced;
  workspace: string;
  scanPaths?: string[];
  autoDiscover?: boolean;
  autoRegister?: boolean;
}

export class NodeRegistryManager {
  private rcrtClient: RcrtClientEnhanced;
  private workspace: string;
  private registryBreadcrumbId?: string;
  private nodeTemplates = new Map<string, NodeTemplateV1>();
  
  constructor(private options: RegistryOptions) {
    this.rcrtClient = options.rcrtClient;
    this.workspace = options.workspace;
  }
  
  /**
   * Initialize the registry
   */
  async initialize(): Promise<void> {
    // Check for existing registry
    const existing = await this.rcrtClient.searchBreadcrumbs({
      schema_name: 'node.registry.v1',
      tag: this.workspace,
    });
    
    if (existing.length > 0) {
      this.registryBreadcrumbId = existing[0].id;
      await this.loadTemplates();
    } else {
      await this.createRegistry();
    }
    
    if (this.options.autoDiscover) {
      await this.discoverNodes();
    }
  }
  
  /**
   * Create a new registry breadcrumb
   */
  private async createRegistry(): Promise<void> {
    const result = await this.rcrtClient.createBreadcrumb({
      schema_name: 'node.registry.v1',
      title: 'Node Registry',
      tags: ['system:registry', 'nodes:available', this.workspace],
      context: {
        nodes: [],
        auto_discover: this.options.autoDiscover || false,
        scan_paths: this.options.scanPaths || ['packages/nodes/*/dist'],
      },
    }, `registry-${this.workspace}`);
    
    this.registryBreadcrumbId = result.id;
  }
  
  /**
   * Load templates from breadcrumbs
   */
  private async loadTemplates(): Promise<void> {
    const templates = await this.rcrtClient.searchBreadcrumbs({
      schema_name: 'node.template.v1',
      tag: this.workspace,
    });
    
    for (const template of templates) {
      this.nodeTemplates.set(template.context.node_type, template as NodeTemplateV1);
    }
  }
  
  /**
   * Discover nodes in scan paths
   */
  private async discoverNodes(): Promise<void> {
    if (!this.options.scanPaths) return;
    
    for (const scanPath of this.options.scanPaths) {
      await this.scanDirectory(scanPath);
    }
  }
  
  /**
   * Scan a directory for node modules
   */
  private async scanDirectory(dir: string): Promise<void> {
    const resolvedPath = path.resolve(dir);
    
    if (!fs.existsSync(resolvedPath)) {
      console.warn(`Scan path does not exist: ${resolvedPath}`);
      return;
    }
    
    const files = fs.readdirSync(resolvedPath);
    
    for (const file of files) {
      if (file.endsWith('.js') || file.endsWith('.ts')) {
        try {
          const modulePath = path.join(resolvedPath, file);
          const module = require(modulePath);
          
          // Check for exported node classes
          for (const key of Object.keys(module)) {
            const value = module[key];
            if (value && value.prototype instanceof BaseNode) {
              await this.registerNodeClass(value);
            }
          }
        } catch (error) {
          console.error(`Failed to load module ${file}:`, error);
        }
      }
    }
  }
  
  /**
   * Register a node class
   */
  async registerNodeClass(NodeClass: typeof BaseNode): Promise<void> {
    const template = (NodeClass as any).__template;
    if (!template) {
      console.warn(`Node class ${NodeClass.name} has no template`);
      return;
    }
    
    // Create or update template breadcrumb
    const existing = await this.rcrtClient.searchBreadcrumbs({
      schema_name: 'node.template.v1',
      tag: `node:template:${template.context.node_type}`,
    });
    
    if (existing.length > 0) {
      // Update existing template
      const current = existing[0];
      await this.rcrtClient.updateBreadcrumb(
        current.id,
        current.version,
        {
          context: {
            ...template.context,
            last_updated: new Date().toISOString(),
          },
        }
      );
    } else {
      // Create new template breadcrumb
      await this.rcrtClient.createBreadcrumb({
        schema_name: 'node.template.v1',
        title: template.title,
        tags: [
          ...template.tags,
          this.workspace,
          `node:template:${template.context.node_type}`,
        ],
        context: template.context,
      }, `template-${template.context.node_type}`);
    }
    
    // Update registry
    await this.updateRegistry();
  }
  
  /**
   * Update the registry breadcrumb
   */
  private async updateRegistry(): Promise<void> {
    if (!this.registryBreadcrumbId) return;
    
    const registry = await this.rcrtClient.getBreadcrumb(this.registryBreadcrumbId);
    const nodes = [];
    
    for (const [type, template] of this.nodeTemplates) {
      nodes.push({
        type,
        package: template.context.executor?.module || 'unknown',
        template_id: `node.template:${type}`,
        category: template.context.category,
      });
    }
    
    await this.rcrtClient.updateBreadcrumb(
      this.registryBreadcrumbId,
      registry.version,
      {
        context: {
          ...registry.context,
          nodes,
          last_updated: new Date().toISOString(),
        },
      }
    );
  }
  
  /**
   * Get all available node types
   */
  getNodeTypes(): string[] {
    return Array.from(this.nodeTemplates.keys());
  }
  
  /**
   * Get a node template
   */
  getTemplate(type: string): NodeTemplateV1 | undefined {
    return this.nodeTemplates.get(type);
  }
  
  /**
   * Export all templates as JSON
   */
  exportTemplates(): string {
    const templates = Array.from(this.nodeTemplates.values());
    return JSON.stringify(templates, null, 2);
  }
  
  /**
   * Import templates from JSON
   */
  async importTemplates(json: string): Promise<void> {
    const templates = JSON.parse(json) as NodeTemplateV1[];
    
    for (const template of templates) {
      await this.rcrtClient.createBreadcrumb(template, `import-${template.context.node_type}`);
      this.nodeTemplates.set(template.context.node_type, template);
    }
    
    await this.updateRegistry();
  }
}
