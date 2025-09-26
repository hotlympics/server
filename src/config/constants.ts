// Central configuration for all application constants
// Organized by category for easy maintenance and discovery

// ===========================
// HTTP Status Codes
// ===========================
export const HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    INTERNAL_SERVER_ERROR: 500,
} as const;

// ===========================
// User Constraints
// ===========================
export const USER_LIMITS = {
    MAX_IMAGES_PER_USER: 10,
    MIN_AGE_YEARS: 18,
    MIN_RATE_COUNT_TO_UPLOAD: 10, // Users must rate at least this many pairs before uploading
} as const;

// ===========================
// File Upload Configuration
// ===========================
export const UPLOAD_CONFIG = {
    MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024, // 10MB
    MAX_FILES_PER_REQUEST: 10,
    ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
    DEFAULT_FILE_EXTENSION: 'jpg',
} as const;

// ===========================
// Storage Configuration
// ===========================
export const STORAGE_CONFIG = {
    CACHE_CONTROL: 'public, max-age=31536000', // 1 year
    SIGNED_URL_EXPIRY_MS: 60 * 60 * 1000, // 1 hour
    UPLOAD_URL_EXPIRY_MS: 15 * 60 * 1000, // 15 minutes
} as const;

// ===========================
// Pagination and Limits
// ===========================
export const PAGINATION = {
    DEFAULT_LIMIT: 10,
    MAX_LIMIT: 50,
    ADMIN_DEFAULT_LIMIT: 10,
    ADMIN_MAX_LIMIT: 50,
    BATTLES_DEFAULT_LIMIT: 50,
    BATTLES_MAX_LIMIT: 100,
    REPORTS_DEFAULT_LIMIT: 10,
    REPORTS_MAX_LIMIT: 50,
    IMAGE_BLOCK_MAX: 100,
} as const;

// ===========================
// Cache Configuration
// ===========================
export const CACHE_CONFIG = {
    IMAGE_CACHE_REFRESH_INTERVAL_MS: 3600000, // 1 hour
    IMAGE_CACHE_MAX_SIZE: 100000, // Maximum number of images to cache
    IMAGE_CACHE_BATCH_SIZE: 500, // Batch size for loading images into cache
    IMAGE_CACHE_LOG_INTERVAL: 25000, // Log progress every N images
} as const;

// ===========================
// Firestore Constraints
// ===========================
export const FIRESTORE_LIMITS = {
    MAX_IN_OPERATOR: 10, // Firestore 'in' operator limit
    MAX_NOT_IN_OPERATOR: 10, // Firestore 'not-in' operator limit
    BATCH_CHUNK_SIZE: 10, // Chunk size for batch operations
} as const;

// ===========================
// Image Selection Algorithm
// ===========================
export const IMAGE_SELECTION = {
    MAX_IMAGES_PER_REQUEST: 10, // Maximum images that can be requested at once
    MAX_SELECTION_ATTEMPTS: 10, // Maximum attempts to find unique images
} as const;

// ===========================
// Authentication
// ===========================
export const AUTH_CONFIG = {
    JWT_EXPIRY: '24h',
    ADMIN_ID: 'admin', // Default admin user ID for system operations
} as const;

// ===========================
// Report System
// ===========================
export const REPORT_CONFIG = {
    VALID_STATUSES: ['PENDING', 'APPROVED', 'REJECTED'] as const,
} as const;

// ===========================
// Email Validation
// ===========================
export const VALIDATION = {
    EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
} as const;

// Type exports for strong typing
export type HttpStatus = (typeof HTTP_STATUS)[keyof typeof HTTP_STATUS];
export type ReportStatus = (typeof REPORT_CONFIG.VALID_STATUSES)[number];
