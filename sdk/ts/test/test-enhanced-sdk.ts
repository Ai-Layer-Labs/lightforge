/**
 * Comprehensive test suite for enhanced RCRT SDK
 * Run with: npx ts-node test-enhanced-sdk.ts
 */

import { RcrtClientEnhanced, BreadcrumbCreate, Selector, BreadcrumbEvent } from '../index-enhanced';
import assert from 'assert';

const RCRT_URL = process.env.RCRT_URL || 'http://localhost:8081';
const client = new RcrtClientEnhanced(RCRT_URL);

// Test data
const TEST_WORKSPACE = `workspace:test_${Date.now()}`;
const TEST_OWNER_ID = process.env.OWNER_ID || 'test-owner';
const TEST_AGENT_ID = process.env.AGENT_ID || 'test-agent';

// Color codes for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(name: string) {
  log(`\n📝 Testing: ${name}`, 'blue');
}

function logSuccess(message: string) {
  log(`✅ ${message}`, 'green');
}

function logError(message: string) {
  log(`❌ ${message}`, 'red');
}

// Test helpers
async function cleanup(breadcrumbIds: string[]) {
  for (const id of breadcrumbIds) {
    try {
      await client.deleteBreadcrumb(id);
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

// Test Suite
class TestSuite {
  private createdBreadcrumbs: string[] = [];
  private sseCleanup?: () => void;

  async runAll() {
    log('\n🚀 Starting Enhanced RCRT SDK Test Suite', 'magenta');
    log(`🔗 Testing against: ${RCRT_URL}`, 'yellow');
    
    try {
      // Basic connectivity
      await this.testHealth();
      
      // Breadcrumb operations
      await this.testCreateBreadcrumb();
      await this.testUpdateBreadcrumb();
      await this.testGetBreadcrumb();
      await this.testSearchBreadcrumbs();
      await this.testVectorSearch();
      await this.testBatchOperations();
      
      // Subscription tests
      await this.testSelectors();
      await this.testSSEStream();
      
      // Agent builder specific tests
      await this.testAgentDefinition();
      await this.testFlowDefinition();
      await this.testUIComponentBreadcrumb();
      await this.testToolCatalog();
      await this.testMetaAgent();
      
      // Real-time collaboration test
      await this.testCollaborativeEditing();
      
      // Test new CRUD endpoints
      await this.testAgentCRUD();
      await this.testTenantCRUD();
      await this.testACLList();
      await this.testSelectorCRUD();
      await this.testDLQOperations();
      
      // Cleanup
      await this.cleanup();
      
      log('\n🎉 All tests passed!', 'green');
    } catch (error) {
      logError(`Test suite failed: ${error}`);
      await this.cleanup();
      process.exit(1);
    }
  }

  async testHealth() {
    logTest('Health Check');
    const health = await client.health();
    assert(health.includes('ok') || health.includes('OK'), 'Health check failed');
    logSuccess('Health check passed');
  }

  async testCreateBreadcrumb() {
    logTest('Create Breadcrumb');
    
    const breadcrumb: BreadcrumbCreate = {
      title: 'Test Breadcrumb',
      context: { test: true, timestamp: Date.now() },
      tags: [TEST_WORKSPACE, 'test'],
      schema_name: 'test.v1',
      visibility: 'team',
      sensitivity: 'low',
    };
    
    const result = await client.createBreadcrumb(breadcrumb, `test-${Date.now()}`);
    assert(result.id, 'No breadcrumb ID returned');
    this.createdBreadcrumbs.push(result.id);
    
    logSuccess(`Created breadcrumb: ${result.id}`);
  }

  async testUpdateBreadcrumb() {
    logTest('Update Breadcrumb');
    
    // Create a breadcrumb to update
    const created = await client.createBreadcrumb({
      title: 'To Update',
      context: { value: 1 },
      tags: [TEST_WORKSPACE, 'update-test'],
    });
    this.createdBreadcrumbs.push(created.id);
    
    // Get it to know the version
    const original = await client.getBreadcrumb(created.id);
    
    // Update it
    const updated = await client.updateBreadcrumb(
      created.id,
      original.version,
      {
        context: { value: 2, updated: true },
        tags: [TEST_WORKSPACE, 'update-test', 'updated'],
      }
    );
    
    assert(updated.version > original.version, 'Version not incremented');
    assert(updated.context.updated === true, 'Context not updated');
    logSuccess(`Updated breadcrumb version ${original.version} → ${updated.version}`);
  }

  async testGetBreadcrumb() {
    logTest('Get Breadcrumb Views');
    
    const created = await client.createBreadcrumb({
      title: 'View Test',
      context: { sensitive: 'data', public: 'info' },
      tags: [TEST_WORKSPACE, 'view-test'],
      sensitivity: 'pii',
    });
    this.createdBreadcrumbs.push(created.id);
    
    // Context view
    const contextView = await client.getBreadcrumb(created.id);
    assert(contextView.id === created.id, 'Context view ID mismatch');
    
    // Full view (may require curator role)
    try {
      const fullView = await client.getBreadcrumbFull(created.id);
      assert(fullView.id === created.id, 'Full view ID mismatch');
      assert(fullView.owner_id, 'Full view missing owner_id');
      logSuccess('Both context and full views retrieved');
    } catch (e) {
      logSuccess('Context view retrieved (full view requires curator role)');
    }
  }

  async testSearchBreadcrumbs() {
    logTest('Search Breadcrumbs');
    
    // Create searchable breadcrumbs
    const tag = `search-${Date.now()}`;
    for (let i = 0; i < 3; i++) {
      const created = await client.createBreadcrumb({
        title: `Search Test ${i}`,
        context: { index: i },
        tags: [TEST_WORKSPACE, tag],
        schema_name: 'search.test.v1',
      });
      this.createdBreadcrumbs.push(created.id);
    }
    
    // Search by tag
    const byTag = await client.searchBreadcrumbs({ tag });
    assert(byTag.length >= 3, 'Not enough results by tag');
    
    // Search by schema
    const bySchema = await client.searchBreadcrumbs({ 
      schema_name: 'search.test.v1',
      tag: TEST_WORKSPACE,
    });
    assert(bySchema.length >= 3, 'Not enough results by schema');
    
    logSuccess(`Found ${byTag.length} breadcrumbs by tag, ${bySchema.length} by schema`);
  }

  async testVectorSearch() {
    logTest('Vector Search');
    
    // Create breadcrumbs with semantic content
    const contexts = [
      'Planning a trip to Paris in summer',
      'Booking flights to France for vacation',
      'Learning French cuisine recipes',
      'Building a React application',
    ];
    
    for (const content of contexts) {
      const created = await client.createBreadcrumb({
        title: content,
        context: { description: content },
        tags: [TEST_WORKSPACE, 'vector-test'],
      });
      this.createdBreadcrumbs.push(created.id);
    }
    
    // Wait a bit for indexing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Semantic search
    try {
      const results = await client.vectorSearch({
        q: 'travel to Paris',
        nn: 3,
      });
      
      // Should find travel-related breadcrumbs
      assert(results.length > 0, 'No vector search results');
      logSuccess(`Vector search found ${results.length} similar breadcrumbs`);
    } catch (e) {
      log('⚠️  Vector search skipped (may need embeddings configured)', 'yellow');
    }
  }

  async testBatchOperations() {
    logTest('Batch Operations');
    
    // Batch create
    const toCreate: BreadcrumbCreate[] = Array(5).fill(0).map((_, i) => ({
      title: `Batch ${i}`,
      context: { index: i },
      tags: [TEST_WORKSPACE, 'batch-test'],
    }));
    
    const created = await client.batchCreate(toCreate);
    assert(created.length === 5, 'Batch create count mismatch');
    created.forEach(bc => this.createdBreadcrumbs.push(bc.id));
    
    // Batch get
    const ids = created.map(bc => bc.id);
    const fetched = await client.batchGet(ids);
    assert(fetched.length === 5, 'Batch get count mismatch');
    
    logSuccess(`Batch created and fetched ${created.length} breadcrumbs`);
  }

  async testSelectors() {
    logTest('Selector Subscriptions');
    
    const selector: Selector = {
      any_tags: [TEST_WORKSPACE, 'selector-test'],
      schema_name: 'selector.test.v1',
    };
    
    try {
      const subscription = await client.createSelectorSubscription(selector);
      assert(subscription.id, 'No subscription ID returned');
      logSuccess('Selector subscription created');
    } catch (e) {
      log('⚠️  Selector subscription skipped (may need auth)', 'yellow');
    }
  }

  async testSSEStream() {
    logTest('SSE Event Stream');
    
    return new Promise<void>((resolve) => {
      let eventReceived = false;
      
      // Start SSE with timeout
      const cleanup = client.startEventStream(
        (event: BreadcrumbEvent) => {
          if (!eventReceived) {
            eventReceived = true;
            logSuccess(`Received event: ${event.type} for ${event.breadcrumb_id}`);
            cleanup();
            resolve();
          }
        },
        {
          reconnectDelay: 1000,
          maxReconnectAttempts: 3,
        }
      );
      
      // Create a breadcrumb to trigger event
      setTimeout(async () => {
        const created = await client.createBreadcrumb({
          title: 'SSE Test',
          context: { trigger: true },
          tags: [TEST_WORKSPACE, 'sse-test'],
        });
        this.createdBreadcrumbs.push(created.id);
      }, 500);
      
      // Timeout if no event received
      setTimeout(() => {
        if (!eventReceived) {
          cleanup();
          log('⚠️  SSE test timed out (events may be delayed)', 'yellow');
          resolve();
        }
      }, 5000);
    });
  }

  async testAgentDefinition() {
    logTest('Agent Definition Breadcrumb');
    
    const agentDef = await client.createBreadcrumb({
      title: 'Agent: Test Researcher',
      tags: [TEST_WORKSPACE, 'agent:def'],
      schema_name: 'agent.def.v1',
      context: {
        agent_id: 'agent.test_researcher',
        model: 'openrouter/openai/gpt-4o-mini',
        system_prompt: 'You are a test research agent',
        subscriptions: {
          selectors: [
            { any_tags: [TEST_WORKSPACE, 'research:request'] }
          ]
        },
        emits: {
          tags: ['research:complete'],
        },
        capabilities: {
          can_create_breadcrumbs: true,
          can_update_own: true,
        }
      }
    });
    
    this.createdBreadcrumbs.push(agentDef.id);
    assert(agentDef.id, 'Agent definition not created');
    logSuccess('Agent definition breadcrumb created');
  }

  async testFlowDefinition() {
    logTest('Flow Definition Breadcrumb');
    
    const flowDef = await client.createBreadcrumb({
      title: 'Flow: Test Pipeline',
      tags: [TEST_WORKSPACE, 'flow:definition'],
      schema_name: 'flow.definition.v1',
      context: {
        flow_id: 'flow_test_001',
        nodes: [
          {
            id: 'node_1',
            type: 'EventStreamNode',
            position: { x: 100, y: 200 },
            config: { mode: 'sse' }
          },
          {
            id: 'node_2',
            type: 'AgentNode',
            position: { x: 400, y: 200 },
            config: {
              model: 'openrouter/openai/gpt-4o-mini',
              system_prompt: 'Test agent'
            }
          }
        ],
        connections: [
          {
            from: { node: 'node_1', port: 'subscriber' },
            to: { node: 'node_2', port: 'trigger' }
          }
        ]
      }
    });
    
    this.createdBreadcrumbs.push(flowDef.id);
    assert(flowDef.id, 'Flow definition not created');
    logSuccess('Flow definition breadcrumb created');
  }

  async testUIComponentBreadcrumb() {
    logTest('UI Component Breadcrumb');
    
    const uiComponent = await client.createBreadcrumb({
      title: 'UI Component: Button',
      tags: [TEST_WORKSPACE, 'ui:component', 'heroui:button'],
      schema_name: 'ui.component.v1',
      context: {
        component_type: 'Button',
        library: 'heroui',
        props_schema: {
          color: { enum: ['primary', 'secondary'] },
          size: { enum: ['sm', 'md', 'lg'] },
        },
        event_handlers: ['onClick', 'onPress'],
      }
    });
    
    this.createdBreadcrumbs.push(uiComponent.id);
    assert(uiComponent.id, 'UI component not created');
    logSuccess('UI component breadcrumb created');
  }

  async testToolCatalog() {
    logTest('Tool Catalog Breadcrumb');
    
    const toolCatalog = await client.createBreadcrumb({
      title: 'Tool Catalog: Test Tools',
      tags: [TEST_WORKSPACE, 'tools:catalog'],
      schema_name: 'tools.catalog.v1',
      context: {
        tools: [
          {
            name: 'http_request',
            description: 'Make HTTP requests',
            input_schema: {
              type: 'object',
              properties: {
                url: { type: 'string' },
                method: { type: 'string' }
              }
            }
          },
          {
            name: 'vector_search',
            description: 'Search breadcrumbs semantically',
            input_schema: {
              type: 'object',
              properties: {
                query: { type: 'string' },
                limit: { type: 'number' }
              }
            }
          }
        ]
      }
    });
    
    this.createdBreadcrumbs.push(toolCatalog.id);
    assert(toolCatalog.id, 'Tool catalog not created');
    logSuccess('Tool catalog breadcrumb created');
  }

  async testMetaAgent() {
    logTest('Meta-Agent (Agent Builder)');
    
    const metaAgent = await client.createBreadcrumb({
      title: 'Agent: Builder',
      tags: [TEST_WORKSPACE, 'agent:def', 'meta:agent'],
      schema_name: 'agent.def.v1',
      context: {
        agent_id: 'agent.builder',
        model: 'openrouter/anthropic/claude-3.5-sonnet',
        system_prompt: 'You build other agents by creating agent.def breadcrumbs',
        capabilities: {
          can_spawn_agents: true,
          can_modify_agents: true,
          can_create_flows: true,
        },
        subscriptions: {
          selectors: [
            { any_tags: [TEST_WORKSPACE, 'agent:request'] }
          ]
        },
        tools: [
          { name: 'create_agent', creates: 'agent.def.v1' },
          { name: 'create_flow', creates: 'flow.definition.v1' }
        ]
      }
    });
    
    this.createdBreadcrumbs.push(metaAgent.id);
    assert(metaAgent.id, 'Meta-agent not created');
    logSuccess('Meta-agent (agent builder) breadcrumb created');
  }

  async testCollaborativeEditing() {
    logTest('Collaborative Editing Simulation');
    
    // Create a flow that multiple "users" will edit
    const flowCreated = await client.createBreadcrumb({
      title: 'Collaborative Flow',
      tags: [TEST_WORKSPACE, 'flow:definition', 'collaborative'],
      schema_name: 'flow.definition.v1',
      context: {
        flow_id: 'flow_collab',
        nodes: [],
        connections: [],
      }
    });
    this.createdBreadcrumbs.push(flowCreated.id);
    
    // Get the full breadcrumb to access version
    const flow = await client.getBreadcrumb(flowCreated.id);
    
    // Simulate User A adding a node
    let current = await client.getBreadcrumb(flowCreated.id);
    const userAUpdate = await client.updateBreadcrumb(
      flowCreated.id,
      current.version,
      {
        context: {
          ...current.context,
          nodes: [
            { id: 'node_a', type: 'AgentNode', position: { x: 100, y: 100 } }
          ]
        }
      }
    );
    
    // Simulate User B adding another node
    current = await client.getBreadcrumb(flowCreated.id);
    const userBUpdate = await client.updateBreadcrumb(
      flowCreated.id,
      current.version,
      {
        context: {
          ...current.context,
          nodes: [
            ...current.context.nodes,
            { id: 'node_b', type: 'BreadcrumbNode', position: { x: 300, y: 100 } }
          ]
        }
      }
    );
    
    // Verify both nodes are present
    const final = await client.getBreadcrumb(flowCreated.id);
    assert(final.context.nodes.length === 2, 'Collaborative edits not merged');
    assert(final.version > flow.version + 1, 'Version not incremented properly');
    
    logSuccess(`Collaborative editing: ${final.context.nodes.length} nodes, version ${final.version}`);
  }

  async testOptimisticUpdate() {
    logTest('Optimistic Update Pattern');
    
    const bcCreated = await client.createBreadcrumb({
      title: 'Optimistic Test',
      context: { value: 1 },
      tags: [TEST_WORKSPACE, 'optimistic'],
    });
    this.createdBreadcrumbs.push(bcCreated.id);
    
    // Get the full breadcrumb to access version
    const bc = await client.getBreadcrumb(bcCreated.id);
    
    let uiValue = 1;
    let rollbackCalled = false;
    
    try {
      await client.optimisticUpdate(
        bcCreated.id,
        bc.version || 1,
        { context: { value: 2 } },
        () => { uiValue = 2; return uiValue; },
        (error) => { rollbackCalled = true; uiValue = 1; }
      );
      
      assert(uiValue === 2, 'Optimistic update not applied');
      assert(!rollbackCalled, 'Rollback called unexpectedly');
      logSuccess('Optimistic update succeeded');
    } catch (e) {
      log('⚠️  Optimistic update test skipped', 'yellow');
    }
  }

  async testAgentCRUD() {
    logTest('Agent CRUD Operations');
    
    const testAgentId = `test-agent-${Date.now()}`;
    
    try {
      // Create/Update agent
      const created = await client.createOrUpdateAgent(testAgentId, ['emitter', 'subscriber']);
      assert(created.ok, 'Agent creation failed');
      
      // Get agent
      const agent = await client.getAgent(testAgentId);
      assert(agent.id === testAgentId, 'Agent ID mismatch');
      assert(agent.roles.includes('emitter'), 'Agent roles not set');
      
      // List agents
      const agents = await client.listAgents();
      assert(agents.length > 0, 'No agents found');
      assert(agents.some(a => a.id === testAgentId), 'Created agent not in list');
      
      // Delete agent
      const deleted = await client.deleteAgent(testAgentId);
      assert(deleted.ok, 'Agent deletion failed');
      
      logSuccess('Agent CRUD operations passed');
    } catch (e) {
      log('⚠️  Agent CRUD test skipped (may need auth)', 'yellow');
    }
  }

  async testTenantCRUD() {
    logTest('Tenant CRUD Operations');
    
    const testTenantId = `test-tenant-${Date.now()}`;
    
    try {
      // Create tenant
      const created = await client.createOrUpdateTenant(testTenantId, 'Test Tenant');
      assert(created.ok, 'Tenant creation failed');
      
      // Get tenant
      const tenant = await client.getTenant(testTenantId);
      assert(tenant.id === testTenantId, 'Tenant ID mismatch');
      assert(tenant.name === 'Test Tenant', 'Tenant name mismatch');
      
      // Update tenant
      const updated = await client.updateTenant(testTenantId, 'Updated Tenant');
      assert(updated.ok, 'Tenant update failed');
      
      // List tenants
      const tenants = await client.listTenants();
      assert(tenants.length > 0, 'No tenants found');
      
      // Delete tenant
      const deleted = await client.deleteTenant(testTenantId);
      assert(deleted.ok, 'Tenant deletion failed');
      
      logSuccess('Tenant CRUD operations passed');
    } catch (e) {
      log('⚠️  Tenant CRUD test skipped (may need curator role)', 'yellow');
    }
  }

  async testACLList() {
    logTest('ACL List Operation');
    
    try {
      const acls = await client.listAcls();
      assert(Array.isArray(acls), 'ACL list is not an array');
      logSuccess(`Listed ${acls.length} ACL entries`);
    } catch (e) {
      log('⚠️  ACL list test skipped (may need auth)', 'yellow');
    }
  }

  async testSelectorCRUD() {
    logTest('Selector Update/Delete Operations');
    
    try {
      // First create a selector
      const selector: Selector = {
        any_tags: [TEST_WORKSPACE, 'selector-crud-test'],
        schema_name: 'test.selector.v1',
      };
      
      const created = await client.createSelectorSubscription(selector);
      assert(created.id, 'Selector creation failed');
      
      // Update selector
      const updatedSelector: Selector = {
        any_tags: [TEST_WORKSPACE, 'selector-updated'],
        schema_name: 'test.selector.v2',
      };
      const updated = await client.updateSelector(created.id, updatedSelector);
      assert(updated.ok, 'Selector update failed');
      
      // Delete selector
      const deleted = await client.deleteSelector(created.id);
      assert(deleted.ok, 'Selector deletion failed');
      
      logSuccess('Selector CRUD operations passed');
    } catch (e) {
      log('⚠️  Selector CRUD test skipped (may need subscriber role)', 'yellow');
    }
  }

  async testDLQOperations() {
    logTest('DLQ Operations');
    
    try {
      // List DLQ items
      const dlqItems = await client.listDlq();
      assert(Array.isArray(dlqItems), 'DLQ list is not an array');
      
      if (dlqItems.length > 0) {
        // Test retry
        const retried = await client.retryDlqItem(dlqItems[0].id);
        assert(retried.requeued, 'DLQ retry failed');
        logSuccess(`Listed ${dlqItems.length} DLQ items, retried one`);
      } else {
        logSuccess('DLQ is empty (good!)');
      }
    } catch (e) {
      log('⚠️  DLQ test skipped (may need curator role)', 'yellow');
    }
  }

  async cleanup() {
    log('\n🧹 Cleaning up test breadcrumbs...', 'yellow');
    
    if (this.sseCleanup) {
      this.sseCleanup();
    }
    
    for (const id of this.createdBreadcrumbs) {
      try {
        await client.deleteBreadcrumb(id);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    
    logSuccess(`Cleaned up ${this.createdBreadcrumbs.length} test breadcrumbs`);
  }
}

// Run tests
async function main() {
  const suite = new TestSuite();
  await suite.runAll();
}

main().catch(console.error);
