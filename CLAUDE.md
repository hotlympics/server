# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hotlympics Server - Backend API for an image rating application using the Glicko-2 rating system for pairwise comparisons.

## Technical Stack

- **Runtime**: Node.js with TypeScript (ESM modules)
- **Framework**: Express.js
- **Database**: Google Firestore (`hotlympics` database - NOT default)
- **Storage**: Google Cloud Storage for images
- **Authentication**: Firebase Admin SDK
- **Build**: TypeScript compiler + Vite for dev server

## Code Style

- **Indentation**: 4 spaces everywhere
- **Blank Lines**: Never indent blank lines
- **File Naming**: Use kebab-case (e.g., `auth-service.ts`)
- **TypeScript**: Strict mode with proper typing
- **Comments**: Use sparingly

## Development Commands

```bash
npm run dev              # Start development server (vite-node)
npm run build            # Compile TypeScript
npm run start            # Run production server
npm run lint             # Run ESLint
npm run lint:fix         # Fix linting issues
npm run format           # Format with Prettier
npm run typecheck        # TypeScript type checking
./run-checks.sh          # Run all checks (install, format, lint, build)
npm run deploy:rules     # Deploy Firestore security rules
npm run deploy:indexes   # Deploy Firestore indexes
```

## After Making Changes

Run checks before considering changes complete:
```bash
npm i && npm run build && npm run lint
```

Or use the convenience script:
```bash
./run-checks.sh
```

## Architecture

### Core Services
- **glicko2-service**: Glicko-2 rating calculations (rating=1500, rd=350, volatility=0.06 defaults)
- **rating-service**: Battle processing and rating updates
- **leaderboard-service**: Generate and cache leaderboards by gender
- **storage-service**: Google Cloud Storage operations for images
- **image-data-service**: Image metadata and pool management
- **battle-history-service**: Track rating battles between images
- **report-service**: Content moderation and reporting system

### Middleware Stack
- **firebase-auth-middleware**: User authentication via Firebase
- **admin-auth-middleware**: Admin panel authentication (username/password)
- **scheduler-auth-middleware**: API key auth for scheduled tasks
- **upload-middleware**: Multer configuration for image uploads
- **error-handler**: Consistent error response format

### API Routes
- `/api/images/*` - Image upload and metadata endpoints
- `/api/ratings/*` - Submit battle results and get image pairs
- `/api/leaderboards/*` - Retrieve cached leaderboard data
- `/api/users/*` - User profile and statistics
- `/api/reports/*` - Content reporting endpoints
- `/api/admin/*` - Admin dashboard endpoints
- `/health` - Service health check

## Database Structure

### Firestore Collections (in `hotlympics` database)
- `users` - User accounts and metadata
- `image-data` - Image metadata with Glicko-2 ratings
- `battles` - Battle history between images
- `leaderboards` - Cached leaderboard data
- `leaderboards_meta` - Leaderboard generation metadata
- `reports` - Content moderation reports

### Critical Indexes
The application requires 15 composite indexes defined in `firestore.indexes.json`:
- Image selection queries (by gender, pool status, random seed)
- Leaderboard queries (by rating, gender)
- Battle history queries (by participant, timestamp)
- Report queries (by status, category)

Deploy indexes with: `npm run deploy:indexes`

## Environment Variables

Required in `.env`:
```
PORT=3000
NODE_ENV=development
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
JWT_SECRET=<secure-secret>
GCP_PROJECT_ID=hotlympics
FIRESTORE_DATABASE_ID=hotlympics
FIREBASE_STORAGE_BUCKET=hotlympics.appspot.com
FIREBASE_SERVICE_ACCOUNT=./hotlympics-service-account.json
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<secure-password>
SCHEDULER_API_KEY=<64-char-hex-key>
```

## Testing

Test scripts in `tests/` directory:
```bash
node tests/test-database-connection.js    # Database connectivity
node tests/test-leaderboard-system.js     # Leaderboard generation (requires build)
node tests/test-firestore-status.js       # Index validation
```

## Important Notes

1. **Database Selection**: Always use `getFirestore(app, 'hotlympics')` - the project has two databases and data is in the `hotlympics` database, not `(default)`

2. **Glicko-2 System**: Images use Glicko-2 ratings with on-demand migration from Elo. System tracks `rating`, `rd`, `volatility`, `mu`, and `phi` values.

3. **Image Pairs Algorithm**: Uses arena-based selection with random seeds to ensure variety while maintaining gender preferences.

4. **Leaderboard Caching**: Leaderboards are pre-generated and cached in Firestore. Regeneration tracks version numbers for invalidation.

5. **Service Account**: Local development requires `hotlympics-service-account.json` file with proper Firestore permissions.