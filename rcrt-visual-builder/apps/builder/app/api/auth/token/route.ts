import { NextRequest } from 'next/server';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function base64url(input: Buffer | string) {
  return (typeof input === 'string' ? Buffer.from(input) : input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as any));
  const ownerId: string = body?.owner_id || process.env.OWNER_ID || '';
  const agentId: string = body?.agent_id || process.env.AGENT_ID || '';
  const roles: string[] = Array.isArray(body?.roles) ? body.roles : ['curator','emitter','subscriber'];
  const ttlSec = Number(body?.ttl_sec || 3600);
  const now = Math.floor(Date.now() / 1000);
  const exp = now + ttlSec;

  const pem = process.env.JWT_PRIVATE_KEY_PEM;
  if (!pem) {
    return new Response(JSON.stringify({ error: 'JWT_PRIVATE_KEY_PEM missing' }), { status: 500, headers: { 'content-type': 'application/json' } });
  }

  const header = { alg: 'RS256', typ: 'JWT' };
  const payload: any = { sub: agentId, owner_id: ownerId, roles, iat: now, exp };
  if (process.env.JWT_ISSUER) payload.iss = process.env.JWT_ISSUER;
  if (process.env.JWT_AUDIENCE) payload.aud = process.env.JWT_AUDIENCE;

  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signingInput);
  const signature = sign.sign(pem);
  const jwt = `${signingInput}.${base64url(signature)}`;

  return new Response(JSON.stringify({ token: jwt, owner_id: ownerId, agent_id: agentId, roles, exp }), { status: 200, headers: { 'content-type': 'application/json' } });
}


