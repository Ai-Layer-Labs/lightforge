/**
 * LLM Node Component
 * Visual representation of LLM nodes in the flow canvas
 */

import React, { memo, useState } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Card, Badge, Tooltip, Modal, Input, Textarea, Select, Slider } from '@heroui/react';
import { BaseNode } from './BaseNode';

export interface LLMNodeData {
  model?: string;
  system_prompt?: string;
  temperature?: number;
  max_tokens?: number;
  tools?: any[];
  workspace?: string;
  variant?: 'base' | 'classifier' | 'summarizer' | 'router' | 'codegen';
  categories?: string[];
  summary_type?: string;
  routes?: Array<{ name: string; description: string }>;
  language?: string;
}

const LLM_MODELS = [
  { value: 'openrouter/anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet' },
  { value: 'openrouter/openai/gpt-4o', label: 'GPT-4o' },
  { value: 'openrouter/openai/gpt-4o-mini', label: 'GPT-4o Mini' },
  { value: 'openrouter/google/gemini-pro-1.5', label: 'Gemini Pro 1.5' },
  { value: 'openrouter/meta-llama/llama-3.1-70b-instruct', label: 'Llama 3.1 70B' },
];

const VARIANT_CONFIG = {
  base: { icon: '🧠', color: '#9353d3', title: 'LLM' },
  classifier: { icon: '🏷️', color: '#f5a524', title: 'Classifier' },
  summarizer: { icon: '📄', color: '#17c964', title: 'Summarizer' },
  router: { icon: '🔀', color: '#f31260', title: 'Router' },
  codegen: { icon: '💻', color: '#0072f5', title: 'Code Gen' },
};

export const LLMNodeComponent = memo<NodeProps<LLMNodeData>>(({ 
  id, 
  data, 
  selected,
  isConnectable 
}) => {
  const [showConfig, setShowConfig] = useState(false);
  const [nodeData, setNodeData] = useState<LLMNodeData>(data);
  
  const variant = nodeData.variant || 'base';
  const config = VARIANT_CONFIG[variant];

  const handleSave = () => {
    // Update node data in flow store
    data = nodeData;
    setShowConfig(false);
  };

  return (
    <>
      <BaseNode
        id={id}
        selected={selected}
        icon={config.icon}
        title={config.title}
        color={config.color}
        onDoubleClick={() => setShowConfig(true)}
      >
        {/* Input handles */}
        <Handle
          type="target"
          position={Position.Left}
          id="messages"
          style={{ 
            background: '#9353d3',
            width: 12,
            height: 12,
            left: -6
          }}
          isConnectable={isConnectable}
        >
          <Tooltip content="Messages Input">
            <div />
          </Tooltip>
        </Handle>

        {/* Output handles */}
        <Handle
          type="source"
          position={Position.Right}
          id="response"
          style={{ 
            background: '#17c964',
            width: 12,
            height: 12,
            right: -6
          }}
          isConnectable={isConnectable}
        >
          <Tooltip content="Response Output">
            <div />
          </Tooltip>
        </Handle>

        {nodeData.tools && nodeData.tools.length > 0 && (
          <Handle
            type="source"
            position={Position.Right}
            id="tool_calls"
            style={{ 
              background: '#f5a524',
              width: 12,
              height: 12,
              right: -6,
              top: '70%'
            }}
            isConnectable={isConnectable}
          >
            <Tooltip content="Tool Calls">
              <div />
            </Tooltip>
          </Handle>
        )}

        {/* Node content */}
        <div style={{ padding: '8px 12px' }}>
          <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '4px' }}>
            {nodeData.model?.split('/').pop() || 'No model selected'}
          </div>
          
          {variant === 'classifier' && nodeData.categories && (
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {nodeData.categories.slice(0, 3).map((cat, i) => (
                <Badge key={i} size="sm" variant="flat" color="primary">
                  {cat}
                </Badge>
              ))}
              {nodeData.categories.length > 3 && (
                <Badge size="sm" variant="flat">
                  +{nodeData.categories.length - 3}
                </Badge>
              )}
            </div>
          )}
          
          {variant === 'summarizer' && nodeData.summary_type && (
            <Badge size="sm" variant="flat" color="success">
              {nodeData.summary_type}
            </Badge>
          )}
          
          {variant === 'router' && nodeData.routes && (
            <div style={{ fontSize: '0.75rem', color: '#888' }}>
              {nodeData.routes.length} routes
            </div>
          )}
          
          {variant === 'codegen' && nodeData.language && (
            <Badge size="sm" variant="flat" color="primary">
              {nodeData.language}
            </Badge>
          )}
          
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '4px'
          }}>
            <Badge size="sm" variant="dot" color={nodeData.temperature! > 1 ? 'warning' : 'default'}>
              T: {nodeData.temperature || 0.7}
            </Badge>
            {nodeData.max_tokens && (
              <span style={{ fontSize: '0.7rem', color: '#999' }}>
                {nodeData.max_tokens} tokens
              </span>
            )}
          </div>
        </div>
      </BaseNode>

      {/* Configuration Modal */}
      <Modal
        isOpen={showConfig}
        onClose={() => setShowConfig(false)}
        size="2xl"
        scrollBehavior="inside"
      >
        <Modal.Header>
          <h3>{config.icon} Configure {config.title} Node</h3>
        </Modal.Header>
        <Modal.Body>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Model Selection */}
            <Select
              label="Model"
              placeholder="Select a model"
              value={nodeData.model}
              onChange={(e) => setNodeData({ ...nodeData, model: e.target.value })}
            >
              {LLM_MODELS.map(model => (
                <Select.Option key={model.value} value={model.value}>
                  {model.label}
                </Select.Option>
              ))}
            </Select>

            {/* System Prompt */}
            <Textarea
              label="System Prompt"
              placeholder="Enter system prompt..."
              value={nodeData.system_prompt}
              onChange={(e) => setNodeData({ ...nodeData, system_prompt: e.target.value })}
              minRows={3}
              maxRows={10}
            />

            {/* Temperature */}
            <div>
              <label style={{ fontSize: '0.9rem', marginBottom: '0.5rem', display: 'block' }}>
                Temperature: {nodeData.temperature || 0.7}
              </label>
              <Slider
                size="sm"
                step={0.1}
                maxValue={2}
                minValue={0}
                value={nodeData.temperature || 0.7}
                onChange={(value) => setNodeData({ ...nodeData, temperature: value as number })}
                className="max-w-md"
              />
            </div>

            {/* Max Tokens */}
            <Input
              type="number"
              label="Max Tokens"
              placeholder="4096"
              value={String(nodeData.max_tokens || 4096)}
              onChange={(e) => setNodeData({ ...nodeData, max_tokens: parseInt(e.target.value) })}
            />

            {/* Variant-specific fields */}
            {variant === 'classifier' && (
              <Textarea
                label="Categories (one per line)"
                placeholder="technical&#10;business&#10;support"
                value={nodeData.categories?.join('\n')}
                onChange={(e) => setNodeData({ 
                  ...nodeData, 
                  categories: e.target.value.split('\n').filter(c => c.trim())
                })}
                minRows={3}
              />
            )}

            {variant === 'summarizer' && (
              <Select
                label="Summary Type"
                value={nodeData.summary_type}
                onChange={(e) => setNodeData({ ...nodeData, summary_type: e.target.value })}
              >
                <Select.Option value="brief">Brief</Select.Option>
                <Select.Option value="detailed">Detailed</Select.Option>
                <Select.Option value="bullet_points">Bullet Points</Select.Option>
                <Select.Option value="key_insights">Key Insights</Select.Option>
              </Select>
            )}

            {variant === 'codegen' && (
              <Select
                label="Language"
                value={nodeData.language}
                onChange={(e) => setNodeData({ ...nodeData, language: e.target.value })}
              >
                <Select.Option value="typescript">TypeScript</Select.Option>
                <Select.Option value="javascript">JavaScript</Select.Option>
                <Select.Option value="python">Python</Select.Option>
                <Select.Option value="rust">Rust</Select.Option>
                <Select.Option value="go">Go</Select.Option>
              </Select>
            )}

            {/* Tools Configuration */}
            <Textarea
              label="Tools (JSON)"
              placeholder="Optional tool definitions..."
              value={nodeData.tools ? JSON.stringify(nodeData.tools, null, 2) : ''}
              onChange={(e) => {
                try {
                  const tools = e.target.value ? JSON.parse(e.target.value) : undefined;
                  setNodeData({ ...nodeData, tools });
                } catch {
                  // Invalid JSON, ignore
                }
              }}
              minRows={3}
            />
          </div>
        </Modal.Body>
        <Modal.Footer>
          <button onClick={() => setShowConfig(false)}>Cancel</button>
          <button onClick={handleSave} color="primary">
            Save Configuration
          </button>
        </Modal.Footer>
      </Modal>
    </>
  );
});
