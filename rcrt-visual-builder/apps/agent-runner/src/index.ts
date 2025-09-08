#!/usr/bin/env node
/**
 * RCRT Agent Runner Service
 * Production service for running agents and flows
 */

import 'dotenv/config';
import express from 'express';
import { RuntimeManager } from '@rcrt-builder/runtime';
import { RcrtClientEnhanced } from '@rcrt-builder/sdk';

// Configuration
const PORT = process.env.PORT || 3001;
const RCRT_URL = process.env.RCRT_URL || 'http://localhost:8081';
const WORKSPACE = process.env.WORKSPACE || 'workspace:builder';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const AUTH_MODE = (process.env.AUTH_MODE || 'disabled') as 'disabled' | 'jwt' | 'key';
const AUTH_TOKEN = process.env.AUTH_TOKEN;

// Validate configuration
if (!OPENROUTER_API_KEY) {
  console.warn('⚠️  OPENROUTER_API_KEY not set - LLM functionality will be limited');
}

// Create Express app for health checks and management
const app = express();
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  const stats = runtimeManager ? runtimeManager.getStats() : { running: false };
  res.json({
    status: stats.running ? 'healthy' : 'unhealthy',
    ...stats,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

// Status endpoint
app.get('/status', (req, res) => {
  if (!runtimeManager) {
    return res.status(503).json({ error: 'Runtime not initialized' });
  }
  
  const stats = runtimeManager.getStats();
  res.json({
    ...stats,
    rcrt_url: RCRT_URL,
    auth_mode: AUTH_MODE,
  });
});

// Reload endpoint (reload agents and flows)
app.post('/reload', async (req, res) => {
  if (!runtimeManager) {
    return res.status(503).json({ error: 'Runtime not initialized' });
  }
  
  try {
    console.log('🔄 Reloading runtime...');
    await runtimeManager.stop();
    await runtimeManager.start();
    res.json({ status: 'reloaded', ...runtimeManager.getStats() });
  } catch (error) {
    console.error('Failed to reload:', error);
    res.status(500).json({ error: String(error) });
  }
});

// Trigger flow endpoint
app.post('/flows/:flowId/trigger', async (req, res) => {
  if (!runtimeManager) {
    return res.status(503).json({ error: 'Runtime not initialized' });
  }
  
  try {
    const { flowId } = req.params;
    const trigger = req.body;
    
    await runtimeManager.executeFlow(flowId, trigger);
    res.json({ status: 'triggered', flow_id: flowId });
  } catch (error) {
    console.error('Failed to trigger flow:', error);
    res.status(500).json({ error: String(error) });
  }
});

// List agents endpoint
app.get('/agents', async (req, res) => {
  if (!rcrtClient) {
    return res.status(503).json({ error: 'RCRT client not initialized' });
  }
  
  try {
    const agents = await rcrtClient.listAgents();
    res.json(agents);
  } catch (error) {
    console.error('Failed to list agents:', error);
    res.status(500).json({ error: String(error) });
  }
});

// List flows endpoint
app.get('/flows', async (req, res) => {
  if (!rcrtClient) {
    return res.status(503).json({ error: 'RCRT client not initialized' });
  }
  
  try {
    const flows = await rcrtClient.getFlowDefinitions(WORKSPACE);
    res.json(flows.map(f => ({
      id: f.context.flow_id,
      title: f.title,
      nodes: f.context.nodes.length,
      connections: f.context.connections.length,
    })));
  } catch (error) {
    console.error('Failed to list flows:', error);
    res.status(500).json({ error: String(error) });
  }
});

// Initialize runtime
let runtimeManager: RuntimeManager;
let rcrtClient: RcrtClientEnhanced;

async function initialize() {
  console.log('🚀 RCRT Agent Runner Service');
  console.log('============================');
  console.log(`📍 Port: ${PORT}`);
  console.log(`🔗 RCRT URL: ${RCRT_URL}`);
  console.log(`📁 Workspace: ${WORKSPACE}`);
  console.log(`🔐 Auth Mode: ${AUTH_MODE}`);
  console.log();
  
  try {
    // Initialize RCRT client
    console.log('📡 Connecting to RCRT...');
    rcrtClient = new RcrtClientEnhanced(RCRT_URL, AUTH_MODE, AUTH_TOKEN);
    
    // Test connection
    const workspaces = await rcrtClient.searchBreadcrumbs({
      schema_name: 'workspace.def.v1',
      tag: WORKSPACE,
    });
    
    if (workspaces.length === 0) {
      console.warn(`⚠️  Workspace ${WORKSPACE} not found`);
      console.log('   Run bootstrap script to initialize: pnpm bootstrap');
    } else {
      console.log(`✅ Connected to RCRT - Workspace: ${workspaces[0].title}`);
    }
    
    // Initialize runtime manager
    console.log('🎯 Initializing runtime manager...');
    runtimeManager = new RuntimeManager({
      rcrtUrl: RCRT_URL,
      workspace: WORKSPACE,
      authMode: AUTH_MODE,
      authToken: AUTH_TOKEN,
      openRouterApiKey: OPENROUTER_API_KEY,
      autoStart: false,
    });
    
    // Start runtime
    await runtimeManager.start();
    
    // Start Express server
    app.listen(PORT, () => {
      console.log();
      console.log('✅ Agent Runner Service Started');
      console.log(`   Health: http://localhost:${PORT}/health`);
      console.log(`   Status: http://localhost:${PORT}/status`);
      console.log(`   Agents: http://localhost:${PORT}/agents`);
      console.log(`   Flows:  http://localhost:${PORT}/flows`);
      console.log();
      console.log('Press Ctrl+C to stop');
    });
    
  } catch (error) {
    console.error('❌ Failed to initialize:', error);
    process.exit(1);
  }
}

// Handle shutdown gracefully
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...');
  
  if (runtimeManager) {
    await runtimeManager.stop();
  }
  
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down...');
  
  if (runtimeManager) {
    await runtimeManager.stop();
  }
  
  process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the service
initialize().catch(console.error);
