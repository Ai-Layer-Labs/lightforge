/**
 * Context Builder Configuration Panel
 * Custom UI for editing context.config.v1 (like tool.config.v1 for openrouter)
 */

import React, { useState, useEffect } from 'react';

interface ContextConfigProps {
  breadcrumbId: string;
  onSave?: () => void;
}

export function ContextBuilderConfig({ breadcrumbId, onSave }: ContextConfigProps) {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Load config
  useEffect(() => {
    loadConfig();
  }, [breadcrumbId]);
  
  async function loadConfig() {
    try {
      const response = await fetch(`/api/rcrt/breadcrumbs/${breadcrumbId}`);
      const data = await response.json();
      setConfig(data.context);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load context config:', error);
      setLoading(false);
    }
  }
  
  async function saveConfig() {
    try {
      const response = await fetch(`/api/rcrt/breadcrumbs/${breadcrumbId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: config })
      });
      
      if (response.ok) {
        onSave?.();
      }
    } catch (error) {
      console.error('Failed to save context config:', error);
    }
  }
  
  if (loading) return <div>Loading configuration...</div>;
  if (!config) return <div>Config not found</div>;
  
  return (
    <div className="context-builder-config">
      <h3>🏗️ Context Builder Configuration</h3>
      <p className="subtitle">For: {config.consumer_id}</p>
      
      {/* Strategy Selection */}
      <div className="config-section">
        <h4>Strategy</h4>
        <label>
          <input type="radio" name="strategy" defaultChecked />
          Hybrid (Recent + Semantic)
        </label>
        <label>
          <input type="radio" name="strategy" />
          Recent Only
        </label>
        <label>
          <input type="radio" name="strategy" />
          Semantic Only
        </label>
      </div>
      
      {/* Message Limits */}
      <div className="config-section">
        <h4>Message Limits</h4>
        
        <label>
          Recent User Messages: 
          <input 
            type="range" 
            min="0" 
            max="20" 
            defaultValue="3"
            onChange={(e) => {
              // Update config.sources[0].limit
            }}
          />
          <span>3</span>
        </label>
        
        <label>
          Semantic User Messages (vector):
          <input 
            type="range" 
            min="0" 
            max="20" 
            defaultValue="5"
          />
          <span>5</span>
        </label>
        
        <label>
          Recent Agent Responses:
          <input 
            type="range" 
            min="0" 
            max="10" 
            defaultValue="2"
          />
          <span>2</span>
        </label>
        
        <label>
          Semantic Agent Responses:
          <input 
            type="range" 
            min="0" 
            max="10" 
            defaultValue="3"
          />
          <span>3</span>
        </label>
      </div>
      
      {/* Optimization */}
      <div className="config-section">
        <h4>Optimization</h4>
        
        <label>
          Token Budget:
          <input 
            type="number" 
            min="1000" 
            max="16000" 
            value={config.formatting?.max_tokens || 4000}
            onChange={(e) => {
              setConfig({
                ...config,
                formatting: {
                  ...config.formatting,
                  max_tokens: parseInt(e.target.value)
                }
              });
            }}
          />
        </label>
        
        <label>
          Deduplication Threshold:
          <input 
            type="range" 
            min="0.80" 
            max="0.99" 
            step="0.01"
            value={config.formatting?.deduplication_threshold || 0.95}
            onChange={(e) => {
              setConfig({
                ...config,
                formatting: {
                  ...config.formatting,
                  deduplication_threshold: parseFloat(e.target.value)
                }
              });
            }}
          />
          <span>{config.formatting?.deduplication_threshold || 0.95}</span>
        </label>
        
        <label>
          Context TTL (seconds):
          <input 
            type="number" 
            value={config.output?.ttl_seconds || 3600}
          />
        </label>
      </div>
      
      {/* Advanced */}
      <details className="config-section">
        <summary>Advanced Options</summary>
        
        <label>
          <input 
            type="checkbox" 
            checked={config.formatting?.include_metadata}
          />
          Include timestamps and metadata
        </label>
        
        <label>
          <input 
            type="checkbox" 
            checked={config.formatting?.enable_summarization}
            disabled
          />
          Enable LLM summarization (experimental)
        </label>
      </details>
      
      {/* Presets */}
      <div className="config-section">
        <h4>Presets</h4>
        <button onClick={() => loadPreset('conversational')}>Conversational</button>
        <button onClick={() => loadPreset('memory')}>Memory-Focused</button>
        <button onClick={() => loadPreset('minimal')}>Minimal</button>
        <button onClick={() => loadPreset('rag')}>Document RAG</button>
      </div>
      
      {/* Actions */}
      <div className="config-actions">
        <button onClick={saveConfig} className="primary">Save Configuration</button>
        <button onClick={loadConfig}>Reset</button>
        <button onClick={() => testConfig()}>Test Configuration</button>
      </div>
      
      {/* Stats */}
      <div className="config-stats">
        <h4>Current Stats</h4>
        <p>Last updated: {config.metadata?.last_updated}</p>
        <p>Version: {config.metadata?.version}</p>
        <p>Token estimate: ~{config.token_estimate || 'unknown'}</p>
      </div>
    </div>
  );
  
  function loadPreset(name: string) {
    // Load preset configurations
    const presets = {
      conversational: { /* ... */ },
      memory: { /* ... */ },
      minimal: { /* ... */ },
      rag: { /* ... */ }
    };
    
    setConfig({ ...config, ...presets[name as keyof typeof presets] });
  }
  
  async function testConfig() {
    // Create a test message to see what context would be assembled
    alert('Test: Send a message to see the assembled context');
  }
}
