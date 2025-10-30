const OWNER_ID = '00000000-0000-0000-0000-000000000001';
const AGENT_ID = '00000000-0000-0000-0000-000000000AAA';
const TOOL_ID = process.argv[2];
if (!TOOL_ID) {
  console.error('Usage: node tmp-fetch-single-tool.js <tool-id>');
  process.exit(1);
}
async function main(){
  const tokenResp = await fetch('http://localhost:8081/auth/token', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ owner_id: OWNER_ID, agent_id: AGENT_ID })
  });
  const { token } = await tokenResp.json();
  const resp = await fetch(`http://localhost:8081/breadcrumbs/${TOOL_ID}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const json = await resp.json();
  console.log(JSON.stringify(json, null, 2));
}
main().catch(err => { console.error(err); process.exit(1); });
