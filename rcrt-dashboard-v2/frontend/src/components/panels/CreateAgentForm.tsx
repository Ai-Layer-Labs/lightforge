import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuthentication } from '../../hooks/useAuthentication';
import { useQueryClient } from '@tanstack/react-query';

export function CreateAgentForm({ onBack, isCreating, setIsCreating }: { 
  onBack: () => void; 
  isCreating: boolean; 
  setIsCreating: (val: boolean) => void; 
}) {
  const [agentName, setAgentName] = useState('chat-assistant');
  const [agentCode, setAgentCode] = useState(getSimpleWorkingCode());
  const { authenticatedFetch } = useAuthentication();
  const queryClient = useQueryClient();

  function getSimpleWorkingCode(): string {
    return `async function execute(triggerBreadcrumb, context) {
  console.log('🤖 Simple chat agent triggered!');
  
  const userMessage = triggerBreadcrumb.context.content || triggerBreadcrumb.title;
  const conversationId = triggerBreadcrumb.context.conversation_id || 'simple-chat';
  
  // Simple immediate response
  const response = \`Hello! You said: "\${userMessage}". I'm your simple chat agent and I'm working perfectly!\`;
  
  // Create response breadcrumb
  await context.rcrtClient.createBreadcrumb({
    schema_name: 'agent.response.v1',
    title: 'Simple Chat Response',
    tags: ['agent:response', 'chat:response', 'workspace:agents'],
    context: {
      agent_name: '${agentName}',
      conversation_id: conversationId,
      response_to: triggerBreadcrumb.id,
      content: response,
      timestamp: new Date().toISOString()
    }
  });
  
  console.log('✅ Simple chat agent responded:', response);
  return { response };
}`;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      const agentDefinition = {
        title: `${agentName} Agent`,
        schema_name: 'agent.definition.v1',
        tags: ['agent:definition', 'workspace:agents', `agent:${agentName}`],
        context: {
          agent_name: agentName,
          agent_entity_id: '00000000-0000-0000-0000-0000000000aa',
          description: 'Chat assistant that responds to user messages and can use tools',
          version: '1.0.0',
          category: 'chat',
          
          triggers: [{
            selector: {
              any_tags: ["chat:message"]
            }
          }],
          
          capabilities: {
            can_create: true,
            can_modify: false,
            can_use_tools: true,
            can_create_agents: false,
            max_execution_time: 30000
          },
          
          execution: {
            type: 'javascript',
            code: `async function execute(triggerBreadcrumb, context) {
  console.log('🤖 Chat Agent triggered by:', triggerBreadcrumb.title);
  
  const userMessage = triggerBreadcrumb.context.content || triggerBreadcrumb.title;
  const conversationId = triggerBreadcrumb.context.conversation_id || \`conv-\${Date.now()}\`;
  
  // Get available tools from catalog
  const toolCatalog = await context.rcrtClient.searchBreadcrumbs({
    tags: ['tool:catalog']
  });
  
  let availableTools = [];
  if (toolCatalog.length > 0) {
    const catalog = await context.rcrtClient.getBreadcrumb(toolCatalog[0].id);
    availableTools = catalog.context?.tools || [];
  }
  
  // Simple response with tool awareness
  let response = '';
  const lowerMessage = userMessage.toLowerCase();
  
  if (lowerMessage.includes('calculate') || lowerMessage.includes('math')) {
    response = \`I can help with calculations! I have access to \${availableTools.length} tools including calculator.\`;
  } else if (lowerMessage.includes('search') || lowerMessage.includes('web')) {
    response = \`I can search the web for you using the browser tool!\`;
  } else {
    response = \`Hello! You said: "\${userMessage}". I'm your chat assistant with access to \${availableTools.length} tools!\`;
  }
  
  // Create agent response breadcrumb
  await context.rcrtClient.createBreadcrumb({
    schema_name: 'agent.response.v1',
    title: 'Chat Assistant Response',
    tags: ['agent:response', 'chat:response', 'workspace:agents'],
    context: {
      agent_name: '${agentName}',
      conversation_id: conversationId,
      response_to: triggerBreadcrumb.id,
      content: response,
      tools_available: availableTools.length,
      timestamp: new Date().toISOString()
    }
  });
  
  console.log('💬 Chat agent created response:', response);
  return { response, toolsAvailable: availableTools.length };
}`
          }
        }
      };

      console.log('🤖 Creating agent definition:', agentDefinition);

      const response = await authenticatedFetch('/api/breadcrumbs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(agentDefinition),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Agent definition created successfully:', result.id);
        
        // Refresh data
        queryClient.invalidateQueries({ queryKey: ['breadcrumbs'] });
        
        // Go back to main panel
        setTimeout(() => onBack(), 1000);
      } else {
        const error = await response.text();
        console.error('❌ Failed to create agent definition:', error);
        alert(`Failed to create agent: ${error}`);
      }
    } catch (error) {
      console.error('❌ Error creating agent definition:', error);
      alert(`Error: ${error}`);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={onBack}
          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-colors"
        >
          ←
        </button>
        <h4 className="text-lg font-semibold text-white">🤖 Create Agent Definition</h4>
      </div>

      <div className="space-y-4">
        <div className="bg-purple-500/10 border border-purple-400/30 rounded-lg p-4">
          <h5 className="text-sm font-medium text-purple-300 mb-3">🎯 Chat Agent Features</h5>
          <div className="text-xs text-gray-300 space-y-2">
            <div>• <strong>Subscribes to:</strong> Tool catalog changes</div>
            <div>• <strong>Triggers on:</strong> User chat messages (chat:message tag)</div>
            <div>• <strong>Can use:</strong> All available tools (OpenRouter, Calculator, etc.)</div>
            <div>• <strong>Creates:</strong> Agent response breadcrumbs</div>
            <div>• <strong>Links to:</strong> Existing agent entity</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Agent Name *</label>
            <input
              type="text"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              required
              className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-purple-400 focus:outline-none"
              placeholder="chat-assistant"
            />
            <p className="text-xs text-gray-500 mt-1">Unique identifier for this agent</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Agent Code *</label>
            <textarea
              value={agentCode}
              onChange={(e) => setAgentCode(e.target.value)}
              rows={12}
              className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-purple-400 focus:outline-none font-mono text-xs"
              placeholder="async function execute(triggerBreadcrumb, context) { ... }"
            />
            <p className="text-xs text-gray-500 mt-1">JavaScript code that executes when triggered</p>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!agentName || !agentCode || isCreating}
              className="flex-1 px-4 py-2 bg-purple-500/20 border border-purple-400/50 rounded-lg text-purple-300 hover:bg-purple-500/30 transition-colors disabled:opacity-50"
            >
              {isCreating ? '⏳ Creating Chat Agent...' : '🤖 Create Chat Agent'}
            </button>
            
            <button
              type="button"
              onClick={() => setAgentCode(getSimpleWorkingCode())}
              className="px-4 py-2 bg-green-500/20 border border-green-400/50 rounded-lg text-green-300 hover:bg-green-500/30 transition-colors"
            >
              📝 Simple Code
            </button>
          </div>
        </form>
      </div>
    </motion.div>
  );
}
