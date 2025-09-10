import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

// Proxy token requests to the RCRT server's centralized token service
export async function POST(req: NextRequest) {
  console.log('[auth/token] Token request received');
  const body = await req.json().catch(() => ({}));
  
  // Use defaults from environment for the builder context - no fallbacks in RCRT
  const tokenRequest = {
    owner_id: body?.owner_id || process.env.OWNER_ID || '00000000-0000-0000-0000-000000000001',
    agent_id: body?.agent_id || process.env.AGENT_ID || '00000000-0000-0000-0000-0000000000aa',
    roles: body?.roles || ['curator', 'emitter', 'subscriber'],
    ttl_sec: body?.ttl_sec || 3600
  };

  const rcrtUrl = process.env.RCRT_URL || process.env.NEXT_PUBLIC_RCRT_URL || 'http://localhost:8081';
  console.log(`[auth/token] Proxying to RCRT: ${rcrtUrl}/auth/token`);
  console.log(`[auth/token] Request:`, tokenRequest);
  
  try {
    console.log('[auth/token] Making request to RCRT...');
    const response = await fetch(`${rcrtUrl}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tokenRequest)
    });

    console.log(`[auth/token] RCRT responded: ${response.status}`);
    if (!response.ok) {
      const error = await response.text();
      console.log(`[auth/token] RCRT error: ${error}`);
      return new Response(JSON.stringify({ error: `RCRT token service failed: ${error}` }), { 
        status: response.status, 
        headers: { 'content-type': 'application/json' } 
      });
    }

    const tokenData = await response.json();
    console.log('[auth/token] Token generated successfully');
    return new Response(JSON.stringify(tokenData), { 
      status: 200, 
      headers: { 'content-type': 'application/json' } 
    });
  } catch (err) {
    console.log(`[auth/token] Exception: ${err}`);
    return new Response(JSON.stringify({ error: `Failed to connect to RCRT token service: ${err}` }), { 
      status: 502, 
      headers: { 'content-type': 'application/json' } 
    });
  }
}