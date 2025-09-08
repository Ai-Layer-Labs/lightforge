#!/usr/bin/env tsx
/**
 * Bootstrap Script
 * Initializes the RCRT Visual Builder system with necessary breadcrumbs
 */

import { RcrtClientEnhanced } from '@rcrt-builder/sdk';
import { 
  WorkspaceDefinitionV1,
  ToolsCatalogV1,
  AgentDefinitionV1,
  NodeTemplateV1,
  FlowDefinitionV1
} from '@rcrt-builder/core';

const RCRT_URL = process.env.RCRT_URL || 'http://localhost:8081';
const WORKSPACE = process.env.WORKSPACE || 'workspace:builder';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';

async function bootstrap() {
  console.log('🚀 RCRT Visual Builder Bootstrap');
  console.log('================================');
  console.log(`RCRT URL: ${RCRT_URL}`);
  console.log(`Workspace: ${WORKSPACE}`);
  
  const client = new RcrtClientEnhanced(RCRT_URL);
  
  try {
    const safeCreate = async (body: any, key?: string) => {
      try {
        return await client.createBreadcrumb(body as any, key);
      } catch (e: any) {
        const msg = String(e?.message || e);
        if (msg.toLowerCase().includes('duplicate idempotency key')) {
          // Idempotent: skip create and continue
          return { id: 'skip' } as any;
        }
        throw e;
      }
    };
    // 1. Create workspace definition
    console.log('\n📁 Creating workspace...');
    const workspace: Partial<WorkspaceDefinitionV1> = {
      schema_name: 'workspace.def.v1',
      title: 'Visual Builder Workspace',
      tags: [WORKSPACE, 'workspace:def'],
      context: {
        workspace_id: WORKSPACE,
        name: 'Visual Builder',
        description: 'RCRT Visual Agent Builder System',
        policy: {
          token_budget_bytes: 120000,
          delivery_throttle_ms: 50,
        },
        quotas: {
          max_breadcrumbs: 100000,
          max_agents: 100,
          max_flows: 1000,
        },
        settings: {
          default_model: 'openrouter/anthropic/claude-3.5-sonnet',
          features: ['agent-builder', 'flow-editor', 'real-time-collaboration'],
        },
      },
    };
    
    await safeCreate(workspace, 'workspace-init');
    console.log('   ✅ Workspace created');
    
    // 2. Create tool catalog
    console.log('\n🛠️  Creating tool catalog...');
    const toolsCatalog: Partial<ToolsCatalogV1> = {
      schema_name: 'tools.catalog.v1',
      title: 'Builder Tool Catalog',
      tags: [WORKSPACE, 'tools:catalog'],
      context: {
        tools: [
          {
            name: 'create_agent',
            description: 'Create a new agent',
            input_schema: {
              type: 'object',
              properties: {
                agent_id: { type: 'string' },
                model: { type: 'string' },
                system_prompt: { type: 'string' },
                capabilities: { type: 'object' },
              },
              required: ['agent_id', 'model', 'system_prompt'],
            },
            executor: 'native:rcrt',
          },
          {
            name: 'create_flow',
            description: 'Create a new flow',
            input_schema: {
              type: 'object',
              properties: {
                flow_id: { type: 'string' },
                nodes: { type: 'array' },
                connections: { type: 'array' },
              },
              required: ['flow_id', 'nodes'],
            },
            executor: 'native:rcrt',
          },
          {
            name: 'vector_search',
            description: 'Search breadcrumbs by semantic similarity',
            input_schema: {
              type: 'object',
              properties: {
                query: { type: 'string' },
                workspace: { type: 'string' },
                limit: { type: 'number', default: 10 },
              },
              required: ['query'],
            },
            executor: 'native:rcrt',
          },
          {
            name: 'web_search',
            description: 'Search the web for information',
            input_schema: {
              type: 'object',
              properties: {
                query: { type: 'string' },
                max_results: { type: 'number', default: 5 },
              },
              required: ['query'],
            },
            executor: 'tool.runner.web',
          },
        ],
      },
    };
    
    await safeCreate(toolsCatalog, 'tools-init');
    console.log('   ✅ Tool catalog created');
    
    // 3. Create meta-agent (builder agent)
    console.log('\n🤖 Creating meta-agent...');
    const metaAgent: Partial<AgentDefinitionV1> = {
      schema_name: 'agent.def.v1',
      title: 'Agent: Builder',
      tags: [WORKSPACE, 'agent:def', 'meta:agent'],
      context: {
        agent_id: 'agent.builder',
        model: 'openrouter/anthropic/claude-3.5-sonnet',
        system_prompt: `You are the Builder Agent for the RCRT Visual Builder System.

Your role is to help users build other agents and flows by creating appropriate breadcrumbs.

When asked to create an agent:
1. Generate an agent.def.v1 breadcrumb with appropriate configuration
2. Ensure the agent has proper capabilities and subscriptions
3. Return exactly ONE agent definition per request

When asked to create a flow:
1. Generate a flow.definition.v1 breadcrumb with nodes and connections
2. Ensure all connections are valid
3. Return exactly ONE flow definition per request

Always respond with valid JSON that can be parsed into breadcrumbs.`,
        capabilities: {
          can_create_breadcrumbs: true,
          can_update_own: true,
          can_delete_own: true,
          can_spawn_agents: true,
          can_modify_agents: true,
          can_create_flows: true,
        },
        subscriptions: {
          selectors: [
            { any_tags: [WORKSPACE, 'agent:request'] },
            { any_tags: [WORKSPACE, 'flow:request'] },
            { any_tags: [WORKSPACE, 'optimize:request'] },
          ],
        },
        emits: {
          tags: ['agent:created', 'flow:created'],
          schemas: ['agent.def.v1', 'flow.definition.v1'],
        },
        memory: {
          type: 'breadcrumb',
          tags: ['agent.builder:memory'],
          ttl_hours: 24,
        },
      },
    };
    
    const metaAgentResult = await safeCreate(metaAgent, 'meta-agent-init');
    console.log(`   ✅ Meta-agent created: ${metaAgentResult.id}`);
    
    // 4. Create basic node templates
    console.log('\n📦 Creating node templates...');
    
    const nodeTemplates = [
      {
        title: 'LLM Node Template',
        node_type: 'LLMNode',
        category: 'llm',
        icon: '🧠',
        color: '#9353d3',
      },
      {
        title: 'Agent Node Template',
        node_type: 'AgentNode',
        category: 'agent',
        icon: '🤖',
        color: '#7828c8',
      },
      {
        title: 'Breadcrumb Node Template',
        node_type: 'BreadcrumbNode',
        category: 'core',
        icon: '📝',
        color: '#0072f5',
      },
      {
        title: 'Router Node Template',
        node_type: 'RouterLLMNode',
        category: 'llm',
        icon: '🔀',
        color: '#f31260',
      },
      {
        title: 'Classifier Node Template',
        node_type: 'ClassifierLLMNode',
        category: 'llm',
        icon: '🏷️',
        color: '#f5a524',
      },
    ];
    
    for (const template of nodeTemplates) {
      const nodeTemplate: Partial<NodeTemplateV1> = {
        schema_name: 'node.template.v1',
        title: template.title,
        tags: ['node:template', template.category, template.node_type, WORKSPACE],
        context: {
          node_type: template.node_type,
          category: template.category,
          icon: template.icon,
          color: template.color,
          ports: {
            inputs: [{ id: 'input', type: 'data' }],
            outputs: [{ id: 'output', type: 'data' }],
          },
          config_ui: {
            fields: [],
          },
          executor: {
            runtime: 'typescript',
            module: `@rcrt-builder/nodes-${template.category}`,
            handler: template.node_type,
          },
        },
      };
      
      await safeCreate(nodeTemplate, `template-${template.node_type}`);
      console.log(`   ✅ ${template.title} created`);
    }
    
    // 5. Create example flow
    console.log('\n📊 Creating example flow...');
    const exampleFlow: Partial<FlowDefinitionV1> = {
      schema_name: 'flow.definition.v1',
      title: 'Example: Agent Creation Pipeline',
      tags: [WORKSPACE, 'flow:definition', 'example'],
      context: {
        flow_id: 'flow-example-agent-pipeline',
        version: 1,
        nodes: [
          {
            id: 'trigger',
            type: 'EventStreamNode',
            position: { x: 100, y: 200 },
            config: {
              mode: 'sse',
              filters: { tags: ['agent:request'] },
            },
          },
          {
            id: 'builder',
            type: 'AgentNode',
            position: { x: 400, y: 200 },
            config: {
              agent_ref: 'agent.builder',
            },
          },
          {
            id: 'output',
            type: 'BreadcrumbNode',
            position: { x: 700, y: 200 },
            config: {
              operation: 'create',
              workspace: WORKSPACE,
            },
          },
        ],
        connections: [
          {
            from: { node: 'trigger', port: 'event' },
            to: { node: 'builder', port: 'trigger' },
          },
          {
            from: { node: 'builder', port: 'emitter' },
            to: { node: 'output', port: 'emitter' },
          },
        ],
        viewport: { x: 0, y: 0, zoom: 1 },
        metadata: {
          created_by: 'bootstrap',
          created_at: new Date().toISOString(),
          description: 'Example flow for creating agents via the builder agent',
        },
      },
    };
    
    await safeCreate(exampleFlow, 'flow-example');
    console.log('   ✅ Example flow created');
    
    // 6. Create secrets vault placeholder
    console.log('\n🔐 Creating secrets vault...');
    const secretsVault = {
      schema_name: 'secrets.vault.v1',
      title: 'Builder Secrets Vault',
      tags: [WORKSPACE, 'secrets:vault'],
      context: {
        secret_ids: {
          OPENROUTER_API_KEY: OPENROUTER_API_KEY ? 'configured' : 'missing',
        },
        metadata: {
          created_at: new Date().toISOString(),
          created_by: 'bootstrap',
          encryption: 'aes-256-gcm',
        },
      },
    };
    
    await safeCreate(secretsVault, 'secrets-vault-init');
    console.log('   ✅ Secrets vault created');
    
    // 7. Create UI component templates (HeroUI)
    console.log('\n🧩 Creating HeroUI component templates...');
    const components = [
      { component_type: 'Navbar', title: 'UI Component: Navbar' },
      { component_type: 'Card', title: 'UI Component: Card' },
      { component_type: 'Button', title: 'UI Component: Button' },
      { component_type: 'Tabs', title: 'UI Component: Tabs' },
      { component_type: 'Input', title: 'UI Component: Input' }
    ];
    for (const c of components) {
      await safeCreate({
        schema_name: 'ui.component.v1',
        title: c.title,
        tags: [WORKSPACE, 'ui:component', `heroui:${c.component_type.toLowerCase()}`],
        context: {
          component_type: c.component_type,
          library: 'heroui',
          props_schema: {},
          event_handlers: ['onClick', 'onChange', 'onPress']
        }
      }, `ui-component-${c.component_type}`);
    }
    console.log('   ✅ UI component templates created');

    // 8. Create bootstrap UI instances
    console.log('\n🧱 Creating bootstrap UI instances...');
    // Layout with regions
    await safeCreate({
      schema_name: 'ui.layout.v1',
      title: 'Builder Layout',
      tags: [WORKSPACE, 'ui:layout'],
      context: {
        regions: ['top', 'content', 'right'],
        container: { className: 'min-h-screen flex flex-col bg-content' },
        regionStyles: {
          top: { className: 'border-b border-default bg-background p-2 flex gap-2 items-center' },
          content: { className: 'flex-1 container mx-auto p-4' },
          right: { className: 'w-80 p-2 border-l border-default' }
        }
      }
    }, 'ui-layout-builder');

    // Theme and inline CSS
    await safeCreate({
      schema_name: 'ui.theme.v1',
      title: 'Builder Theme',
      tags: [WORKSPACE, 'ui:theme'],
      context: {
        className: 'light',
        layout: {
          radius: 8
        },
        colors: {
          primary: '#0072f5'
        }
      }
    }, 'ui-theme-builder');
    await safeCreate({
      schema_name: 'ui.styles.v1',
      title: 'Builder Inline Styles',
      tags: [WORKSPACE, 'ui:styles'],
      context: {
        css: ':root{--rcrt-accent:#0072f5;} .container{max-width:1280px;}'
      }
    }, 'ui-styles-builder');
    const navbar = await safeCreate({
      schema_name: 'ui.instance.v1',
      title: 'Navbar: Builder',
      tags: [WORKSPACE, 'ui:instance', 'region:top'],
      context: {
        component_ref: 'Navbar',
        props: { shouldHideOnScroll: false },
        order: 0
      }
    }, 'ui-instance-navbar');

    await safeCreate({
      schema_name: 'ui.instance.v1',
      title: 'Card: Canvas Container',
      tags: [WORKSPACE, 'ui:instance', 'region:content'],
      context: {
        component_ref: 'BuilderCanvas',
        props: { className: 'm-4 p-2 min-h-[70vh] border border-default rounded-md' },
        order: 1
      }
    }, 'ui-instance-card-canvas');

    await safeCreate({
      schema_name: 'ui.instance.v1',
      title: 'Button: Save Flow',
      tags: [WORKSPACE, 'ui:instance', 'region:top'],
      context: {
        component_ref: 'Button',
        props: { color: 'primary', children: 'Save Flow' },
        bindings: {
          onPress: {
            action: 'emit_breadcrumb',
            payload: {
              schema_name: 'ui.event.v1',
              title: 'Save Flow Pressed',
              tags: ['ui:event', WORKSPACE],
              context: { event: 'save_flow' }
            }
          }
        },
        order: 2
      }
    }, 'ui-instance-button-save');

    // Right side palette
    await safeCreate({
      schema_name: 'ui.instance.v1',
      title: 'Builder Palette',
      tags: [WORKSPACE, 'ui:instance', 'region:right'],
      context: {
        component_ref: 'BuilderPalette',
        props: { className: 'h-full' },
        order: 0
      }
    }, 'ui-instance-builder-palette');

    console.log('   ✅ Bootstrap UI instances created');

    // 9. Summary
    console.log('\n' + '='.repeat(50));
    console.log('✅ Bootstrap Complete!');
    console.log('='.repeat(50));
    console.log('\n📋 Created Resources:');
    console.log('   • Workspace definition');
    console.log('   • Tool catalog');
    console.log('   • Meta-agent (Builder)');
    console.log('   • Node templates (5)');
    console.log('   • Example flow');
    console.log('   • Secrets vault');
    console.log('   • UI component templates (HeroUI)');
    console.log('   • Bootstrap UI instances (Navbar/Card/Button)');
    
    console.log('\n🚀 Next Steps:');
    console.log('   1. Start the RCRT backend: docker-compose up rcrt');
    console.log('   2. Install dependencies: pnpm install');
    console.log('   3. Build packages: pnpm build');
    console.log('   4. Start the builder UI: pnpm --filter builder dev');
    console.log('   5. Start the agent runner: pnpm --filter agent-runner dev');
    
    if (!OPENROUTER_API_KEY) {
      console.log('\n⚠️  Warning: OPENROUTER_API_KEY not set');
      console.log('   Set it in .env or as environment variable for LLM functionality');
    }
    
  } catch (error) {
    console.error('❌ Bootstrap failed:', error);
    process.exit(1);
  }
}

// Run bootstrap
bootstrap().catch(console.error);
