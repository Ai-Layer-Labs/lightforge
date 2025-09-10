import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  console.log('[forge/test] Test endpoint reached');
  const body = await req.json().catch(() => ({}));
  console.log('[forge/test] Body:', body);
  
  return new Response(JSON.stringify({ 
    ok: true, 
    message: 'Test endpoint working',
    auth: !!req.headers.get('authorization')
  }), { 
    status: 200, 
    headers: { 'content-type': 'application/json' } 
  });
}
