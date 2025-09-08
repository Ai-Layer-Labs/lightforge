/**
 * RCRT Proxy API
 * Proxies requests from the builder to the RCRT backend to avoid CORS issues.
 */
import { NextRequest } from 'next/server';

const backendBase = process.env.RCRT_URL || process.env.NEXT_PUBLIC_RCRT_URL || 'http://localhost:8081';

function buildTargetUrl(req: NextRequest) {
  const path = req.nextUrl.pathname.replace(/^\/api\/rcrt\//, '');
  const search = req.nextUrl.search || '';
  return `${backendBase}/${path}${search}`;
}

async function proxy(req: NextRequest) {
  const targetUrl = buildTargetUrl(req);
  const headers = new Headers(req.headers);
  headers.delete('host');
  headers.delete('origin');
  headers.delete('content-length');
  headers.set('accept', headers.get('accept') || '*/*');
  // Ensure Authorization header is forwarded when present
  const auth = req.headers.get('authorization');
  if (auth) {
    headers.set('authorization', auth);
  } else {
    // If access_token/token is provided in query (SSE in browsers), map it to Authorization
    const qp = req.nextUrl.searchParams;
    const token = qp.get('access_token') || qp.get('token');
    if (token) {
      headers.set('authorization', `Bearer ${token}`);
    }
  }

  const init: RequestInit = {
    method: req.method,
    headers,
    redirect: 'manual'
  };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const bodyText = await req.text();
    init.body = bodyText;
    if (!headers.get('content-type')) {
      headers.set('content-type', 'application/json');
    }
  }

  const resp = await fetch(targetUrl, init as any);

  // Stream body directly (SSE compatible)
  const respHeaders = new Headers(resp.headers);
  respHeaders.set('Access-Control-Allow-Origin', '*');
  return new Response(resp.body, {
    status: resp.status,
    statusText: resp.statusText,
    headers: respHeaders
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const HEAD = proxy;
export const OPTIONS = async (req: NextRequest) => {
  // Basic CORS preflight passthrough
  const resp = await proxy(req);
  const headers = new Headers(resp.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD');
  headers.set('Access-Control-Allow-Headers', req.headers.get('access-control-request-headers') || '*');
  return new Response(null, { status: 204, headers });
};


