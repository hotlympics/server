# Hotlympics Server

## Project Overview

Hotlympics server is the backend API for a face rating application that:

- Manages image pairs for rating comparisons
- Calculates and maintains Elo ratings for uploaded images
- Handles user authentication and session management
- Stores and serves user-uploaded images
- Provides endpoints for rating submissions and leaderboard data

## Technical Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Build Tool**: Vite (for development)
- **Package Manager**: npm
- **Database**: Google Cloud SQL (PostgreSQL) for user accounts and image metadata
- **File Storage**: Google Cloud Storage for image files
- **Statistics Store**: Google Cloud Firestore for aggregated statistics

## Code Style Guidelines

- **Indentation**: 4 spaces everywhere
- **Blank Lines**: No indentation on blank lines
- **Code Quality**: Clean, readable, and modular
- **Comments**: Conservative use only when necessary
- **TypeScript**: Use strict mode and proper typing
- **File Naming**: Use kebab-case for all file names (e.g., `auth-service.ts`, not `AuthService.ts`)

## Development Commands

```bash
npm run dev        # Start development server with hot reload
npm run build      # Build TypeScript to JavaScript
npm run start      # Run production server
npm run lint       # Run ESLint
npm run lint:fix   # Fix linting issues
npm run format     # Format code with Prettier
npm run typecheck  # Run TypeScript type checking
```

## Development Workflow

After making code changes (not for every minor change, but after completing a set of related changes), run:

```bash
npm i && npm run build && npm run lint
```

Fix any build, type, or linting errors before considering the changes complete.

## Elo Rating System

The server implements the Elo rating algorithm:
- Default starting rating: 1500
- K-factor: 32 (adjustable based on rating count)
- Expected score calculation
- Rating updates after each comparison

## Error Handling

Consistent error response format:
```json
{
  "error": {
    "message": "Error description",
    "status": 400
  }
}
```
