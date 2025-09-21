#!/usr/bin/env node

// Test script for scheduler random seed reassignment endpoint
// Tests both local and production environments
// Usage: node tests/test-scheduler-random-seeds.js [server-url]

import 'dotenv/config';

const DEFAULT_LOCAL_URL = 'http://localhost:3000';
const DEFAULT_PROD_URL = 'https://hotlympics-server-670297845147.us-central1.run.app';

// Get server URL from args or use default
const SERVER_URL = process.argv[2] || DEFAULT_LOCAL_URL;
const isProduction = !SERVER_URL.includes('localhost');

// Get scheduler API key from environment
const SCHEDULER_API_KEY = process.env.SCHEDULER_API_KEY;

if (!SCHEDULER_API_KEY) {
    console.error('❌ ERROR: SCHEDULER_API_KEY not found in environment variables');
    console.log('   Please ensure your .env file contains SCHEDULER_API_KEY');
    process.exit(1);
}

console.log('🔄 Random Seed Reassignment Endpoint Test');
console.log(`Server: ${SERVER_URL}`);
console.log(`Environment: ${isProduction ? 'PRODUCTION' : 'LOCAL'}`);
console.log('==========================================\n');

async function makeSchedulerRequest(endpoint, options = {}) {
    const url = `${SERVER_URL}${endpoint}`;

    try {
        const response = await fetch(url, {
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': SCHEDULER_API_KEY,
                ...options.headers
            },
            ...options
        });

        const text = await response.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch {
            data = text;
        }

        return {
            status: response.status,
            ok: response.ok,
            data
        };
    } catch (error) {
        return {
            status: 0,
            ok: false,
            error: error.message
        };
    }
}

async function testRandomSeedReassignment() {
    console.log('🧪 Test 1: Health Check');
    console.log('------------------------');
    const health = await makeSchedulerRequest('/health', {
        method: 'GET',
        headers: {} // Health check doesn't need auth
    });
    console.log(`  Status: ${health.status} ${health.ok ? '✅' : '❌'}`);
    if (health.ok) {
        console.log(`  Server is healthy`);
    } else {
        console.log(`  Error: ${health.error || 'Server not responding'}`);
        if (SERVER_URL === DEFAULT_LOCAL_URL) {
            console.log('\n  💡 Tip: Make sure the server is running with: npm run dev');
        }
        process.exit(1);
    }
    console.log();

    console.log('🧪 Test 2: Authentication Check (Invalid Key)');
    console.log('----------------------------------------------');
    const authFail = await makeSchedulerRequest('/scheduler/reassign-random-seeds', {
        method: 'POST',
        headers: { 'x-api-key': 'invalid-key-12345' }
    });
    console.log(`  Status: ${authFail.status} ${authFail.status === 401 ? '✅' : '❌'}`);
    if (authFail.status === 401) {
        console.log(`  Correctly rejected invalid API key`);
    } else {
        console.log(`  ⚠️ Unexpected response for invalid key`);
    }
    console.log();

    console.log('🧪 Test 3: Authentication Check (No Key)');
    console.log('-----------------------------------------');
    const noAuth = await makeSchedulerRequest('/scheduler/reassign-random-seeds', {
        method: 'POST',
        headers: {}
    });
    console.log(`  Status: ${noAuth.status} ${noAuth.status === 401 ? '✅' : '❌'}`);
    if (noAuth.status === 401) {
        console.log(`  Correctly rejected request without API key`);
    } else {
        console.log(`  ⚠️ Unexpected response for missing key`);
    }
    console.log();

    console.log('🧪 Test 4: Random Seed Reassignment (Valid Key)');
    console.log('------------------------------------------------');
    console.log('  ⏳ Calling endpoint with valid scheduler API key...');

    const startTime = Date.now();
    const result = await makeSchedulerRequest('/scheduler/reassign-random-seeds', {
        method: 'POST'
    });
    const duration = Date.now() - startTime;

    console.log(`  Status: ${result.status} ${result.ok ? '✅' : '❌'}`);
    console.log(`  Duration: ${(duration / 1000).toFixed(2)}s`);

    if (result.ok) {
        console.log(`  ✅ Success!`);
        console.log(`  Images updated: ${result.data.totalImages || 0}`);
        console.log(`  Batches processed: ${result.data.batches || 0}`);
        console.log(`  Timestamp: ${result.data.timestamp}`);

        if (result.data.totalImages === 0) {
            console.log('\n  ⚠️ Note: No images were updated. This could mean:');
            console.log('     - The image-data collection is empty');
            console.log('     - This is a fresh database with no test data');
            console.log('     - You may need to create test images first');
        } else {
            console.log(`\n  🎉 Successfully reassigned random seeds for ${result.data.totalImages} images!`);
        }
    } else {
        console.log(`  ❌ Request failed`);
        console.log(`  Error: ${JSON.stringify(result.data, null, 2)}`);

        if (result.status === 401) {
            console.log('\n  💡 Authentication failed. Check that:');
            console.log('     - SCHEDULER_API_KEY in .env matches the server');
            console.log('     - The key is a 64-character hex string');
        }
    }
    console.log();

    // Summary
    console.log('📊 Test Summary');
    console.log('---------------');
    const tests = [
        { name: 'Health Check', passed: health.ok },
        { name: 'Reject Invalid Key', passed: authFail.status === 401 },
        { name: 'Reject Missing Key', passed: noAuth.status === 401 },
        { name: 'Valid Request', passed: result.ok }
    ];

    const passed = tests.filter(t => t.passed).length;
    const total = tests.length;

    tests.forEach(test => {
        console.log(`  ${test.passed ? '✅' : '❌'} ${test.name}`);
    });

    console.log(`\n${passed === total ? '🎉' : '⚠️'} ${passed}/${total} tests passed`);

    if (isProduction && result.ok) {
        console.log('\n⚠️  WARNING: You just triggered a production random seed update!');
        console.log('   All image random seeds have been reassigned in production.');
    }

    process.exit(passed === total ? 0 : 1);
}

// Run the test
testRandomSeedReassignment().catch(error => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
});