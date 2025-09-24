#!/usr/bin/env node
// Quick script to restart agent-runner if it's not picking up agents

console.log('🔄 Restarting agent-runner...');
require('child_process').execSync('docker compose restart agent-runner', { stdio: 'inherit' });
console.log('✅ Agent-runner restarted. Check logs: docker compose logs -f agent-runner');
