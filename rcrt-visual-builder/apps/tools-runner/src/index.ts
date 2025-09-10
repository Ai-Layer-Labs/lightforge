#!/usr/bin/env node
/**
 * RCRT Tools Runner
 * Standalone service that registers and runs tools for the RCRT ecosystem
 * Works in Docker, local Node.js, or Electron environments
 */

import dotenv from 'dotenv';
import { createClient, RcrtClientEnhanced } from '@rcrt-builder/sdk';
import { createToolRegistry } from '@rcrt-builder/tools/registry';

// Load environment variables
dotenv.config();

// Configuration from environment
const config = {
  // RCRT connection
  rcrtBaseUrl: process.env.RCRT_BASE_URL || 'http://localhost:8081',
  rcrtProxyUrl: process.env.RCRT_PROXY_URL || '/api/rcrt',
  tokenEndpoint: process.env.TOKEN_ENDPOINT || '/api/auth/token',
  rcrtAuthMode: process.env.RCRT_AUTH_MODE || 'disabled', // 'jwt' | 'disabled'
  rcrtJwt: process.env.RCRT_JWT,
  workspace: process.env.WORKSPACE || 'workspace:tools',
  
  // Tool configuration
  enableBuiltins: process.env.ENABLE_BUILTIN_TOOLS !== 'false',
  enableLangChain: process.env.ENABLE_LANGCHAIN_TOOLS === 'true',
  enableUI: process.env.ENABLE_TOOL_UI === 'true',
  
  // Deployment mode
  deploymentMode: process.env.DEPLOYMENT_MODE || 'local', // 'docker', 'local', 'electron'
};

async function main() {
  console.log('🔧 RCRT Tools Runner starting...');
  console.log('Configuration:', {
    rcrtBaseUrl: config.rcrtBaseUrl,
    workspace: config.workspace,
    deploymentMode: config.deploymentMode,
    enableBuiltins: config.enableBuiltins,
    enableLangChain: config.enableLangChain,
    enableUI: config.enableUI,
    tokenEndpoint: config.tokenEndpoint
  });
  
  // In docker mode, wait a bit for services to be fully ready
  if (config.deploymentMode === 'docker') {
    console.log('Waiting for services to be ready...');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  try {
    // Create RCRT client (supports JWT in docker mode via RCRT_JWT or tokenEndpoint)
    let client: RcrtClientEnhanced;
    let applyClient: RcrtClientEnhanced | undefined;
    if (config.deploymentMode === 'docker') {
      if (config.rcrtAuthMode === 'jwt') {
        let token = config.rcrtJwt;
        if (!token && config.tokenEndpoint) {
          try {
            const tokenRequest = {
              owner_id: process.env.OWNER_ID || '00000000-0000-0000-0000-000000000001',
              agent_id: process.env.AGENT_ID || '00000000-0000-0000-0000-0000000000aa'
            };
            const resp = await fetch(config.tokenEndpoint, { 
              method: 'POST', 
              headers: { 'content-type': 'application/json' }, 
              body: JSON.stringify(tokenRequest)
            });
            if (resp.ok) {
              const json = await resp.json().catch(() => ({}));
              token = json?.token;
              if (token) {
                console.log('✅ Fetched JWT token from', config.tokenEndpoint);
              } else {
                console.warn('❌ Token endpoint returned no token:', json);
              }
            } else {
              console.warn('❌ Token endpoint failed:', resp.status, await resp.text().catch(() => 'unknown error'));
            }
          } catch (err) {
            console.warn('❌ Failed to fetch token:', err);
          }
        }
        if (!token) {
          console.warn('RCRT_AUTH_MODE=jwt but no RCRT_JWT or tokenEndpoint provided; continuing without auth');
          client = new RcrtClientEnhanced(config.rcrtBaseUrl, 'disabled');
        } else {
        client = new RcrtClientEnhanced(config.rcrtBaseUrl, 'jwt', token, {
          tokenEndpoint: config.tokenEndpoint,
          autoRefresh: true
        });
        // applyClient should target the builder proxy so /api/forge/apply works
        // In docker mode, use the builder proxy for UI operations
        const builderUrl = process.env.BUILDER_URL || 'http://builder:3000';
        applyClient = await createClient({ 
          baseUrl: builderUrl + '/api/rcrt', 
          tokenEndpoint: config.tokenEndpoint, // Use RCRT token service
          authMode: 'jwt',
          autoRefresh: true
        });
        }
      } else {
        client = new RcrtClientEnhanced(config.rcrtBaseUrl, 'disabled');
      }
    } else {
      client = await createClient({ baseUrl: config.rcrtProxyUrl, tokenEndpoint: config.tokenEndpoint, authMode: 'jwt' });
      applyClient = client;
    }

    console.log('✅ Connected to RCRT');

    // Resolve API keys strictly from RCRT Secrets (no env fallback)
    // Secret names are case-insensitive keys like: SERPAPI_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY
    async function resolveSecrets(preferredNames: string[]): Promise<Record<string, string | undefined>> {
      const out: Record<string, string | undefined> = {};
      try {
        // List all secrets visible to this agent; filter by name
        const secrets = await client.listSecrets();
        for (const name of preferredNames) {
          const secret = secrets.find((s: any) => String(s?.name || '').toLowerCase() === name.toLowerCase());
          if (secret) {
            try {
              const val = await client.getSecret(secret.id);
              out[name] = val?.value;
            } catch {}
          }
        }
      } catch {}
      return out;
    }

    const desiredKeys = [
      'SERPAPI_API_KEY',
      'OPENAI_API_KEY',
      'ANTHROPIC_API_KEY',
      'BRAVE_SEARCH_API_KEY',
      'GOOGLE_SEARCH_API_KEY',
      'GOOGLE_CSE_ID',
    ];

    const rcrtSecrets = await resolveSecrets(desiredKeys);
    const serpApiKey = rcrtSecrets.SERPAPI_API_KEY;
    const openaiApiKey = rcrtSecrets.OPENAI_API_KEY;

    // Create and configure tool registry
    const registry = await createToolRegistry(client, config.workspace, {
      enableUI: config.enableUI,
      enableBuiltins: config.enableBuiltins,
      enableLangChain: config.enableLangChain,
      langchainConfig: {
        serpApiKey,
        openaiApiKey
      },
      applyClient
    });

    console.log('✅ Tool registry initialized');
    console.log('🎯 Registered tools:', registry.listTools());

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down tools runner...');
      await registry.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n🛑 Shutting down tools runner...');
      await registry.stop();
      process.exit(0);
    });

    // Keep alive
    console.log('🚀 Tools runner is ready and listening for requests');
    console.log(`📡 Workspace: ${config.workspace}`);
    console.log('💡 Send tool.request.v1 breadcrumbs to trigger tool execution');
    
    // Prevent process exit
    await new Promise(() => {});
    
  } catch (error) {
    console.error('❌ Failed to start tools runner:', error);
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

if (require.main === module) {
  main().catch(console.error);
}
