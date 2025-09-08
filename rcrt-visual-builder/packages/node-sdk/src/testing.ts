/**
 * Node Testing Framework
 * Test harness for node development with real RCRT backend
 */

import { BaseNode, NodeExecutionResult } from './index';
import { RcrtClientEnhanced } from '@rcrt-builder/sdk';
import { NodeContext } from '@rcrt-builder/core';

export interface TestHarnessOptions {
  rcrtUrl?: string;
  workspace?: string;
  cleanup?: boolean;
}

/**
 * Test harness for nodes
 */
export class NodeTestHarness {
  private node: BaseNode;
  private rcrtClient: RcrtClientEnhanced;
  private testWorkspace: string;
  private createdBreadcrumbs: string[] = [];
  
  constructor(
    NodeClass: typeof BaseNode,
    config: any,
    options: TestHarnessOptions = {}
  ) {
    // Use real RCRT client
    this.rcrtClient = new RcrtClientEnhanced(
      options.rcrtUrl || process.env.RCRT_URL || 'http://localhost:8081'
    );
    
    // Create unique test workspace
    this.testWorkspace = options.workspace || `test:${Date.now()}`;
    
    // Create node instance
    const context: NodeContext = {
      breadcrumb_id: `test-node-${Date.now()}`,
      config,
      rcrtClient: this.rcrtClient,
      workspace: this.testWorkspace,
    };
    
    this.node = new NodeClass(context);
  }
  
  /**
   * Initialize the test harness
   */
  async initialize(): Promise<void> {
    // Initialize node
    await this.node.initialize();
    
    // Create test workspace breadcrumb
    const result = await this.rcrtClient.createBreadcrumb({
      schema_name: 'workspace.def.v1',
      title: `Test Workspace: ${this.testWorkspace}`,
      tags: [this.testWorkspace, 'test:workspace'],
      context: {
        workspace_id: this.testWorkspace,
        policy: {
          token_budget_bytes: 10000,
          delivery_throttle_ms: 0,
        },
      },
    }, `workspace-${this.testWorkspace}`);
    
    this.createdBreadcrumbs.push(result.id);
  }
  
  /**
   * Test node execution
   */
  async testExecution(inputs: Record<string, any>): Promise<NodeExecutionResult> {
    // Validate inputs match expected schema
    const metadata = this.node.getMetadata();
    
    for (const input of metadata.inputs) {
      if (!input.optional && !(input.id in inputs)) {
        throw new Error(`Missing required input: ${input.id}`);
      }
    }
    
    // Execute node with real RCRT backend
    const result = await this.node.execute(inputs);
    
    // Track created breadcrumbs for cleanup
    if (result.breadcrumbs) {
      for (const breadcrumb of result.breadcrumbs) {
        const created = await this.rcrtClient.createBreadcrumb({
          ...breadcrumb,
          tags: [...(breadcrumb.tags || []), this.testWorkspace],
        });
        this.createdBreadcrumbs.push(created.id);
      }
    }
    
    // Validate outputs match expected schema
    for (const output of metadata.outputs) {
      if (!output.optional && !(output.id in result.outputs)) {
        throw new Error(`Missing required output: ${output.id}`);
      }
    }
    
    return result;
  }
  
  /**
   * Test node configuration validation
   */
  testConfigValidation(config: any): boolean {
    return this.node.validateConfig(config);
  }
  
  /**
   * Test node metadata
   */
  testMetadata(): void {
    const metadata = this.node.getMetadata();
    
    // Validate required fields
    if (!metadata.type) {
      throw new Error('Node metadata missing type');
    }
    if (!metadata.category) {
      throw new Error('Node metadata missing category');
    }
    if (!metadata.icon) {
      throw new Error('Node metadata missing icon');
    }
    if (!metadata.inputs || !Array.isArray(metadata.inputs)) {
      throw new Error('Node metadata missing inputs array');
    }
    if (!metadata.outputs || !Array.isArray(metadata.outputs)) {
      throw new Error('Node metadata missing outputs array');
    }
    
    // Validate ports
    for (const input of metadata.inputs) {
      if (!input.id) {
        throw new Error(`Input port missing id`);
      }
      if (!input.type) {
        throw new Error(`Input port ${input.id} missing type`);
      }
    }
    
    for (const output of metadata.outputs) {
      if (!output.id) {
        throw new Error(`Output port missing id`);
      }
      if (!output.type) {
        throw new Error(`Output port ${output.id} missing type`);
      }
    }
  }
  
  /**
   * Create test breadcrumb
   */
  async createTestBreadcrumb(data: any): Promise<string> {
    const result = await this.rcrtClient.createBreadcrumb({
      title: data.title || 'Test Breadcrumb',
      context: data.context || {},
      tags: [...(data.tags || []), this.testWorkspace],
      schema_name: data.schema_name,
    });
    
    this.createdBreadcrumbs.push(result.id);
    return result.id;
  }
  
  /**
   * Get test workspace breadcrumbs
   */
  async getTestBreadcrumbs(): Promise<any[]> {
    return this.rcrtClient.searchBreadcrumbs({
      tag: this.testWorkspace,
    });
  }
  
  /**
   * Clean up test resources
   */
  async cleanup(): Promise<void> {
    // Clean up node resources
    await this.node.destroy();
    
    // Delete all test breadcrumbs
    for (const id of this.createdBreadcrumbs) {
      try {
        const breadcrumb = await this.rcrtClient.getBreadcrumb(id);
        await this.rcrtClient.deleteBreadcrumb(id, breadcrumb.version);
      } catch (error) {
        // Ignore errors - breadcrumb may already be deleted
      }
    }
    
    // Clear the list
    this.createdBreadcrumbs = [];
  }
  
  /**
   * Get node instance for direct testing
   */
  getNode(): BaseNode {
    return this.node;
  }
  
  /**
   * Get RCRT client for direct testing
   */
  getClient(): RcrtClientEnhanced {
    return this.rcrtClient;
  }
}

/**
 * Test suite for nodes
 */
export class NodeTestSuite {
  private tests: Array<{
    name: string;
    fn: () => Promise<void>;
  }> = [];
  
  /**
   * Add a test
   */
  test(name: string, fn: () => Promise<void>): void {
    this.tests.push({ name, fn });
  }
  
  /**
   * Run all tests
   */
  async run(): Promise<{
    passed: number;
    failed: number;
    errors: Array<{ test: string; error: string }>;
  }> {
    let passed = 0;
    let failed = 0;
    const errors: Array<{ test: string; error: string }> = [];
    
    for (const test of this.tests) {
      try {
        console.log(`Running test: ${test.name}`);
        await test.fn();
        console.log(`✅ ${test.name}`);
        passed++;
      } catch (error) {
        console.error(`❌ ${test.name}: ${error}`);
        failed++;
        errors.push({
          test: test.name,
          error: String(error),
        });
      }
    }
    
    console.log(`\nTest Results: ${passed} passed, ${failed} failed`);
    
    return { passed, failed, errors };
  }
}

/**
 * Create a test suite for a node
 */
export function createNodeTestSuite(
  NodeClass: typeof BaseNode,
  config: any
): NodeTestSuite {
  const suite = new NodeTestSuite();
  
  // Add standard tests
  suite.test('Node metadata is valid', async () => {
    const harness = new NodeTestHarness(NodeClass, config);
    harness.testMetadata();
    await harness.cleanup();
  });
  
  suite.test('Node configuration validates', async () => {
    const harness = new NodeTestHarness(NodeClass, config);
    const isValid = harness.testConfigValidation(config);
    if (!isValid) {
      throw new Error('Configuration validation failed');
    }
    await harness.cleanup();
  });
  
  suite.test('Node initializes without error', async () => {
    const harness = new NodeTestHarness(NodeClass, config);
    await harness.initialize();
    await harness.cleanup();
  });
  
  return suite;
}
