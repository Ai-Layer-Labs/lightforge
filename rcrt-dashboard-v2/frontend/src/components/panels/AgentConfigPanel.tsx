import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSelectedNodes } from '../../stores/DashboardStore';
import { SubscriptionEditor } from './SubscriptionEditor';
import {
  CpuChipIcon,
  Cog6ToothIcon,
  CheckIcon,
  XMarkIcon,
  PlusIcon,
  TrashIcon,
  DocumentTextIcon,
  TagIcon,
  ChatBubbleLeftRightIcon,
  WrenchScrewdriverIcon
} from '@heroicons/react/24/outline';

interface AgentDefinition {
  id: string;
  title: string;
  version: number;
  schema_name: string;
  tags: string[];
  context: {
    agent_id: string;
    llm_config?: {
      type: string;
      schema_name: string;
      tag: string;
      comment?: string;
    };
    system_prompt: string;
    capabilities: {
      can_create_breadcrumbs: boolean;
      can_update_own: boolean;
      can_delete_own: boolean;
      can_spawn_agents: boolean;
    };
    subscriptions: {
      selectors: Array<{
        comment?: string;
        schema_name?: string;
        any_tags?: string[];
        all_tags?: string[];
        context_match?: any[];
        role?: string;
        key?: string;
        fetch?: any;
      }>;
    };
    metadata?: any;
  };
}

interface LLMConfig {
  id: string;
  title: string;
  tags: string[];
  context: {
    toolName: string;
    config: {
      defaultModel?: string;
      temperature?: number;
      maxTokens?: number;
    };
  };
}

export function AgentConfigPanel() {
  const selectedNodes = useSelectedNodes?.() || [];
  const [agents, setAgents] = useState<AgentDefinition[]>([]);
  const [llmConfigs, setLlmConfigs] = useState<LLMConfig[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<AgentDefinition | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<Partial<AgentDefinition['context']>>({});
  
  // Auto-open agent if selected from canvas
  useEffect(() => {
    if (selectedNodes.length > 0) {
      const node = selectedNodes[0];
      if (node.type === 'agent-definition' || node.data?.schema_name === 'agent.def.v1') {
        // Find this agent in our list
        const agent = agents.find(a => a.id === node.id || a.context.agent_id === node.data?.context?.agent_id);
        if (agent && !editing) {
          startEditing(agent);
        }
      }
    }
  }, [selectedNodes, agents]);

  const RCRT_BASE_URL = import.meta.env.VITE_RCRT_BASE_URL || 'http://localhost:8081';

  // Get auth token
  const getToken = async () => {
    const response = await fetch(`${RCRT_BASE_URL}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        owner_id: '00000000-0000-0000-0000-000000000001',
        agent_id: '00000000-0000-0000-0000-000000000AAA',
        roles: ['curator', 'emitter', 'subscriber']
      })
    });
    const data = await response.json();
    return data.token;
  };

  // Load agents
  const loadAgents = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = await getToken();
      
      // Search for agent.def.v1 breadcrumbs
      const response = await fetch(
        `${RCRT_BASE_URL}/breadcrumbs?schema_name=agent.def.v1&tag=workspace:agents`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      
      if (!response.ok) {
        throw new Error(`Failed to load agents: ${response.status}`);
      }
      
      const agentList = await response.json();
      
      // Fetch full details for each agent
      const fullAgents = await Promise.all(
        agentList.map(async (agent: any) => {
          const detailResponse = await fetch(
            `${RCRT_BASE_URL}/breadcrumbs/${agent.id}/full`,
            {
              headers: { 'Authorization': `Bearer ${token}` }
            }
          );
          return detailResponse.json();
        })
      );
      
      setAgents(fullAgents);
      
      // Load LLM configs for selection
      const configResponse = await fetch(
        `${RCRT_BASE_URL}/breadcrumbs?schema_name=tool.config.v1`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      
      if (configResponse.ok) {
        const configList = await configResponse.json();
        const fullConfigs = await Promise.all(
          configList.map(async (cfg: any) => {
            const detailResponse = await fetch(
              `${RCRT_BASE_URL}/breadcrumbs/${cfg.id}/full`,
              {
                headers: { 'Authorization': `Bearer ${token}` }
              }
            );
            return detailResponse.json();
          })
        );
        setLlmConfigs(fullConfigs);
      }
      
    } catch (err: any) {
      setError(err.message);
      console.error('Failed to load agents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAgents();
  }, []);

  // Start editing
  const startEditing = (agent: AgentDefinition) => {
    setSelectedAgent(agent);
    setFormData(agent.context);
    setEditing(true);
  };

  // Save changes
  const saveAgent = async () => {
    if (!selectedAgent || !formData) return;
    
    try {
      setSaving(true);
      setError(null);
      
      const token = await getToken();
      
      // Update breadcrumb
      const response = await fetch(
        `${RCRT_BASE_URL}/breadcrumbs/${selectedAgent.id}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'If-Match': selectedAgent.version.toString()
          },
          body: JSON.stringify({
            context: formData
          })
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update agent: ${errorText}`);
      }
      
      // Reload agents
      await loadAgents();
      
      setEditing(false);
      setSelectedAgent(null);
      
    } catch (err: any) {
      setError(err.message);
      console.error('Failed to save agent:', err);
    } finally {
      setSaving(false);
    }
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditing(false);
    setSelectedAgent(null);
    setFormData({});
  };

  // Update form field
  const updateField = (path: string, value: any) => {
    setFormData(prev => {
      const updated = { ...prev };
      const parts = path.split('.');
      let current: any = updated;
      
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) {
          current[parts[i]] = {};
        }
        current = current[parts[i]];
      }
      
      current[parts[parts.length - 1]] = value;
      return updated;
    });
  };

  // Toggle capability
  const toggleCapability = (key: string) => {
    setFormData(prev => ({
      ...prev,
      capabilities: {
        ...prev.capabilities,
        [key]: !prev.capabilities?.[key]
      }
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <CpuChipIcon className="w-12 h-12 mx-auto mb-4 text-blue-500 animate-pulse" />
          <p className="text-gray-400">Loading agents...</p>
        </div>
      </div>
    );
  }

  if (error && !editing) {
    return (
      <div className="p-6">
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <p className="text-red-400">{error}</p>
          <button
            onClick={loadAgents}
            className="mt-4 px-4 py-2 bg-red-500/20 text-red-300 rounded hover:bg-red-500/30"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <CpuChipIcon className="w-6 h-6 text-blue-500" />
          <h2 className="text-xl font-semibold text-white">Agent Configuration</h2>
        </div>
        <button
          onClick={loadAgents}
          className="px-3 py-1.5 bg-gray-800 text-gray-300 rounded hover:bg-gray-700 text-sm"
        >
          Refresh
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {!editing ? (
          /* Agent List */
          <div className="p-4 space-y-3">
            {agents.length === 0 ? (
              <div className="text-center py-12">
                <CpuChipIcon className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                <p className="text-gray-400">No agents found</p>
                <p className="text-gray-500 text-sm mt-2">Create an agent.def.v1 breadcrumb to get started</p>
              </div>
            ) : (
              agents.map(agent => (
                <motion.div
                  key={agent.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 hover:border-blue-500/50 transition-all cursor-pointer"
                  onClick={() => startEditing(agent)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <ChatBubbleLeftRightIcon className="w-5 h-5 text-blue-400" />
                        <h3 className="font-semibold text-white">{agent.title}</h3>
                      </div>
                      
                      <div className="text-sm text-gray-400 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">ID:</span>
                          <code className="text-blue-400 font-mono text-xs">
                            {agent.context.agent_id}
                          </code>
                        </div>
                        
                        {agent.context.llm_config && (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500">LLM:</span>
                            <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded text-xs">
                              {agent.context.llm_config.tag}
                            </span>
                          </div>
                        )}
                        
                        <div className="flex flex-wrap gap-1 mt-2">
                          {agent.tags.slice(0, 3).map(tag => (
                            <span
                              key={tag}
                              className="px-2 py-0.5 bg-gray-700 text-gray-300 rounded text-xs"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    <Cog6ToothIcon className="w-5 h-5 text-gray-500" />
                  </div>
                </motion.div>
              ))
            )}
          </div>
        ) : (
          /* Agent Edit Form */
          <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Cog6ToothIcon className="w-5 h-5" />
                Edit Agent: {selectedAgent?.title}
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={cancelEditing}
                  disabled={saving}
                  className="px-4 py-2 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 disabled:opacity-50"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
                <button
                  onClick={saveAgent}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-50 flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckIcon className="w-5 h-5" />
                      Save
                    </>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* Agent ID */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Agent ID
              </label>
              <input
                type="text"
                value={formData.agent_id || ''}
                onChange={(e) => updateField('agent_id', e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:border-blue-500 focus:outline-none font-mono text-sm"
                placeholder="my-agent-id"
              />
              <p className="text-xs text-gray-500 mt-1">Unique identifier for this agent</p>
            </div>

            {/* LLM Configuration */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                <WrenchScrewdriverIcon className="w-4 h-4" />
                LLM Configuration
              </label>
              
              <select
                value={(formData as any).llm_config_id || ''}
                onChange={(e) => updateField('llm_config_id', e.target.value || null)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:border-blue-500 focus:outline-none"
              >
                <option value="">Select LLM Configuration...</option>
                {llmConfigs.map(config => (
                  <option key={config.id} value={config.id}>
                    {config.context.toolName} - {config.context.config.defaultModel || 'default'}
                    {config.context.config.temperature && ` (temp: ${config.context.config.temperature})`}
                  </option>
                ))}
              </select>
              
              <p className="text-xs text-gray-500 mt-1">
                Agent will use this LLM configuration. Tool loads config from breadcrumb at runtime.
              </p>
              
              {(formData as any).llm_config_id && (
                <div className="mt-2 p-3 bg-purple-500/10 border border-purple-500/20 rounded">
                  <p className="text-xs text-purple-300">
                    <strong>Config ID:</strong> {(formData as any).llm_config_id}
                  </p>
                  <p className="text-xs text-purple-400 mt-1">
                    Tool will load this breadcrumb to get model, temperature, etc.
                  </p>
                </div>
              )}
              
              {!(formData as any).llm_config_id && (
                <div className="mt-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded">
                  <p className="text-xs text-yellow-300">
                    ⚠️ No LLM config selected. Agent won't be able to respond to messages.
                  </p>
                </div>
              )}
            </div>

            {/* System Prompt */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                <DocumentTextIcon className="w-4 h-4" />
                System Prompt
              </label>
              <textarea
                value={formData.system_prompt || ''}
                onChange={(e) => updateField('system_prompt', e.target.value)}
                rows={8}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:border-blue-500 focus:outline-none font-mono text-sm"
                placeholder="You are a helpful AI assistant..."
              />
              <p className="text-xs text-gray-500 mt-1">
                Instructions that define the agent's behavior
              </p>
            </div>

            {/* Capabilities */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Capabilities
              </label>
              <div className="space-y-2">
                {[
                  { key: 'can_create_breadcrumbs', label: 'Can Create Breadcrumbs', desc: 'Allow agent to create new breadcrumbs' },
                  { key: 'can_update_own', label: 'Can Update Own', desc: 'Allow agent to update its own breadcrumbs' },
                  { key: 'can_delete_own', label: 'Can Delete Own', desc: 'Allow agent to delete its own breadcrumbs' },
                  { key: 'can_spawn_agents', label: 'Can Spawn Agents', desc: 'Allow agent to create other agents' }
                ].map(({ key, label, desc }) => (
                  <label
                    key={key}
                    className="flex items-start gap-3 p-3 bg-gray-800/50 rounded hover:bg-gray-800 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={formData.capabilities?.[key as keyof typeof formData.capabilities] || false}
                      onChange={() => toggleCapability(key)}
                      className="mt-1 w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-200">{label}</div>
                      <div className="text-xs text-gray-500">{desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Subscriptions Editor */}
            <div>
              <SubscriptionEditor
                subscriptions={formData.subscriptions?.selectors || []}
                onChange={(newSelectors) => {
                  setFormData(prev => ({
                    ...prev,
                    subscriptions: {
                      ...prev.subscriptions,
                      selectors: newSelectors
                    }
                  }));
                }}
              />
            </div>

            {/* Metadata Preview */}
            {formData.metadata && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Metadata
                </label>
                <div className="bg-gray-800/50 rounded border border-gray-700 p-3">
                  <pre className="text-xs text-gray-400 overflow-x-auto">
                    {JSON.stringify(formData.metadata, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t border-gray-800">
              <button
                onClick={cancelEditing}
                disabled={saving}
                className="flex-1 px-4 py-3 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveAgent}
                disabled={saving}
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving Changes...
                  </>
                ) : (
                  <>
                    <CheckIcon className="w-5 h-5" />
                    Save Configuration
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
