/**
 * Node Development Server
 * Hot-reloading for node development
 */

import { RcrtClientEnhanced } from '@rcrt-builder/sdk';
import * as chokidar from 'chokidar';
import * as path from 'path';
import { NodeRegistry, BaseNode } from './index';

export interface DevServerOptions {
  watchPaths: string[];
  rcrtUrl: string;
  workspace: string;
  autoRegister: boolean;
  verbose?: boolean;
}

export class NodeDevServer {
  private rcrtClient: RcrtClientEnhanced;
  private watcher?: chokidar.FSWatcher;
  private options: DevServerOptions;
  private moduleCache = new Map<string, any>();
  
  constructor(options: DevServerOptions) {
    this.options = options;
    this.rcrtClient = new RcrtClientEnhanced(options.rcrtUrl);
  }
  
  /**
   * Start the development server
   */
  async start(): Promise<void> {
    console.log('🚀 Starting Node Development Server');
    console.log(`📁 Watching: ${this.options.watchPaths.join(', ')}`);
    console.log(`🔗 RCRT URL: ${this.options.rcrtUrl}`);
    console.log(`🏢 Workspace: ${this.options.workspace}`);
    
    // Initialize watcher
    this.watcher = chokidar.watch(this.options.watchPaths, {
      persistent: true,
      ignoreInitial: false,
    });
    
    // Handle file changes
    this.watcher.on('change', (filePath: string) => this.handleFileChange(filePath));
    this.watcher.on('add', (filePath: string) => this.handleFileAdd(filePath));
    this.watcher.on('unlink', (filePath: string) => this.handleFileRemove(filePath));
    
    // Handle errors
    this.watcher.on('error', (error: Error) => {
      console.error('❌ Watcher error:', error);
    });
    
    console.log('✅ Dev server started. Press Ctrl+C to stop.');
  }
  
  /**
   * Stop the development server
   */
  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = undefined;
    }
    console.log('👋 Dev server stopped');
  }
  
  /**
   * Handle file changes
   */
  private async handleFileChange(filePath: string): Promise<void> {
    if (this.options.verbose) {
      console.log(`📝 File changed: ${filePath}`);
    }
    
    try {
      // Clear module cache
      const resolvedPath = path.resolve(filePath);
      delete require.cache[resolvedPath];
      
      // Reload module
      const module = await this.loadModule(resolvedPath);
      
      if (module && this.options.autoRegister) {
        await this.registerModule(module, filePath);
      }
      
      // Notify flows of update
      await this.notifyFlowsOfUpdate(filePath);
      
      console.log(`✅ Reloaded: ${path.basename(filePath)}`);
    } catch (error) {
      console.error(`❌ Failed to reload ${filePath}:`, error);
    }
  }
  
  /**
   * Handle new file
   */
  private async handleFileAdd(filePath: string): Promise<void> {
    if (this.options.verbose) {
      console.log(`➕ File added: ${filePath}`);
    }
    
    try {
      const module = await this.loadModule(filePath);
      
      if (module && this.options.autoRegister) {
        await this.registerModule(module, filePath);
        console.log(`✅ Registered: ${path.basename(filePath)}`);
      }
    } catch (error) {
      console.error(`❌ Failed to load ${filePath}:`, error);
    }
  }
  
  /**
   * Handle file removal
   */
  private async handleFileRemove(filePath: string): Promise<void> {
    if (this.options.verbose) {
      console.log(`➖ File removed: ${filePath}`);
    }
    
    // Remove from cache
    this.moduleCache.delete(filePath);
    
    // Clear require cache
    const resolvedPath = path.resolve(filePath);
    delete require.cache[resolvedPath];
  }
  
  /**
   * Load a module
   */
  private async loadModule(filePath: string): Promise<any> {
    try {
      const module = require(filePath);
      this.moduleCache.set(filePath, module);
      return module;
    } catch (error) {
      throw new Error(`Failed to load module: ${error}`);
    }
  }
  
  /**
   * Register a module's nodes
   */
  private async registerModule(module: any, _filePath: string): Promise<void> {
    // Look for exported node classes
    for (const key of Object.keys(module)) {
      const value = module[key];
      
      // Check if it's a node class
      if (this.isNodeClass(value)) {
        await this.registerNode(value);
      }
    }
  }
  
  /**
   * Check if a value is a node class
   */
  private isNodeClass(value: any): boolean {
    return (
      value &&
      typeof value === 'function' &&
      value.prototype &&
      (value.prototype instanceof BaseNode ||
        value.prototype.constructor.name.endsWith('Node'))
    );
  }
  
  /**
   * Register a node with RCRT
   */
  private async registerNode(NodeClass: typeof BaseNode): Promise<void> {
    const template = (NodeClass as any).__template;
    if (!template) {
      console.warn(`⚠️  Node class ${NodeClass.name} has no template`);
      return;
    }
    
    // Skip abstract classes
    if (NodeClass === BaseNode || NodeClass.name === 'BaseNode') {
      return;
    }
    
    // Create test instance to get metadata
    const testContext = {
      breadcrumb_id: 'dev-test',
      config: {},
      rcrtClient: this.rcrtClient,
      workspace: this.options.workspace,
    };
    
    const instance = new (NodeClass as any)(testContext);
    const metadata = instance.getMetadata();
    
    // Create or update node template breadcrumb
    const existing = await this.rcrtClient.searchBreadcrumbs({
      schema_name: 'node.template.v1',
      tag: `node:template:${metadata.type}`,
    });
    
    const templateData = {
      schema_name: 'node.template.v1' as const,
      title: template.title || `Node Template: ${metadata.type}`,
      tags: [
        'node:template',
        metadata.category,
        metadata.type,
        this.options.workspace,
        `node:template:${metadata.type}`,
      ],
      context: {
        ...template.context,
        ...metadata,
        last_updated: new Date().toISOString(),
      },
    };
    
    if (existing.length > 0) {
      // Update existing template
      await this.rcrtClient.updateBreadcrumb(
        existing[0].id,
        existing[0].version,
        {
          context: templateData.context,
        }
      );
    } else {
      // Create new template
      await this.rcrtClient.createBreadcrumb(
        templateData,
        `template-${metadata.type}-${Date.now()}`
      );
    }
    
    // Register with local registry
    NodeRegistry.register(NodeClass, template);
  }
  
  /**
   * Notify flows of node update
   */
  private async notifyFlowsOfUpdate(filePath: string): Promise<void> {
    const fileName = path.basename(filePath, path.extname(filePath));
    
    // Create update notification breadcrumb
    await this.rcrtClient.createBreadcrumb({
      schema_name: 'node.update.v1',
      title: `Node Updated: ${fileName}`,
      tags: ['node:update', 'dev:hot-reload', this.options.workspace],
      context: {
        node_type: fileName,
        file_path: filePath,
        timestamp: new Date().toISOString(),
        action: 'reload',
      },
    }, `update-${fileName}-${Date.now()}`);
  }
  
  /**
   * Get development stats
   */
  getStats(): {
    watching: number;
    cached: number;
    registered: number;
  } {
    return {
      watching: this.options.watchPaths.length,
      cached: this.moduleCache.size,
      registered: NodeRegistry.getNodeTypes().length,
    };
  }
}
