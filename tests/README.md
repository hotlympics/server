# Server Tests

This directory contains utility tests for testing and managing the Hotlympics server.

## 🎯 Consolidated Test Suite

The test suite has been streamlined into 3 focused tests that cover all functionality without redundancy:

### `test-database-connection.js`
**Comprehensive database connectivity test** - Consolidates all database connection testing into one script.

**Features:**
- Firebase Admin SDK initialization check
- Basic Firestore connection via config
- Explicit database access (`hotlympics` database)
- Data quality assessment (male/female image counts, in/out of pool)
- Cloud Storage validation (sync check between storage and database)
- Environment and credentials validation

**Usage:**
```bash
cd /home/tarquin/hotlympics/server
node tests/test-database-connection.js
```

**Sample Output:**
```
🔍 Comprehensive Database Connectivity Test

📱 Test 1: Firebase Admin SDK Initialization
  ✅ Default app initialized: [DEFAULT]

🔥 Test 2: Basic Firestore Connection (via config)
  ✅ Connected! Basic query successful (retrieved 1 document as test)

🎯 Test 3: Specific Database Access (hotlympics database)
  ✅ Explicit 'hotlympics' database access successful
  📊 Retrieved 5 documents from 33 total in collection

📊 Test 4: Data Quality Assessment
  📈 Total female images: 31 (31 in pool, 0 out of pool)
  📈 Total male images: 2 (1 in pool, 1 out of pool)
  ✅ Sufficient data for leaderboard generation

☁️ Test 5: Cloud Storage Validation
  📊 Found 33 total files in storage bucket
  🖼️  Found 33 image files in storage
  ✅ Storage and database are in sync

🔑 Test 6: Environment & Credentials Check
  ✅ Credentials valid and working

📋 Test Summary: Tests passed: 6/6, Success rate: 100%
  🎉 All database connectivity tests passed!
```

### `test-leaderboard-system.js`
**Comprehensive leaderboard system test** - Tests all leaderboard functionality including generation and metadata versioning.

**Features:**
- Configuration validation
- Global metadata tracking (pre/post regeneration)
- Individual leaderboard metadata (pre/post regeneration)
- Regeneration logic testing
- Full leaderboard generation cycle
- Metadata versioning validation (global vs individual)
- All configured leaderboards verification

**Usage:**
```bash
cd /home/tarquin/hotlympics/server
npm run build  # Required for compiled TypeScript
node tests/test-leaderboard-system.js
```

**Sample Output:**
```
🏆 Comprehensive Leaderboard System Test

⚙️ Test 1: Configuration Validation
  Config version: 1, Leaderboards configured: 4
  ✅ Configuration loaded successfully

🚀 Test 5: Leaderboard Generation
  ✅ Leaderboard generation completed

📊 Test 8: All Leaderboards Generated
  ✅ female_top: 10 entries, avg rating 1822
  ✅ male_top: 1 entries, avg rating 1500
  ✅ All 4 leaderboards generated successfully

🔢 Test 9: Metadata Versioning Validation
  ✅ All versioning behavior correct
    - Global leaderboard version: 1
    - Individual version field removed: ✅

📋 Test Summary: Tests passed: 9/9, Success rate: 100%
  🎉 All leaderboard system tests passed!
```

### `test-firestore-status.js`
**Comprehensive Firestore status checker** - System-wide status and index validation.

**Features:**
- Lists all collections and document counts
- Tests ALL 9 Firestore indexes from firestore.indexes.json:
  - **Image-data indexes (6)**: Leaderboards, random selection, user queries  
  - **Battle indexes (3)**: Timeline, participant tracking, user battle history
- Shows which indexes are ready, building, or missing
- Generic framework for adding new query tests

**Usage:**
```bash
cd /home/tarquin/hotlympics/server
node tests/test-firestore-status.js
```

**Sample Output:**
```
📡 Testing Firestore connectivity...
✅ Connected! Found 5 collections: battles, image-data, leaderboards, leaderboards_meta, users

📊 Collection sizes:
  battles: ~657 documents
  image-data: ~33 documents

📈 Testing leaderboard indexes:
  ✅ female_top: 2 results (index ready)
  ✅ male_top: 1 results (index ready)

⚔️ Testing battle indexes:
  ✅ battles by metadata.timestamp: 2 results (index ready)
  ✅ battles_by_image: 2 results (index ready)
  ✅ battles_by_winner: 2 results (index ready)

📊 All 9 Firestore indexes tested and working ✅
```

## 🗂️ Test Organization

### What Each Test Does:
1. **`test-database-connection.js` (6 tests)** - Basic connectivity, credentials, storage sync, and database access
2. **`test-leaderboard-system.js` (9 tests)** - Business logic, generation, and metadata management
3. **`test-firestore-status.js`** - System health, indexes, and query performance

### When to Use Each Test:
- **Connection issues?** → `test-database-connection.js`
- **Leaderboard problems?** → `test-leaderboard-system.js`
- **Index/query issues?** → `test-firestore-status.js`
- **System overview?** → Run all three

## 📋 Prerequisites

All scripts require:
- Built TypeScript code: `npm run build` (for leaderboard tests)
- Service account file: `./hotlympics-service-account.json`
- Proper Firestore indexes (for leaderboard scripts)

## 🔧 Troubleshooting

If you encounter database connection issues, refer to `/FIRESTORE_DEBUGGING_GUIDE.md` for common solutions.

**Key Points:**
- Project ID is `hotlympics` (NOT `default`)
- **Project has TWO databases:**
  - `(default)` database: Datastore mode (EMPTY - not used)
  - `hotlympics` database: Native Firestore mode (WHERE ALL DATA IS)
- Always use the `hotlympics` database: `getFirestore(app, 'hotlympics')`
- Use the correct service account credentials

## 🚀 Quick Health Check

Run all tests in sequence for a complete system check:
```bash
cd /home/tarquin/hotlympics/server
npm run build
node tests/test-database-connection.js
node tests/test-leaderboard-system.js  
node tests/test-firestore-status.js
```