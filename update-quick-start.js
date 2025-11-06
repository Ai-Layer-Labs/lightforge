import fetch from 'node-fetch';
import fs from 'fs';

async function updateQuickStart() {
  const data = JSON.parse(fs.readFileSync('bootstrap-breadcrumbs/pages/quick-start-wizard.json', 'utf-8'));
  
  // Get token
  const tokenResp = await fetch('http://localhost:8081/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      owner_id: '00000000-0000-0000-0000-000000000001',
      agent_id: '00000000-0000-0000-0000-000000000AAA',
      roles: ['curator']
    })
  });
  const { token } = await tokenResp.json();
  
  // Find existing
  const searchResp = await fetch('http://localhost:8081/breadcrumbs?schema_name=ui.page.v1&tag=page:quick-start', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const pages = await searchResp.json();
  
  if (pages.length === 0) {
    console.log('❌ Page not found');
    return;
  }
  
  const pageId = pages[0].id;
  
  // Get full for version
  const fullResp = await fetch(`http://localhost:8081/breadcrumbs/${pageId}/full`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const full = await fullResp.json();
  
  // Update
  const updateResp = await fetch(`http://localhost:8081/breadcrumbs/${pageId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'If-Match': String(full.version)
    },
    body: JSON.stringify({ context: data.context })
  });
  
  if (updateResp.ok) {
    console.log('✅ Quick Start wizard updated!');
    console.log('   - Added model, temperature, maxTokens fields to Step 2');
    console.log('   - Creates config breadcrumb with your settings');
    console.log('   - Fixed API endpoints (/api/secrets, /api/breadcrumbs)');
    console.log('');
    console.log('🔄 Refresh http://localhost:8082/quick-start to see changes');
  } else {
    const error = await updateResp.text();
    console.log('❌ Failed:', error);
  }
}

updateQuickStart().catch(console.error);

