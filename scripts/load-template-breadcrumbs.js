import { RcrtClientEnhanced } from '@rcrt-builder/sdk';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function loadTemplateBreadcrumbs() {
  const config = {
    rcrtBaseUrl: process.env.RCRT_BASE_URL || 'http://localhost:8081',
    ownerId: process.env.OWNER_ID || '00000000-0000-0000-0000-000000000001',
    agentId: process.env.AGENT_ID || '00000000-0000-0000-0000-000000000AAA',
    workspace: process.env.WORKSPACE || 'workspace:templates',
  };

  console.log('🚀 Loading template breadcrumbs...');
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

    const client = new RcrtClientEnhanced(config.rcrtBaseUrl, 'jwt', jwtToken);

    // Find all template JSON files
    const templateDir = path.join(__dirname, 'template-breadcrumbs');
    const templateFiles = fs.readdirSync(templateDir)
      .filter(file => file.endsWith('.json'));

    console.log(`📁 Found ${templateFiles.length} template files`);

    // Load each template
    for (const file of templateFiles) {
      try {
        const filePath = path.join(templateDir, file);
        const templateData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        
        // Add workspace tag if not present
        if (!templateData.tags.includes(config.workspace)) {
          templateData.tags.push(config.workspace);
        }

        // Check if template already exists
        const existingTemplates = await client.searchBreadcrumbs({
          schema_name: templateData.schema_name,
          tags: [`template:${templateData.context.template_for || templateData.context.guide_type}`]
        });

        if (existingTemplates.length > 0) {
          console.log(`⚠️  Template '${templateData.title}' already exists, skipping...`);
          continue;
        }

        // Create the template breadcrumb
        const created = await client.createBreadcrumb(templateData);
        console.log(`✅ Created template: ${templateData.title} (${created.id})`);
        
        // If this template has llm_hints, demonstrate the transform
        if (templateData.llm_hints) {
          console.log(`   📊 LLM view would show:`, {
            transforms: Object.keys(templateData.llm_hints.transform || {}),
            mode: templateData.llm_hints.mode
          });
        }
        
      } catch (error) {
        console.error(`❌ Failed to load ${file}:`, error.message);
      }
    }

    console.log('\n📚 Template Library Summary:');
    console.log('   - LLM Hints Usage Guide');
    console.log('   - Tool Catalog Template');
    console.log('   - Agent Definition Template');
    console.log('   - Template Creation Guide (meta)');
    console.log('   - Transform Patterns Library');
    
    console.log('\n💡 Next steps:');
    console.log('   1. View templates in dashboard: http://localhost:8082');
    console.log('   2. Use templates to create new breadcrumbs');
    console.log('   3. Test llm_hints with context view endpoint');

  } catch (error) {
    console.error('❌ Failed to load template breadcrumbs:', error);
    process.exit(1);
  }
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  loadTemplateBreadcrumbs().catch(console.error);
}

export { loadTemplateBreadcrumbs };
