#!/usr/bin/env node
/**
 * Create OpenRouter Models Catalog
 * Fetches current models from OpenRouter API and stores as breadcrumb
 */

const fetch = require('node-fetch');

const CONFIG = {
  rcrtBaseUrl: process.env.RCRT_BASE_URL || 'http://localhost:8081',
  workspace: process.env.WORKSPACE || 'workspace:tools'
};

async function createModelsCatalog() {
  try {
    console.log('📡 Fetching current models from OpenRouter API...');
    
    // Fetch current models from OpenRouter API
    const response = await fetch('https://openrouter.ai/api/v1/models');
    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`);
    }
    
    const modelsData = await response.json();
    
    // Filter to useful models (skip very expensive or experimental ones)
    const usefulModels = modelsData.data.filter((model) => {
      const promptCost = parseFloat(model.pricing?.prompt || '0');
      const completionCost = parseFloat(model.pricing?.completion || '0');
      
      // Skip if too expensive (over $50 per 1M tokens) or free models without pricing
      return promptCost > 0 && (promptCost + completionCost) < 0.05;
    });
    
    console.log(`✅ Found ${usefulModels.length}/${modelsData.data.length} affordable models`);
    
    // Get JWT token
    const tokenRequest = {
      owner_id: process.env.OWNER_ID || '00000000-0000-0000-0000-000000000001',
      agent_id: process.env.AGENT_ID || '00000000-0000-0000-0000-000000000BBB',
      roles: ['curator', 'emitter', 'subscriber']
    };
    
    const tokenResp = await fetch(`${CONFIG.rcrtBaseUrl}/auth/token`, { 
      method: 'POST', 
      headers: { 'content-type': 'application/json' }, 
      body: JSON.stringify(tokenRequest)
    });
    
    if (!tokenResp.ok) {
      throw new Error(`Token request failed: ${tokenResp.status}`);
    }
    
    const { token } = await tokenResp.json();
    
    // Create catalog breadcrumb
    const catalogBreadcrumb = {
      schema_name: 'openrouter.models.catalog.v1',
      title: 'OpenRouter Available Models',
      tags: [CONFIG.workspace, 'openrouter:models', 'models:catalog'],
      context: {
        models: usefulModels.map((model) => ({
          id: model.id,                                    // "google/gemini-2.5-flash"
          name: model.name,                                // "Claude 3.5 Sonnet" 
          description: model.description,
          pricing: {
            prompt: model.pricing.prompt,                  // Per token cost
            completion: model.pricing.completion,          // Per token cost
            currency: 'USD'
          },
          context_length: model.context_length,            // Max context size
          capabilities: {
            input_modalities: model.architecture?.input_modalities || ['text'],
            output_modalities: model.architecture?.output_modalities || ['text'],
            supports_tools: model.supported_parameters?.includes('tools') || false,
            supports_vision: model.architecture?.input_modalities?.includes('image') || false
          },
          provider: model.id.split('/')[0],                // "anthropic", "openai", etc.
          performance: {
            max_completion_tokens: model.top_provider?.max_completion_tokens || 4096,
            is_moderated: model.top_provider?.is_moderated || false
          },
          updated_at: new Date().toISOString()
        })),
        total_models: usefulModels.length,
        total_available: modelsData.data.length,
        last_updated: new Date().toISOString(),
        source: 'https://openrouter.ai/api/v1/models',
        update_interval: '24 hours',
        filtering: 'Excluded models with cost > $50/1M tokens or no pricing'
      }
    };
    
    const createResp = await fetch(`${CONFIG.rcrtBaseUrl}/breadcrumbs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `openrouter-models-catalog-${Date.now()}`
      },
      body: JSON.stringify(catalogBreadcrumb)
    });
    
    if (!createResp.ok) {
      const error = await createResp.text();
      throw new Error(`Failed to create catalog: ${error}`);
    }
    
    const result = await createResp.json();
    console.log(`✅ Created models catalog breadcrumb: ${result.id}`);
    
    // Log some popular models
    console.log('\n📋 Popular models available:');
    const popularModels = usefulModels
      .filter(m => 
        m.id.includes('gemini') || 
        m.id.includes('claude') || 
        m.id.includes('gpt-4') ||
        m.id.includes('mistral')
      )
      .slice(0, 10);
    
    popularModels.forEach(model => {
      const promptCost = parseFloat(model.pricing.prompt) * 1000000;
      const completionCost = parseFloat(model.pricing.completion) * 1000000;
      console.log(`  - ${model.id}: $${promptCost.toFixed(2)}/$${completionCost.toFixed(2)} per 1M tokens`);
    });
    
  } catch (error) {
    console.error('❌ Failed to create models catalog:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  createModelsCatalog().then(() => {
    console.log('\n✅ OpenRouter models catalog created successfully!');
    process.exit(0);
  });
}

module.exports = { createModelsCatalog };
