#!/usr/bin/env node

// Generic Firestore index status checker
import { firestore } from '../dist/config/firebase-admin.js';
import { readFileSync } from 'fs';
import { join } from 'path';

async function checkFirestoreStatus() {
    console.log('🔍 Checking Firestore status and indexes...');
    
    // Read the actual firestore.indexes.json file
    let expectedIndexes = [];
    let indexFileError = null;
    try {
        const indexFilePath = join(process.cwd(), 'firestore.indexes.json');
        const indexFileContent = readFileSync(indexFilePath, 'utf8');
        const indexConfig = JSON.parse(indexFileContent);
        expectedIndexes = indexConfig.indexes || [];
        console.log(`📋 Found ${expectedIndexes.length} indexes defined in firestore.indexes.json`);
    } catch (error) {
        indexFileError = error.message;
        console.log(`⚠️  Could not read firestore.indexes.json: ${error.message}`);
    }
    
    try {
        // Check basic Firestore connectivity
        console.log('\n📡 Testing Firestore connectivity...');
        const collections = await firestore.listCollections();
        console.log(`✅ Connected! Found ${collections.length} collections:`);
        collections.forEach(col => console.log(`  - ${col.id}`));
        
        // Get collection sizes
        console.log('\n📊 Collection sizes:');
        for (const collection of collections) {
            try {
                // Use count aggregation query directly (1 read instead of 2)
                const countSnapshot = await firestore.collection(collection.id).count().get();
                const count = countSnapshot.data().count;
                
                if (count > 0) {
                    console.log(`  ${collection.id}: ${count} documents`);
                } else {
                    console.log(`  ${collection.id}: empty`);
                }
            } catch (error) {
                console.log(`  ${collection.id}: error reading (${error.message})`);
            }
        }
        
        // Test common query patterns that require indexes
        console.log('\n🔍 Testing indexed queries...');
        
        let imageDataTestsPassed = 0;
        let imageDataTestsTotal = 0;
        let battleTestsPassed = 0;
        let battleTestsTotal = 0;
        
        // Test all Firestore indexes (dynamically counted)
        if (collections.some(col => col.id === 'image-data')) {
            console.log('\n📈 Testing image-data indexes:');
            
            const imageDataQueries = [
                {
                    name: 'leaderboard_female_top (index 8)',
                    query: () => firestore.collection('image-data')
                        .where('inPool', '==', true)
                        .where('gender', '==', 'female')
                        .orderBy('glicko.rating', 'desc')
                        .limit(2)
                },
                {
                    name: 'leaderboard_female_bottom (index 9)', 
                    query: () => firestore.collection('image-data')
                        .where('inPool', '==', true)
                        .where('gender', '==', 'female')
                        .orderBy('glicko.rating', 'asc')
                        .limit(2)
                },
                {
                    name: 'leaderboard_male_top (index 8)',
                    query: () => firestore.collection('image-data')
                        .where('inPool', '==', true)
                        .where('gender', '==', 'male')
                        .orderBy('glicko.rating', 'desc')
                        .limit(2)
                },
                {
                    name: 'leaderboard_male_bottom (index 9)',
                    query: () => firestore.collection('image-data')
                        .where('inPool', '==', true)
                        .where('gender', '==', 'male')
                        .orderBy('glicko.rating', 'asc')
                        .limit(2)
                },
                {
                    name: 'random_selection_all (index 4)',
                    query: () => firestore.collection('image-data')
                        .where('inPool', '==', true)
                        .orderBy('randomSeed')
                        .limit(2)
                },
                {
                    name: 'random_selection_female (index 5)',
                    query: () => firestore.collection('image-data')
                        .where('inPool', '==', true)
                        .where('gender', '==', 'female')
                        .orderBy('randomSeed')
                        .limit(2)
                },
                {
                    name: 'random_by_user (index 6)',
                    query: async () => {
                        // Get a sample userId from image-data
                        const userSample = await firestore.collection('image-data').limit(1).get();
                        if (userSample.empty) return null;
                        const userId = userSample.docs[0].data().userId;
                        if (!userId) return null;
                        
                        return firestore.collection('image-data')
                            .where('inPool', '==', true)
                            .where('userId', '==', userId)
                            .orderBy('randomSeed')
                            .limit(2);
                    }
                },
                {
                    name: 'complex_user_query (index 7)',
                    query: async () => {
                        // Get a sample userId from image-data
                        const userSample = await firestore.collection('image-data').limit(1).get();
                        if (userSample.empty) return null;
                        const userData = userSample.docs[0].data();
                        if (!userData.userId || !userData.gender) return null;
                        
                        return firestore.collection('image-data')
                            .where('gender', '==', userData.gender)
                            .where('inPool', '==', true)
                            .where('userId', '==', userData.userId)
                            .orderBy('randomSeed')
                            .limit(2);
                    }
                }
            ];
            
            for (const test of imageDataQueries) {
                imageDataTestsTotal++;
                try {
                    const queryOrPromise = await test.query();
                    if (queryOrPromise === null) {
                        console.log(`  ⚠️  ${test.name}: skipped (no sample data)`);
                        continue;
                    }
                    
                    // Handle both direct queries and async queries that return queries
                    const snapshot = queryOrPromise.get ? await queryOrPromise.get() : await queryOrPromise;
                    console.log(`  ✅ ${test.name}: ${snapshot.size} results (index ready)`);
                    imageDataTestsPassed++;
                } catch (error) {
                    if (error.message.includes('currently building')) {
                        console.log(`  ⏳ ${test.name}: index building...`);
                    } else if (error.message.includes('requires an index')) {
                        console.log(`  ❌ ${test.name}: index missing`);
                    } else {
                        console.log(`  ❌ ${test.name}: error (${error.message})`);
                    }
                }
            }
            
            console.log(`  📊 Image-data index tests: ${imageDataTestsPassed}/${imageDataTestsTotal} passed`);
        }
        
        // Test battle queries if battles collection exists
        if (collections.some(col => col.id === 'battles')) {
            console.log('\n⚔️ Testing battle indexes:');
            
            const battleQueries = [
                {
                    name: 'basic_timestamp_ordering (simple)',
                    query: () => firestore.collection('battles')
                        .orderBy('metadata.timestamp', 'desc')
                        .limit(2)
                },
                {
                    name: 'battles_by_image (index 1)',
                    query: async () => {
                        // Get a sample image ID first
                        const imageSnapshot = await firestore.collection('image-data').limit(1).get();
                        if (imageSnapshot.empty) return null;
                        const imageId = imageSnapshot.docs[0].id;
                        
                        return firestore.collection('battles')
                            .where('participants.imageIds', 'array-contains', imageId)
                            .orderBy('metadata.timestamp', 'desc')
                            .limit(2);
                    }
                },
                {
                    name: 'battles_by_winner (index 2)',
                    query: async () => {
                        // Get a sample user ID from battles
                        const sampleSnapshot = await firestore.collection('battles').limit(1).get();
                        if (sampleSnapshot.empty) return null;
                        const winnerId = sampleSnapshot.docs[0].data().participants?.winner?.userId;
                        if (!winnerId) return null;
                        
                        return firestore.collection('battles')
                            .where('participants.winner.userId', '==', winnerId)
                            .orderBy('metadata.timestamp', 'desc')
                            .limit(2);
                    }
                },
                {
                    name: 'battles_by_loser (index 3)',
                    query: async () => {
                        // Get a sample user ID from battles
                        const sampleSnapshot = await firestore.collection('battles').limit(1).get();
                        if (sampleSnapshot.empty) return null;
                        const loserId = sampleSnapshot.docs[0].data().participants?.loser?.userId;
                        if (!loserId) return null;
                        
                        return firestore.collection('battles')
                            .where('participants.loser.userId', '==', loserId)
                            .orderBy('metadata.timestamp', 'desc')
                            .limit(2);
                    }
                }
            ];
            
            for (const test of battleQueries) {
                battleTestsTotal++;
                try {
                    const queryOrPromise = await test.query();
                    if (queryOrPromise === null) {
                        console.log(`  ⚠️  ${test.name}: skipped (no sample data)`);
                        continue;
                    }
                    
                    const snapshot = await queryOrPromise.get();
                    console.log(`  ✅ ${test.name}: ${snapshot.size} results (index ready)`);
                    battleTestsPassed++;
                } catch (error) {
                    if (error.message.includes('currently building')) {
                        console.log(`  ⏳ ${test.name}: index building...`);
                    } else if (error.message.includes('requires an index')) {
                        console.log(`  ❌ ${test.name}: index missing`);
                    } else {
                        console.log(`  ❌ ${test.name}: error (${error.message})`);
                    }
                }
            }
            
            console.log(`  📊 Battle index tests: ${battleTestsPassed}/${battleTestsTotal} passed`);
        }
        
        console.log('\n🎉 Firestore status check complete!');
        
        // Summary with index coverage analysis
        const totalTestPatterns = imageDataTestsTotal + battleTestsTotal;
        const totalTestsPassed = imageDataTestsPassed + battleTestsPassed;
        
        console.log(`📈 Test Results: ${totalTestsPassed}/${totalTestPatterns} index patterns working correctly`);
        
        if (!indexFileError && expectedIndexes.length > 0) {
            const imageDataIndexes = expectedIndexes.filter(idx => idx.collectionGroup === 'image-data').length;
            const battleIndexes = expectedIndexes.filter(idx => idx.collectionGroup === 'battles').length;
            const totalExpectedIndexes = expectedIndexes.length;
            
            console.log(`📊 Index Coverage Analysis:`);
            console.log(`  Expected indexes: ${totalExpectedIndexes} (${imageDataIndexes} image-data, ${battleIndexes} battles)`);
            console.log(`  Test patterns: ${totalTestPatterns} (${imageDataTestsTotal} image-data, ${battleTestsTotal} battles)`);
            
            if (totalTestPatterns < totalExpectedIndexes) {
                console.log(`  ⚠️  Coverage gap: ${totalExpectedIndexes - totalTestPatterns} indexes may not be tested`);
                console.log(`  💡 Consider adding tests for any missing indexes`);
            } else if (totalTestPatterns === totalExpectedIndexes) {
                console.log(`  ✅ Full coverage: All defined indexes have test patterns`);
            } else {
                console.log(`  📈 Extended coverage: Testing more patterns than defined indexes (good for validation)`);
            }
        }
        
    } catch (error) {
        console.error('❌ Firestore status check failed:', error.message);
        console.error('Full error:', error);
    }
}

checkFirestoreStatus();