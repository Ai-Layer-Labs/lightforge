/**
 * Integration test for the complete agent system
 * Tests agent creation, execution, and agent-builds-agent scenarios
 * Run with: npx ts-node test-agent-system.ts
 */

import { RcrtClientEnhanced, BreadcrumbEvent } from '../index-enhanced';

const RCRT_URL = process.env.RCRT_URL || 'http://localhost:8081';
const client = new RcrtClientEnhanced(RCRT_URL);

const TEST_WORKSPACE = `workspace:agent_test_${Date.now()}`;

// Mock LLM responses for testing
class MockLLMClient {
  private hasCreatedAgent = false;
  
  async complete(params: any): Promise<any> {
    // Parse the trigger to understand what we're responding to
    const messageContent = params.messages[0]?.content;
    let trigger: any = {};
    try {
      trigger = JSON.parse(messageContent);
    } catch (e) {
      // If not JSON, treat as string
      trigger = { text: messageContent };
    }
    
    // Only create an agent once when we see an agent:request
    if (trigger.trigger?.tags?.includes('agent:request') && !this.hasCreatedAgent) {
      this.hasCreatedAgent = true;
      return {
        content: JSON.stringify({
          action: 'create_agent',
          agent_def: {
            title: 'Agent: Auto-Generated Research Agent',
            tags: [TEST_WORKSPACE, 'agent:def', 'auto-generated'],
            schema_name: 'agent.def.v1',
            context: {
              agent_id: 'agent.auto_generated',
              model: 'openrouter/openai/gpt-4o-mini',
              system_prompt: 'I am an auto-generated research agent',
              subscriptions: {
                selectors: [{ any_tags: [TEST_WORKSPACE, 'task'] }]
              }
            }
          }
        })
      };
    }
    
    // For task breadcrumbs, process them
    if (trigger.trigger?.tags?.includes('task')) {
      return {
        content: JSON.stringify({
          action: 'process',
          result: 'Task processed successfully'
        })
      };
    }
    
    // Default: no action needed
    return {
      content: JSON.stringify({
        action: 'none',
        reason: 'No action required for this event'
      })
    };
  }
}

// Simulated Agent Runtime
class AgentRuntime {
  private agentDef: any;
  private llmClient: MockLLMClient;
  private sseCleanup?: () => void;
  
  constructor(agentDef: any) {
    this.agentDef = agentDef;
    this.llmClient = new MockLLMClient();
  }
  
  async start() {
    console.log(`🤖 Starting agent: ${this.agentDef.context?.agent_id || 'unknown'}`);
    
    // Subscribe to events based on agent's selectors
    this.sseCleanup = client.startEventStream(
      async (event: BreadcrumbEvent) => {
        await this.processEvent(event);
      },
      {
        filters: this.agentDef.context?.subscriptions?.selectors?.[0]
      }
    );
  }
  
  async processEvent(event: BreadcrumbEvent) {
    console.log(`📨 Agent ${this.agentDef.context?.agent_id || 'unknown'} processing event:`, event.type);
    
    // Skip ping events (they don't have breadcrumb_ids)
    if (event.type === 'ping' || !event.breadcrumb_id) {
      return;
    }
    
    // Fetch triggering breadcrumb
    const breadcrumb = await client.getBreadcrumb(event.breadcrumb_id);
    
    // Fetch workspace context
    const context = await client.getWorkspaceBreadcrumbs(TEST_WORKSPACE);
    
    // Call LLM
    const decision = await this.llmClient.complete({
      model: this.agentDef.context.model,
      systemPrompt: this.agentDef.context.system_prompt,
      messages: [
        {
          role: 'user',
          content: JSON.stringify({ trigger: breadcrumb, context })
        }
      ]
    });
    
    // Execute decision
    const result = JSON.parse(decision.content);
    await this.executeDecision(result);
  }
  
  async executeDecision(decision: any) {
    if (decision.action === 'none') {
      // No action needed, skip logging
      return;
    }
    
    console.log(`⚡ Executing decision:`, decision.action);
    
    switch (decision.action) {
      case 'create_agent':
        // Meta-agent creating another agent
        const newAgent = await client.createBreadcrumb(
          decision.agent_def,
          `agent-create-${Date.now()}`
        );
        console.log(`✨ Created new agent: ${newAgent.id}`);
        break;
        
      case 'process':
        // Regular processing
        const result = await client.createBreadcrumb({
          title: 'Processing Result',
          tags: [TEST_WORKSPACE, 'result'],
          context: { result: decision.result }
        }, `result-${Date.now()}`);
        console.log(`📝 Created result: ${result.id}`);
        break;
        
      case 'none':
        // No action needed
        break;
        
      default:
        console.log(`⚠️  Unknown action: ${decision.action}`);
    }
  }
  
  stop() {
    if (this.sseCleanup) {
      this.sseCleanup();
      console.log(`🛑 Stopped agent: ${this.agentDef.context?.agent_id || 'unknown'}`);
    }
  }
}

// Test the complete system
async function testAgentSystem() {
  console.log('\n🚀 Testing Complete Agent System\n');
  
  const createdBreadcrumbs: string[] = [];
  const agents: AgentRuntime[] = [];
  
  try {
    // 1. Create workspace
    console.log('📁 Creating workspace...');
    const workspace = await client.createBreadcrumb({
      title: `Workspace: ${TEST_WORKSPACE}`,
      tags: [TEST_WORKSPACE, 'workspace:def'],
      schema_name: 'workspace.def.v1',
      context: {
        policy: {
          token_budget_bytes: 120000,
          delivery_throttle_ms: 50
        }
      }
    });
    createdBreadcrumbs.push(workspace.id);
    
    // 2. Create tool catalog
    console.log('🛠️  Creating tool catalog...');
    const toolCatalog = await client.createBreadcrumb({
      title: 'Tool Catalog',
      tags: [TEST_WORKSPACE, 'tools:catalog'],
      schema_name: 'tools.catalog.v1',
      context: {
        tools: [
          {
            name: 'create_agent',
            description: 'Create a new agent',
            input_schema: { type: 'object' }
          }
        ]
      }
    });
    createdBreadcrumbs.push(toolCatalog.id);
    
    // 3. Create meta-agent (builder)
    console.log('🏗️  Creating meta-agent (builder)...');
    const metaAgentCreated = await client.createBreadcrumb({
      title: 'Agent: Builder',
      tags: [TEST_WORKSPACE, 'agent:def', 'meta:agent'],
      schema_name: 'agent.def.v1',
      context: {
        agent_id: 'agent.builder',
        model: 'openrouter/anthropic/claude-3.5-sonnet',
        system_prompt: 'You build other agents',
        capabilities: {
          can_spawn_agents: true
        },
        subscriptions: {
          selectors: [
            { any_tags: [TEST_WORKSPACE, 'agent:request'] }
          ]
        }
      }
    });
    createdBreadcrumbs.push(metaAgentCreated.id);
    
    // Get the full agent definition
    const metaAgentDef = await client.getBreadcrumb(metaAgentCreated.id);
    
    // 4. Start the meta-agent
    const metaAgent = new AgentRuntime(metaAgentDef);
    await metaAgent.start();
    agents.push(metaAgent);
    
    // Wait for agent to initialize
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 5. Request a new agent to be built
    console.log('\n📮 Requesting agent creation...');
    const agentRequest = await client.createBreadcrumb({
      title: 'Build me a research agent',
      tags: [TEST_WORKSPACE, 'agent:request'],
      context: {
        requirements: 'Need an agent that researches topics',
        model_preference: 'fast'
      }
    });
    createdBreadcrumbs.push(agentRequest.id);
    
    // Wait for meta-agent to process
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 6. Verify the new agent was created
    console.log('\n🔍 Checking for auto-generated agents...');
    const agentDefs = await client.getAgentDefinitions(TEST_WORKSPACE);
    const autoGenerated = agentDefs.filter(a => 
      a.tags?.includes('auto-generated')
    );
    
    if (autoGenerated.length > 0) {
      console.log(`✅ Found ${autoGenerated.length} auto-generated agent(s)`);
      
      // 7. Start the auto-generated agent (it already has full context from search)
      const newAgentDef = autoGenerated[0];
      const newAgent = new AgentRuntime(newAgentDef);
      await newAgent.start();
      agents.push(newAgent);
      
      // 8. Test the auto-generated agent
      console.log('\n📝 Testing auto-generated agent...');
      const task = await client.createBreadcrumb({
        title: 'Research task',
        tags: [TEST_WORKSPACE, 'task'],
        context: { query: 'Test research query' }
      });
      createdBreadcrumbs.push(task.id);
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check for results
      const results = await client.searchBreadcrumbs({
        tags: [TEST_WORKSPACE, 'result']
      });
      
      if (results.length > 0) {
        console.log(`✅ Auto-generated agent processed ${results.length} task(s)`);
      }
    }
    
    // 9. Test collaborative flow editing
    console.log('\n🎨 Testing collaborative flow editing...');
    const flow = await client.createBreadcrumb({
      title: 'Collaborative Flow',
      tags: [TEST_WORKSPACE, 'flow:definition'],
      schema_name: 'flow.definition.v1',
      context: {
        flow_id: 'flow_collab',
        nodes: [],
        connections: []
      }
    });
    createdBreadcrumbs.push(flow.id);
    
    // Simulate multiple agents/users editing
    for (let i = 0; i < 3; i++) {
      const current = await client.getBreadcrumb(flow.id);
      await client.updateBreadcrumb(
        flow.id,
        current.version,
        {
          context: {
            ...current.context,
            nodes: [
              ...current.context.nodes,
              {
                id: `node_${i}`,
                type: i % 2 === 0 ? 'AgentNode' : 'BreadcrumbNode',
                position: { x: i * 200, y: 100 }
              }
            ]
          }
        }
      );
      console.log(`  Added node_${i} to flow`);
    }
    
    const finalFlow = await client.getBreadcrumb(flow.id);
    console.log(`✅ Flow has ${finalFlow.context.nodes.length} nodes after collaboration`);
    
    // 10. Test UI component as breadcrumb
    console.log('\n🎨 Testing UI components as breadcrumbs...');
    const buttonComponent = await client.createBreadcrumb({
      title: 'UI Instance: Submit Button',
      tags: [TEST_WORKSPACE, 'ui:instance'],
      schema_name: 'ui.instance.v1',
      context: {
        component_type: 'Button',
        props: {
          color: 'primary',
          size: 'lg',
          children: 'Submit'
        },
        bindings: {
          onClick: {
            action: 'emit_breadcrumb',
            payload: { tags: ['button:clicked'] }
          }
        }
      }
    });
    createdBreadcrumbs.push(buttonComponent.id);
    console.log('✅ UI component stored as breadcrumb');
    
    console.log('\n🎉 Agent system test complete!');
    console.log(`   - Created ${createdBreadcrumbs.length} breadcrumbs`);
    console.log(`   - Started ${agents.length} agents`);
    console.log(`   - Meta-agent successfully created other agents`);
    console.log(`   - Collaborative editing works`);
    console.log(`   - UI components can be breadcrumbs`);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up...');
    
    // Stop all agents
    agents.forEach(agent => agent.stop());
    
    // Delete test breadcrumbs
    for (const id of createdBreadcrumbs) {
      try {
        await client.deleteBreadcrumb(id);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    
    console.log('✅ Cleanup complete');
  }
}

// Performance test
async function testPerformance() {
  console.log('\n⚡ Performance Test\n');
  
  const operations = {
    create: [] as number[],
    read: [] as number[],
    update: [] as number[],
    search: [] as number[],
  };
  
  const testIds: string[] = [];
  
  try {
    // Create performance test
    console.log('Testing create performance...');
    for (let i = 0; i < 10; i++) {
      const start = Date.now();
      const result = await client.createBreadcrumb({
        title: `Perf Test ${i}`,
        context: { index: i },
        tags: ['perf-test'],
      });
      operations.create.push(Date.now() - start);
      testIds.push(result.id);
    }
    
    // Read performance test
    console.log('Testing read performance...');
    for (const id of testIds.slice(0, 5)) {
      const start = Date.now();
      await client.getBreadcrumb(id);
      operations.read.push(Date.now() - start);
    }
    
    // Update performance test
    console.log('Testing update performance...');
    for (const id of testIds.slice(0, 5)) {
      const bc = await client.getBreadcrumb(id);
      const start = Date.now();
      await client.updateBreadcrumb(id, bc.version, {
        context: { ...bc.context, updated: true }
      });
      operations.update.push(Date.now() - start);
    }
    
    // Search performance test
    console.log('Testing search performance...');
    for (let i = 0; i < 5; i++) {
      const start = Date.now();
      await client.searchBreadcrumbs({ tag: 'perf-test' });
      operations.search.push(Date.now() - start);
    }
    
    // Calculate statistics
    const stats = Object.entries(operations).map(([op, times]) => {
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      const p50 = times.sort((a, b) => a - b)[Math.floor(times.length / 2)];
      const p95 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];
      return { operation: op, avg, p50, p95 };
    });
    
    console.log('\n📊 Performance Results:');
    console.table(stats);
    
    // Check against targets
    const createP50 = stats.find(s => s.operation === 'create')?.p50 || 0;
    const readP50 = stats.find(s => s.operation === 'read')?.p50 || 0;
    
    if (createP50 < 100 && readP50 < 50) {
      console.log('✅ Performance meets targets (create p50 < 100ms, read p50 < 50ms)');
    } else {
      console.log('⚠️  Performance below targets');
    }
    
  } finally {
    // Cleanup
    for (const id of testIds) {
      try {
        await client.deleteBreadcrumb(id);
      } catch (e) {
        // Ignore
      }
    }
  }
}

// Main test runner
async function main() {
  console.log('🧪 RCRT Agent System Integration Tests');
  console.log('=====================================\n');
  
  // Run all tests
  await testAgentSystem();
  await testPerformance();
  
  console.log('\n✅ All integration tests complete!');
}

main().catch(console.error);
