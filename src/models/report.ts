import { Timestamp } from '@google-cloud/firestore';

export type ReportCategory =
    | 'NOT_PERSON'
    | 'IMPERSONATION'
    | 'NUDITY'
    | 'VIOLENCE'
    | 'SPAM'
    | 'INAPPROPRIATE'
    | 'OTHER';

export type ReportStatus = 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'DUPLICATE';

export interface Report {
    reportID: string;
    imageId: string;
    userId: string; // User who submitted the report
    category: ReportCategory;
    description?: string; // Required for OTHER category
    status: ReportStatus;
    createdAt: Timestamp;
    reviewedAt?: Timestamp;
    reviewedBy?: string; // Admin user ID who reviewed
    adminNotes?: string; // Admin notes during review
}
