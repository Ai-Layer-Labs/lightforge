#!/usr/bin/env node
/**
 * Reset onboarding state for testing
 * This script can be used to force the onboarding flow to show again
 */

console.log('🔄 Resetting onboarding state...');
console.log('');
console.log('To reset onboarding, open http://localhost:8082 in your browser and run this in the console:');
console.log('');
console.log("localStorage.removeItem('rcrt-onboarding-complete');");
console.log('');
console.log('Then refresh the page and the onboarding should start if:');
console.log('1. No OPENROUTER_API_KEY secret exists');
console.log('2. The openrouter tool is available');
console.log('');
console.log('✨ To manually trigger onboarding (for testing), run this in the console:');
console.log('');
console.log(`localStorage.removeItem('rcrt-onboarding-complete');
window.dispatchEvent(new Event('rcrt-start-onboarding'));`);
console.log('');
console.log('📝 Note: The onboarding will guide you through:');
console.log('   1. Creating a secret named OPENROUTER_API_KEY');
console.log('   2. Configuring the openrouter tool to use this secret');
