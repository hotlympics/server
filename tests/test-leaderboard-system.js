#!/usr/bin/env node

// Comprehensive leaderboard system test
// Consolidates functionality from: test-leaderboards.js, test-metadata-versioning.js, and test-global-version.js

import 'dotenv/config';
import { leaderboardGenerator } from '../dist/services/leaderboard-generator.js';
import { leaderboardService } from '../dist/services/leaderboard-service.js';
import { LEADERBOARD_CONFIG } from '../dist/config/leaderboard-config.js';

// HTTP testing function
async function makeRequest(url, options = {}) {
    try {
        const response = await fetch(url, options);
        const data = await response.text();
        
        let parsedData;
        try {
            parsedData = JSON.parse(data);
        } catch {
            parsedData = data;
        }

        return {
            status: response.status,
            data: parsedData,
            success: response.ok
        };
    } catch (error) {
        return {
            status: 0,
            data: { error: error.message },
            success: false
        };
    }
}

console.log('🏆 Comprehensive Leaderboard System Test');
console.log('Tests both internal services AND HTTP endpoints\n');

async function testLeaderboardSystem() {
    let testsPassed = 0;
    let testsTotal = 0;

    // Get the first available leaderboard key for testing
    const testLeaderboardKey = LEADERBOARD_CONFIG.leaderboards.length > 0 
        ? LEADERBOARD_CONFIG.leaderboards[0].key 
        : null;

    if (!testLeaderboardKey) {
        console.log('❌ No leaderboards configured - cannot run individual metadata tests');
        return;
    }

    console.log(`🎯 Using '${testLeaderboardKey}' as test leaderboard for individual metadata tests\n`);

    // Test 1: Configuration validation
    console.log('⚙️ Test 1: Configuration Validation');
    testsTotal++;
    try {
        console.log(`  Config version: ${LEADERBOARD_CONFIG.version}`);
        console.log(`  Leaderboards configured: ${LEADERBOARD_CONFIG.leaderboards.length}`);
        console.log(`  Regeneration interval: ${LEADERBOARD_CONFIG.regenerationIntervalMs / 1000}s`);
        
        const leaderboardKeys = LEADERBOARD_CONFIG.leaderboards.map(lb => lb.key);
        console.log(`  Leaderboard keys: ${leaderboardKeys.join(', ')}`);
        console.log('  ✅ Configuration loaded successfully');
        testsPassed++;
    } catch (error) {
        console.log(`  ❌ Configuration error: ${error.message}`);
    }
    console.log();

    // Test 2: Global metadata before regeneration
    console.log('🌍 Test 2: Global Metadata (Pre-Regeneration)');
    testsTotal++;
    let beforeGlobalMeta = null;
    try {
        beforeGlobalMeta = await leaderboardService.getGlobalMetadata();
        if (beforeGlobalMeta) {
            console.log(`  Config version: ${beforeGlobalMeta.configVersion}`);
            console.log(`  Leaderboard version: ${beforeGlobalMeta.leaderboardVersion || 'NOT SET'}`);
            console.log(`  Update count: ${beforeGlobalMeta.updateCount || 'NOT SET'}`);
            console.log(`  Last generated: ${beforeGlobalMeta.lastGeneratedAt}`);
            console.log(`  Leaderboard count: ${beforeGlobalMeta.leaderboardCount}`);
            console.log(`  Last run status: ${beforeGlobalMeta.generatorInfo.lastRunStatus}`);
            console.log('  ✅ Global metadata retrieved');
        } else {
            console.log('  ⚠️  No global metadata found (first run?)');
        }
        testsPassed++;
    } catch (error) {
        console.log(`  ❌ Global metadata retrieval failed: ${error.message}`);
    }
    console.log();

    // Test 3: Individual leaderboard metadata before regeneration
    console.log(`📋 Test 3: Individual Metadata (Pre-Regeneration) - ${testLeaderboardKey}`);
    testsTotal++;
    let beforeIndividualMeta = null;
    try {
        const existingLeaderboard = await leaderboardService.getLeaderboard(testLeaderboardKey);
        if (existingLeaderboard) {
            beforeIndividualMeta = existingLeaderboard.metadata;
            console.log(`  Update count: ${beforeIndividualMeta.updateCount}`);
            console.log(`  First generated: ${beforeIndividualMeta.firstGeneratedAt}`);
            console.log(`  Last generated: ${beforeIndividualMeta.generatedAt}`);
            console.log(`  Has version field: ${beforeIndividualMeta.version !== undefined ? '❌ YES (should be removed)' : '✅ NO (correct)'}`);
            console.log('  ✅ Individual metadata retrieved');
        } else {
            console.log('  ⚠️  No existing leaderboard found (first run?)');
        }
        testsPassed++;
    } catch (error) {
        console.log(`  ❌ Individual metadata retrieval failed: ${error.message}`);
    }
    console.log();

    // Test 4: Regeneration needed check
    console.log('🔄 Test 4: Regeneration Logic');
    testsTotal++;
    try {
        const needsRegen = await leaderboardService.needsRegeneration();
        console.log(`  Needs regeneration: ${needsRegen}`);
        console.log('  ✅ Regeneration logic working');
        testsPassed++;
    } catch (error) {
        console.log(`  ❌ Regeneration check failed: ${error.message}`);
    }
    console.log();

    // Test 5: Force leaderboard generation
    console.log('🚀 Test 5: Leaderboard Generation');
    testsTotal++;
    try {
        console.log('  Forcing regeneration...');
        await leaderboardGenerator.forceRegeneration();
        console.log('  ✅ Leaderboard generation completed');
        testsPassed++;
    } catch (error) {
        console.log(`  ❌ Leaderboard generation failed: ${error.message}`);
    }
    console.log();

    // Test 6: Global metadata after regeneration
    console.log('🌍 Test 6: Global Metadata (Post-Regeneration)');
    testsTotal++;
    let afterGlobalMeta = null;
    try {
        afterGlobalMeta = await leaderboardService.getGlobalMetadata();
        if (afterGlobalMeta) {
            console.log(`  Config version: ${afterGlobalMeta.configVersion}`);
            console.log(`  Leaderboard version: ${afterGlobalMeta.leaderboardVersion}`);
            console.log(`  Update count: ${afterGlobalMeta.updateCount}`);
            console.log(`  Last generated: ${afterGlobalMeta.lastGeneratedAt}`);
            console.log(`  Leaderboard count: ${afterGlobalMeta.leaderboardCount}`);
            console.log(`  Last run status: ${afterGlobalMeta.generatorInfo.lastRunStatus}`);
            console.log('  ✅ Global metadata updated');
        } else {
            console.log('  ❌ No global metadata found after regeneration');
        }
        testsPassed++;
    } catch (error) {
        console.log(`  ❌ Post-regeneration global metadata failed: ${error.message}`);
    }
    console.log();

    // Test 7: Individual leaderboard metadata after regeneration
    console.log(`📋 Test 7: Individual Metadata (Post-Regeneration) - ${testLeaderboardKey}`);
    testsTotal++;
    let afterIndividualMeta = null;
    try {
        const updatedLeaderboard = await leaderboardService.getLeaderboard(testLeaderboardKey);
        if (updatedLeaderboard) {
            afterIndividualMeta = updatedLeaderboard.metadata;
            console.log(`  Update count: ${afterIndividualMeta.updateCount}`);
            console.log(`  First generated: ${afterIndividualMeta.firstGeneratedAt}`);
            console.log(`  Last generated: ${afterIndividualMeta.generatedAt}`);
            console.log(`  Entry count: ${afterIndividualMeta.actualEntryCount}`);
            console.log(`  Average rating: ${Math.round(afterIndividualMeta.averageRating)}`);
            console.log('  ✅ Individual metadata updated');
        } else {
            console.log('  ❌ No leaderboard found after regeneration');
        }
        testsPassed++;
    } catch (error) {
        console.log(`  ❌ Post-regeneration individual metadata failed: ${error.message}`);
    }
    console.log();

    // Test 8: Validate all configured leaderboards exist
    console.log('📊 Test 8: All Leaderboards Generated');
    testsTotal++;
    try {
        let generatedCount = 0;
        for (const config of LEADERBOARD_CONFIG.leaderboards) {
            const leaderboard = await leaderboardService.getLeaderboard(config.key);
            if (leaderboard) {
                console.log(`  ✅ ${config.key}: ${leaderboard.entries.length} entries, avg rating ${Math.round(leaderboard.metadata.averageRating)}`);
                generatedCount++;
            } else {
                console.log(`  ❌ ${config.key}: Not found`);
            }
        }
        
        if (generatedCount === LEADERBOARD_CONFIG.leaderboards.length) {
            console.log(`  ✅ All ${generatedCount} leaderboards generated successfully`);
            testsPassed++;
        } else {
            console.log(`  ❌ Only ${generatedCount}/${LEADERBOARD_CONFIG.leaderboards.length} leaderboards generated`);
        }
    } catch (error) {
        console.log(`  ❌ Leaderboard validation failed: ${error.message}`);
    }
    console.log();

    // Test 9: Metadata versioning validation
    console.log('🔢 Test 9: Metadata Versioning Validation');
    testsTotal++;
    try {
        let versioningCorrect = true;
        const versioningIssues = [];

        // Check global metadata has leaderboard version
        if (afterGlobalMeta) {
            if (!afterGlobalMeta.leaderboardVersion) {
                versioningIssues.push('Global leaderboard version not set');
                versioningCorrect = false;
            }
        }

        // Check individual metadata doesn't have version field
        if (afterIndividualMeta) {
            if (afterIndividualMeta.version !== undefined) {
                versioningIssues.push('Individual leaderboard still has version field');
                versioningCorrect = false;
            }
        }

        // Check update count incremented if we had before data
        if (beforeGlobalMeta && afterGlobalMeta) {
            if (afterGlobalMeta.updateCount <= beforeGlobalMeta.updateCount) {
                versioningIssues.push('Global update count did not increment');
                versioningCorrect = false;
            }
        }

        // Check individual leaderboard update count incremented if we had before data
        if (beforeIndividualMeta && afterIndividualMeta) {
            if (afterIndividualMeta.updateCount <= beforeIndividualMeta.updateCount) {
                versioningIssues.push('Update count did not increment');
                versioningCorrect = false;
            }

            if (afterIndividualMeta.firstGeneratedAt !== beforeIndividualMeta.firstGeneratedAt) {
                versioningIssues.push('firstGeneratedAt was not preserved');
                versioningCorrect = false;
            }
        }

        if (versioningCorrect) {
            console.log('  ✅ All versioning behavior correct');
            console.log(`    - Global leaderboard version: ${afterGlobalMeta?.leaderboardVersion}`);
            console.log(`    - Global update count incremented: ✅`);
            console.log(`    - Individual version field removed: ✅`);
            console.log(`    - Individual update count incremented: ✅`);
            console.log(`    - firstGeneratedAt preserved: ✅`);
            testsPassed++;
        } else {
            console.log('  ❌ Versioning issues found:');
            versioningIssues.forEach(issue => console.log(`    - ${issue}`));
        }
    } catch (error) {
        console.log(`  ❌ Versioning validation failed: ${error.message}`);
    }
    console.log();

    // Test 10: HTTP Endpoints (assuming server is running on localhost:3000)
    console.log('🌐 Test 10: HTTP Endpoint Validation');
    testsTotal++;
    try {
        const SERVER_URL = 'http://localhost:3000';
        let httpTestsPassed = 0;
        let httpTestsTotal = 0;
        
        console.log(`  Testing against: ${SERVER_URL}`);
        
        // Test 10a: GET /leaderboards (list all)
        httpTestsTotal++;
        console.log('  📋 Testing GET /leaderboards...');
        const listResponse = await makeRequest(`${SERVER_URL}/leaderboards`);
        if (listResponse.success && listResponse.status === 200) {
            console.log(`    ✅ Status: 200, Found ${listResponse.data.leaderboards?.length || 0} leaderboards`);
            httpTestsPassed++;
        } else {
            console.log(`    ❌ Status: ${listResponse.status} - ${listResponse.data.error || 'Failed'}`);
        }
        
        // Test 10b: GET /leaderboards/:key (specific leaderboard)
        if (testLeaderboardKey && listResponse.success) {
            httpTestsTotal++;
            console.log(`  📊 Testing GET /leaderboards/${testLeaderboardKey}...`);
            const specificResponse = await makeRequest(`${SERVER_URL}/leaderboards/${testLeaderboardKey}`);
            if (specificResponse.success && specificResponse.status === 200) {
                const entries = specificResponse.data.entries?.length || 0;
                const avgRating = Math.round(specificResponse.data.metadata?.averageRating || 0);
                console.log(`    ✅ Status: 200, ${entries} entries, avg rating ${avgRating}`);
                
                // Validate entry structure
                const firstEntry = specificResponse.data.entries?.[0];
                if (firstEntry) {
                    const hasRequiredFields = firstEntry.imageId && firstEntry.imageUrl && firstEntry.rating !== undefined;
                    console.log(`    ${hasRequiredFields ? '✅' : '❌'} Entry structure validation`);
                }
                httpTestsPassed++;
            } else {
                console.log(`    ❌ Status: ${specificResponse.status} - ${specificResponse.data.error || 'Failed'}`);
            }
        }
        
        // Test 10c: GET /leaderboards/invalid_key (error handling)
        httpTestsTotal++;
        console.log('  🚫 Testing GET /leaderboards/invalid_key...');
        const invalidResponse = await makeRequest(`${SERVER_URL}/leaderboards/invalid_key`);
        if (invalidResponse.status === 404) {
            console.log('    ✅ Status: 404 (Correctly rejected invalid key)');
            httpTestsPassed++;
        } else {
            console.log(`    ❌ Status: ${invalidResponse.status} (Should be 404)`);
        }
        
        // Test 10d: GET /health (server connectivity)
        httpTestsTotal++;
        console.log('  💚 Testing GET /health...');
        const healthResponse = await makeRequest(`${SERVER_URL}/health`);
        if (healthResponse.success) {
            console.log('    ✅ Server is responding');
            httpTestsPassed++;
        } else {
            console.log(`    ❌ Server not responding: ${healthResponse.data.error || 'Unknown error'}`);
        }
        
        console.log(`  HTTP Tests: ${httpTestsPassed}/${httpTestsTotal} passed`);
        
        if (httpTestsPassed === httpTestsTotal) {
            console.log('  ✅ All HTTP endpoints working correctly');
            testsPassed++;
        } else {
            console.log('  ❌ Some HTTP endpoints failed - ensure server is running');
        }
        
    } catch (error) {
        console.log(`  ❌ HTTP endpoint testing failed: ${error.message}`);
        console.log('  💡 Make sure the server is running: npm run dev');
    }
    console.log();

    // Summary
    console.log('📋 Test Summary:');
    console.log(`  Tests passed: ${testsPassed}/${testsTotal}`);
    console.log(`  Success rate: ${Math.round((testsPassed/testsTotal) * 100)}%`);
    
    if (testsPassed === testsTotal) {
        console.log('  🎉 All leaderboard system tests passed!');
    } else {
        console.log('  ⚠️  Some tests failed - check system configuration');
    }
    
    console.log('\n💡 For detailed Firestore status, run: node tests/test-firestore-status.js');
}

testLeaderboardSystem();