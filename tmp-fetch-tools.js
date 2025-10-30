const OWNER_ID = '00000000-0000-0000-0000-000000000001';
const AGENT_ID = '00000000-0000-0000-0000-000000000AAA';
async function main(){
  const tokenResp = await fetch('http://localhost:8081/auth/token', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ owner_id: OWNER_ID, agent_id: AGENT_ID })
  });
  const { token } = await tokenResp.json();
  const resp = await fetch('http://localhost:8081/breadcrumbs?schema_name=tool.code.v1', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const json = await resp.json();
  console.log(JSON.stringify(json, null, 2));
}
main().catch(err => { console.error(err); process.exit(1); });
