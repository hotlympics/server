#!/usr/bin/env node

// Quick production smoke test for leaderboard endpoints
// Usage: node tests/test-production.js [custom-url]
// Defaults to: https://hotlympics-server-670297845147.us-central1.run.app

const PROD_URL = process.argv[2] || 'https://hotlympics-server-670297845147.us-central1.run.app';

console.log(`🌐 Production Smoke Test`);
console.log(`Server: ${PROD_URL}`);
console.log('==================\n');

async function smokeTest() {
    try {
        // Test 1: Health check
        console.log('💚 Testing health endpoint...');
        const healthResponse = await fetch(`${PROD_URL}/health`);
        console.log(`   Status: ${healthResponse.status} ${healthResponse.ok ? '✅' : '❌'}`);
        
        // Test 2: Leaderboards list
        console.log('📋 Testing leaderboards list...');
        const listResponse = await fetch(`${PROD_URL}/leaderboards`);
        console.log(`   Status: ${listResponse.status} ${listResponse.ok ? '✅' : '❌'}`);
        
        if (listResponse.ok) {
            const data = await listResponse.json();
            console.log(`   Leaderboards: ${data.leaderboards?.length || 0}`);
            console.log(`   Last generated: ${data.metadata?.lastGeneratedAt || 'Never'}`);
        }
        
        console.log('\n🎉 Production smoke test completed!');
        
    } catch (error) {
        console.log(`❌ Production test failed: ${error.message}`);
        process.exit(1);
    }
}

smokeTest();