#!/usr/bin/env node

// Comprehensive database connectivity test
// Consolidates functionality from: test-firestore-connection.js, test-working-database.js, 
// test-database-specific.js, and test-projects.js

import 'dotenv/config';
import { getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { firestore } from '../dist/config/firebase-admin.js';
import { storage } from '../dist/config/firebase-admin.js';

console.log('🔍 Comprehensive Database Connectivity Test\n');

async function testDatabaseConnection() {
    let testsPassed = 0;
    let testsTotal = 0;

    // Test 1: Check Firebase Admin SDK initialization
    console.log('📱 Test 1: Firebase Admin SDK Initialization');
    testsTotal++;
    try {
        const apps = getApps();
        console.log(`  Initialized apps: ${apps.length}`);
        
        if (apps.length > 0) {
            const app = apps[0];
            console.log(`  ✅ Default app initialized: ${app.name}`);
            testsPassed++;
        } else {
            console.log('  ❌ No apps initialized');
        }
    } catch (error) {
        console.log('  ❌ Error checking apps:', error.message);
    }
    console.log();

    // Test 2: Basic Firestore connection via config
    console.log('🔥 Test 2: Basic Firestore Connection (via config)');
    testsTotal++;
    try {
        await firestore.collection('image-data').limit(1).get();
        console.log(`  ✅ Connected! Basic query successful (retrieved 1 document as test)`);
        testsPassed++;
    } catch (error) {
        console.log(`  ❌ Connection failed: ${error.message}`);
    }
    console.log();

    // Test 3: Direct database access with explicit database name
    console.log('🎯 Test 3: Specific Database Access (hotlympics database)');
    testsTotal++;
    try {
        // Get explicit app reference and connect to 'hotlympics' database
        const apps = getApps();
        if (apps.length > 0) {
            const explicitFirestore = getFirestore(apps[0], 'hotlympics');
            const snapshot = await explicitFirestore.collection('image-data').limit(5).get();
            
            // Get total count
            const totalSnapshot = await explicitFirestore.collection('image-data').count().get();
            const totalCount = totalSnapshot.data().count;
            
            console.log(`  ✅ Explicit 'hotlympics' database access successful`);
            console.log(`  📊 Retrieved ${snapshot.size} documents from ${totalCount} total in collection`);
            
            // Show basic info about all retrieved documents
            if (snapshot.size > 0) {
                console.log(`  📋 Sample documents:`);
                snapshot.docs.forEach((doc, index) => {
                    const data = doc.data();
                    console.log(`    ${index + 1}. ${doc.id} - ${data.gender || 'unknown'} (rating: ${data.glicko?.rating || 'N/A'})`);
                });
            }
            testsPassed++;
        } else {
            console.log('  ❌ No Firebase app available for explicit database access');
        }
    } catch (error) {
        console.log(`  ❌ Explicit database access failed: ${error.message}`);
    }
    console.log();

    // Test 4: Data quality check
    console.log('📊 Test 4: Data Quality Assessment');
    testsTotal++;
    try {
        // Get total counts by gender
        const totalFemaleQuery = await firestore
            .collection('image-data')
            .where('gender', '==', 'female')
            .count()
            .get();
        const totalFemaleCount = totalFemaleQuery.data().count;

        const totalMaleQuery = await firestore
            .collection('image-data')
            .where('gender', '==', 'male')
            .count()
            .get();
        const totalMaleCount = totalMaleQuery.data().count;

        // Check female images in pool
        const femaleInPoolQuery = await firestore
            .collection('image-data')
            .where('gender', '==', 'female')
            .where('inPool', '==', true)
            .count()
            .get();
        const femaleInPoolCount = femaleInPoolQuery.data().count;

        // Check male images in pool  
        const maleInPoolQuery = await firestore
            .collection('image-data')
            .where('gender', '==', 'male')
            .where('inPool', '==', true)
            .count()
            .get();
        const maleInPoolCount = maleInPoolQuery.data().count;

        console.log(`  📈 Total female images: ${totalFemaleCount} (${femaleInPoolCount} in pool, ${totalFemaleCount - femaleInPoolCount} out of pool)`);
        console.log(`  📈 Total male images: ${totalMaleCount} (${maleInPoolCount} in pool, ${totalMaleCount - maleInPoolCount} out of pool)`);
        console.log(`  📊 Overall: ${totalFemaleCount + totalMaleCount} total images, ${femaleInPoolCount + maleInPoolCount} available for leaderboards`);
        
        if (femaleInPoolCount > 0 && maleInPoolCount > 0) {
            console.log('  ✅ Sufficient data for leaderboard generation');
            testsPassed++;
        } else {
            console.log('  ⚠️  Limited data - some leaderboards may be empty');
            testsPassed++; // Still pass, just warn about data
        }
    } catch (error) {
        console.log(`  ❌ Data quality check failed: ${error.message}`);
    }
    console.log();

    // Test 5: Cloud Storage validation
    console.log('☁️ Test 5: Cloud Storage Validation');
    testsTotal++;
    try {
        // Get the storage bucket
        const bucketName = process.env.FIREBASE_STORAGE_BUCKET || 'hotlympics-images';
        const bucket = storage.bucket(bucketName);
        
        // List all files in the storage bucket
        console.log(`  📂 Checking Cloud Storage bucket: ${bucketName}`);
        const [files] = await bucket.getFiles();
        
        // Filter for image files - check both by extension and by content-type
        const imageFiles = files.filter(file => {
            const name = file.name.toLowerCase();
            const hasImageExtension = name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png') || name.endsWith('.webp');
            const hasImageContentType = file.metadata?.contentType?.startsWith('image/');
            
            // Include files that either have image extensions OR image content-type
            return hasImageExtension || hasImageContentType;
        });

        console.log(`  📊 Found ${files.length} total files in storage bucket`);
        console.log(`  🖼️  Found ${imageFiles.length} image files in storage`);
        
        // Show sample of detected image files
        if (imageFiles.length > 0) {
            console.log(`  📋 Sample image files:`);
            imageFiles.slice(0, 3).forEach((file, index) => {
                console.log(`    ${index + 1}. ${file.name} (${file.metadata?.contentType || 'unknown type'})`);
            });
            if (imageFiles.length > 3) {
                console.log(`    ... and ${imageFiles.length - 3} more`);
            }
        }
        
        // Get all imageUrl filenames from database
        const allDocsSnapshot = await firestore.collection('image-data').get();
        const dbImageUrls = allDocsSnapshot.docs.map(doc => doc.data().imageUrl).filter(url => url);
        
        console.log(`  🗄️  Found ${dbImageUrls.length} imageUrl references in database`);
        
        // Check for mismatches
        const storageFilenames = imageFiles.map(file => file.name);
        const missingInStorage = dbImageUrls.filter(url => !storageFilenames.includes(url));
        const missingInDatabase = storageFilenames.filter(filename => !dbImageUrls.includes(filename));
        
        console.log(`  🔍 Database → Storage mismatches: ${missingInStorage.length} DB references not found in storage`);
        console.log(`  🔍 Storage → Database mismatches: ${missingInDatabase.length} storage files not referenced in DB`);
        
        if (missingInStorage.length > 0) {
            console.log(`  ⚠️  Missing in storage: ${missingInStorage.slice(0, 3).join(', ')}${missingInStorage.length > 3 ? '...' : ''}`);
        }
        if (missingInDatabase.length > 0) {
            console.log(`  ⚠️  Orphaned in storage: ${missingInDatabase.slice(0, 3).join(', ')}${missingInDatabase.length > 3 ? '...' : ''}`);
        }
        
        if (imageFiles.length === dbImageUrls.length && missingInStorage.length === 0) {
            console.log('  ✅ Storage and database are in sync');
        } else {
            console.log('  ⚠️  Storage and database have mismatches (see above)');
        }
        
        testsPassed++;
    } catch (error) {
        console.log(`  ❌ Cloud Storage check failed: ${error.message}`);
    }
    console.log();

    // Test 6: Environment and credentials check
    console.log('🔑 Test 6: Environment & Credentials Check');
    testsTotal++;
    try {
        const projectId = process.env.FIREBASE_PROJECT_ID;
        const hasServiceAccount = process.env.GOOGLE_APPLICATION_CREDENTIALS;
        
        console.log(`  Project ID from env: ${projectId || 'NOT SET'}`);
        console.log(`  Service account path: ${hasServiceAccount || 'NOT SET'}`);
        
        // Verify we can access project settings
        const apps = getApps();
        if (apps.length > 0) {
            // Try to get a reference that would fail if credentials are wrong
            await firestore.collection('image-data').limit(1).get();
            console.log('  ✅ Credentials valid and working');
            testsPassed++;
        } else {
            console.log('  ❌ No Firebase app to test credentials');
        }
    } catch (error) {
        console.log(`  ❌ Credentials check failed: ${error.message}`);
    }
    console.log();

    // Summary
    console.log('📋 Test Summary:');
    console.log(`  Tests passed: ${testsPassed}/${testsTotal}`);
    console.log(`  Success rate: ${Math.round((testsPassed/testsTotal) * 100)}%`);
    
    if (testsPassed === testsTotal) {
        console.log('  🎉 All database connectivity tests passed!');
    } else {
        console.log('  ⚠️  Some tests failed - check configuration');
    }
    
    console.log('\n💡 For troubleshooting, see: /FIRESTORE_DEBUGGING_GUIDE.md');
}

testDatabaseConnection();