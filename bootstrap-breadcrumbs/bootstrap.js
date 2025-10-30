#!/usr/bin/env node
/**
 * RCRT Bootstrap Script  
 * Initializes the system with essential breadcrumbs on first run
 * 
 * SINGLE SOURCE OF TRUTH:
 * Agents: bootstrap-breadcrumbs/system/*.json
 * Tools: Dynamically discovered by tools-runner
 * Templates: bootstrap-breadcrumbs/templates/*.json
 */

import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BOOTSTRAP_VERSION = '2.0.0';

async function bootstrap() {
  const config = {
    rcrtBaseUrl: process.env.RCRT_BASE_URL || 'http://localhost:8081',
    ownerId: process.env.OWNER_ID || '00000000-0000-0000-0000-000000000001',
    agentId: process.env.AGENT_ID || '00000000-0000-0000-0000-000000000AAA',
  };

  console.log('🚀 RCRT Bootstrap System v' + BOOTSTRAP_VERSION);
  console.log('=====================================');
  console.log('Configuration:', config);

  try {
    // Get JWT token
    const tokenResp = await fetch(`${config.rcrtBaseUrl}/auth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        owner_id: config.ownerId,
        agent_id: config.agentId,
        roles: ['curator', 'emitter', 'subscriber']
      })
    });

    if (!tokenResp.ok) {
      throw new Error(`Token request failed: ${tokenResp.status}`);
    }

    const { token: jwtToken } = await tokenResp.json();
    console.log('🔐 Obtained JWT token\n');

    // Helper functions
    async function api(method, path, body = null) {
      const options = {
        method,
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
          'Content-Type': 'application/json'
        }
      };
      if (body) options.body = JSON.stringify(body);
      
      const resp = await fetch(`${config.rcrtBaseUrl}${path}`, options);
      return resp;
    }

    async function searchBreadcrumbs(params) {
      const query = new URLSearchParams();
      if (params.schema_name) query.set('schema_name', params.schema_name);
      if (params.tag) query.set('tag', params.tag);
      
      const resp = await api('GET', `/breadcrumbs?${query}`);
      return resp.ok ? resp.json() : [];
    }

    // 1. Check if already bootstrapped
    console.log('1️⃣ Checking bootstrap status...');
    const existingMarkers = await searchBreadcrumbs({
      schema_name: 'system.bootstrap.v1',
      tag: 'system:bootstrap'
    });

    if (existingMarkers.length > 0) {
      const markerResp = await api('GET', `/breadcrumbs/${existingMarkers[0].id}`);
      if (!markerResp.ok) {
        console.log('⚠️  Could not read bootstrap marker - continuing');
      } else {
        const marker = await markerResp.json();
        console.log(`✅ System already bootstrapped (v${marker.context?.version || 'unknown'})`);
        
        if (marker.context?.version === BOOTSTRAP_VERSION) {
          console.log('   Current version matches - nothing to do');
          return;
        } else {
          console.log(`   Upgrading from v${marker.context?.version || 'unknown'} to v${BOOTSTRAP_VERSION}`);
        }
      }
    }

    // 2. Load system breadcrumbs (agents, configs)
    console.log('\n2️⃣ Loading system breadcrumbs...');
    const systemDir = path.join(__dirname, 'system');
    const systemFiles = fs.readdirSync(systemDir)
      .filter(f => f.endsWith('.json') && f !== 'bootstrap-marker.json');

    for (const file of systemFiles) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(systemDir, file), 'utf-8'));
        
        const existing = await searchBreadcrumbs({
          schema_name: data.schema_name,
          tag: 'system:bootstrap'
        });
        
        const existingItem = existing.find(item => item.title === data.title);
        
        if (existingItem) {
          console.log(`   ⏭️  ${data.title} already exists (ID: ${existingItem.id})`);
          continue;
        }
        
        const resp = await api('POST', '/breadcrumbs', data);
        if (resp.ok) {
          const result = await resp.json();
          console.log(`   ✅ Created: ${data.title} (${result.id})`);
        } else {
          const errorText = await resp.text();
          console.error(`   ❌ Failed: ${data.title} - ${resp.status}: ${errorText}`);
        }
      } catch (error) {
        console.error(`   ❌ Error loading ${file}:`, error.message);
      }
    }

    // 3. Load self-contained tools (tool.code.v1)
    console.log('\n3️⃣ Loading self-contained tools...');
    const selfContainedToolsDir = path.join(__dirname, 'tools-self-contained');
    if (fs.existsSync(selfContainedToolsDir)) {
      const toolFiles = fs.readdirSync(selfContainedToolsDir).filter(f => f.endsWith('.json'));
      
      for (const file of toolFiles) {
        try {
          const data = JSON.parse(fs.readFileSync(path.join(selfContainedToolsDir, file), 'utf-8'));
          
          // Check if tool already exists
          const existing = await searchBreadcrumbs({
            schema_name: 'tool.code.v1',
            tag: `tool:${data.context.name}`
          });
          
          if (existing.length > 0) {
            console.log(`   ⏭️  ${data.title} already exists`);
            continue;
          }
          
          const resp = await api('POST', '/breadcrumbs', data);
          if (resp.ok) {
            const result = await resp.json();
            console.log(`   ✅ Created: ${data.title} (${result.id})`);
          } else {
            const errorText = await resp.text();
            console.error(`   ❌ Failed: ${data.title} - ${resp.status}: ${errorText}`);
          }
        } catch (error) {
          console.error(`   ❌ Error loading ${file}:`, error.message);
        }
      }
    } else {
      console.log('   ℹ️  No self-contained tools directory found (tools-self-contained/)');
    }

    // 4. Load template breadcrumbs
    console.log('\n4️⃣ Loading template library...');
    const templateDir = path.join(__dirname, 'templates');
    const templateFiles = fs.readdirSync(templateDir).filter(f => f.endsWith('.json'));

    for (const file of templateFiles) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(templateDir, file), 'utf-8'));
        
        if (!data.tags.includes('workspace:templates')) {
          data.tags.push('workspace:templates');
        }
        
        const resp = await api('POST', '/breadcrumbs', data);
        if (resp.ok) {
          console.log(`   ✅ Created: ${data.title}`);
        } else {
          const error = await resp.text();
          if (error.includes('duplicate')) {
            console.log(`   ⏭️  ${data.title} already exists`);
          } else {
            console.error(`   ❌ Failed: ${data.title}`);
          }
        }
      } catch (error) {
        console.error(`   ❌ Error loading ${file}:`, error.message);
      }
    }

    // 5. Create bootstrap marker
    console.log('\n5️⃣ Creating bootstrap marker...');
    const markerData = JSON.parse(
      fs.readFileSync(path.join(systemDir, 'bootstrap-marker.json'), 'utf-8')
    );
    markerData.context.timestamp = new Date().toISOString();
    
    const markerResp = await api('POST', '/breadcrumbs', markerData);
    if (markerResp.ok) {
      console.log('   ✅ Bootstrap complete!');
    }

    // 5. Summary
    console.log('\n📊 Bootstrap Summary:');
    console.log('   • System breadcrumbs (agents, configs)');
    console.log('   • Template library');
    console.log('   • Bootstrap marker');
    console.log(`   • Version: ${BOOTSTRAP_VERSION}`);
    console.log('');
    console.log('   ✨ Tools: Dynamically discovered by tools-runner (not pre-loaded)');
    
    console.log('\n🎯 Next Steps:');
    console.log('   1. Start tools-runner → discovers all tools automatically');
    console.log('   2. Start agent-runner → loads agents');
    console.log('   3. Visit http://localhost:8082 for dashboard');
    console.log('   4. Install browser extension for chat');
    console.log('');
    console.log('💡 Adding Components:');
    console.log('   • Agents: Create system/*.json → run: node bootstrap.js');
    console.log('   • Tools: Create src/my-tool/definition.json → restart tools-runner');
    console.log('   • Tools auto-register - no bootstrap needed!');

  } catch (error) {
    console.error('❌ Bootstrap failed:', error);
    process.exit(1);
  }
}

// Run bootstrap
bootstrap().catch(console.error);