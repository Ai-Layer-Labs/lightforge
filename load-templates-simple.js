// Simple template loader that can run from the main breadcrums directory
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function loadTemplateBreadcrumbs() {
  const config = {
    rcrtBaseUrl: process.env.RCRT_BASE_URL || 'http://localhost:8081',
    ownerId: process.env.OWNER_ID || '00000000-0000-0000-0000-000000000001',
    agentId: process.env.AGENT_ID || '00000000-0000-0000-0000-000000000AAA',
    workspace: process.env.WORKSPACE || 'workspace:templates',
  };

  console.log('🚀 Loading template breadcrumbs (simple version)...');
  console.log('Configuration:', config);

  try {
    // Obtain JWT token
    const tokenRequest = {
      owner_id: config.ownerId,
      agent_id: config.agentId,
      roles: ['curator', 'emitter', 'subscriber']
    };

    const resp = await fetch(`${config.rcrtBaseUrl}/auth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(tokenRequest)
    });

    if (!resp.ok) {
      throw new Error(`Token request failed: ${resp.status}`);
    }

    const json = await resp.json();
    const jwtToken = json?.token;

    if (!jwtToken) {
      throw new Error('No token in response');
    }

    console.log('🔐 Obtained JWT token');

    // Find all template JSON files
    const templateDir = path.join(__dirname, 'template-breadcrumbs');
    const templateFiles = fs.readdirSync(templateDir)
      .filter(file => file.endsWith('.json'));

    console.log(`📁 Found ${templateFiles.length} template files`);

    // Helper to create breadcrumb
    async function createBreadcrumb(data) {
      const resp = await fetch(`${config.rcrtBaseUrl}/breadcrumbs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (!resp.ok) {
        const error = await resp.text();
        throw new Error(`Failed to create breadcrumb: ${resp.status} - ${error}`);
      }

      return resp.json();
    }

    // Load each template
    for (const file of templateFiles) {
      try {
        const filePath = path.join(templateDir, file);
        const templateData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        
        // Add workspace tag if not present
        if (!templateData.tags.includes(config.workspace)) {
          templateData.tags.push(config.workspace);
        }

        // Create the template breadcrumb
        const created = await createBreadcrumb(templateData);
        console.log(`✅ Created template: ${templateData.title} (${created.id})`);
        
        // If this template has llm_hints, show what they do
        if (templateData.llm_hints) {
          console.log(`   📊 LLM transforms:`, Object.keys(templateData.llm_hints.transform || {}));
        }
        
      } catch (error) {
        console.error(`❌ Failed to load ${file}:`, error.message);
      }
    }

    console.log('\n📚 Template Library Loaded!');
    console.log('\n💡 Next steps:');
    console.log('   1. View templates in dashboard: http://localhost:8082');
    console.log('   2. Run: node demonstrate-template-usage.js');
    console.log('   3. Agents will discover templates automatically');

  } catch (error) {
    console.error('❌ Failed to load template breadcrumbs:', error);
    process.exit(1);
  }
}

// Check if node-fetch is installed
import('node-fetch').catch(() => {
  console.error('Please install node-fetch: npm install node-fetch');
  process.exit(1);
}).then(() => {
  loadTemplateBreadcrumbs().catch(console.error);
});
