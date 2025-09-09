import { Timestamp } from '@google-cloud/firestore';
import { db, COLLECTIONS } from '../config/firestore.js';
import { logger } from '../utils/logger.js';
import type { Report, ReportCategory, ReportStatus } from '../models/report.js';
import type { ImageData } from '../models/image-data.js';

// API response type with string dates
export interface ReportResponse {
    reportID: string;
    imageId: string;
    userId: string;
    category: ReportCategory;
    description?: string;
    status: ReportStatus;
    createdAt: string; // ISO string
    reviewedAt?: string; // ISO string
    reviewedBy?: string;
    adminNotes?: string;
}

export class ReportService {
    private readonly reportsCollection = db.collection(COLLECTIONS.REPORTS);
    private readonly imagesCollection = db.collection(COLLECTIONS.IMAGE_DATA);

    /**
     * Submit a new report for an image
     */
    async submitReport(
        imageId: string,
        userId: string,
        category: ReportCategory,
        description?: string,
    ): Promise<string> {
        logger.info(`Submitting report for image ${imageId} by user ${userId}`, {
            category,
            hasDescription: !!description,
        });

        // Validate that description is provided for OTHER category
        if (category === 'OTHER' && !description?.trim()) {
            throw new Error('Description is required for OTHER category reports');
        }

        // Check if image exists
        const imageDoc = await this.imagesCollection.doc(imageId).get();
        if (!imageDoc.exists) {
            throw new Error('Image not found');
        }

        // Check for duplicate reports from the same authenticated user
        // Anonymous users can submit multiple reports
        if (userId !== 'anonymous') {
            const existingReports = await this.reportsCollection
                .where('imageId', '==', imageId)
                .where('userId', '==', userId)
                .limit(1)
                .get();

            if (!existingReports.empty) {
                throw new Error('You have already reported this image');
            }
        }

        // Create the report
        const reportRef = this.reportsCollection.doc();
        const report: Report = {
            reportID: reportRef.id,
            imageId,
            userId,
            category,
            status: 'PENDING',
            createdAt: Timestamp.now(),
        };

        // Only include description if it's provided and not empty
        if (description && description.trim()) {
            report.description = description.trim();
        }

        // Use a transaction to both create the report and update the image's report count
        await db.runTransaction(async (transaction) => {
            // First, do all reads
            const imageRef = this.imagesCollection.doc(imageId);
            const imageSnapshot = await transaction.get(imageRef);

            // Then, do all writes
            // Create the report
            transaction.set(reportRef, report);

            // Update the image's report count
            if (imageSnapshot.exists) {
                const imageData = imageSnapshot.data() as ImageData;
                const currentReportCount = imageData.reportCount || 0;

                transaction.update(imageRef, {
                    reportCount: currentReportCount + 1,
                });
            }
        });

        logger.info(`Report submitted successfully with ID ${reportRef.id}`);
        return reportRef.id;
    }

    /**
     * Get reports for admin review with cursor-based pagination
     */
    async getReports(
        status?: ReportStatus,
        limit: number = 10,
        startAfter?: string,
        endBefore?: string,
    ): Promise<{
        reports: ReportResponse[];
        nextCursor: string | null;
        prevCursor: string | null;
        hasMore: boolean;
        hasPrevious: boolean;
    }> {
        const safeLimit = Math.min(limit, 50); // Cap at 50 items per page

        let query = this.reportsCollection.orderBy('createdAt', 'desc');

        if (status) {
            query = query.where('status', '==', status);
        }

        // Apply cursor pagination
        if (startAfter) {
            query = query.startAfter(startAfter);
        } else if (endBefore) {
            query = query.endBefore(endBefore).limitToLast(safeLimit);
        }

        if (!endBefore) {
            query = query.limit(safeLimit);
        }

        const snapshot = await query.get();

        const reports = snapshot.docs.map((doc) => {
            const data = doc.data() as Report;
            return {
                ...data,
                createdAt: data.createdAt.toDate().toISOString(),
                reviewedAt: data.reviewedAt ? data.reviewedAt.toDate().toISOString() : undefined,
            };
        });

        let hasMoreForward = false;
        let hasPrevious = false;
        let nextCursor: string | null = null;
        let prevCursor: string | null = null;

        if (reports.length > 0) {
            // Test for more results forward
            let testForwardQuery = this.reportsCollection.orderBy('createdAt', 'desc');
            if (status) {
                testForwardQuery = testForwardQuery.where('status', '==', status);
            }
            testForwardQuery = testForwardQuery
                .startAfter(snapshot.docs[snapshot.docs.length - 1])
                .limit(1);

            const testForwardSnapshot = await testForwardQuery.get();
            hasMoreForward = !testForwardSnapshot.empty;

            // Set cursors
            nextCursor = hasMoreForward ? reports[reports.length - 1].reportID : null;
            prevCursor = reports[0].reportID;

            // Test for previous results
            if (startAfter) {
                hasPrevious = true;
            } else if (endBefore) {
                let testBackwardQuery = this.reportsCollection.orderBy('createdAt', 'desc');
                if (status) {
                    testBackwardQuery = testBackwardQuery.where('status', '==', status);
                }
                testBackwardQuery = testBackwardQuery.endBefore(snapshot.docs[0]).limit(1);

                const testBackwardSnapshot = await testBackwardQuery.get();
                hasPrevious = !testBackwardSnapshot.empty;
            } else {
                hasPrevious = false;
            }
        }

        return {
            reports,
            nextCursor,
            prevCursor,
            hasMore: hasMoreForward,
            hasPrevious,
        };
    }

    /**
     * Update report status (admin only)
     */
    async updateReportStatus(
        reportId: string,
        status: ReportStatus,
        adminUserId: string,
        adminNotes?: string,
    ): Promise<void> {
        logger.info(`Updating report ${reportId} status to ${status}`, {
            adminUserId,
            hasNotes: !!adminNotes,
        });

        const reportRef = this.reportsCollection.doc(reportId);
        const reportDoc = await reportRef.get();

        if (!reportDoc.exists) {
            throw new Error('Report not found');
        }

        const report = reportDoc.data() as Report;

        // Use a transaction to safely update all reports for the same imageId
        await db.runTransaction(async (transaction) => {
            // Re-read the specific report within transaction to ensure it hasn't changed
            const currentReportDoc = await transaction.get(reportRef);
            if (!currentReportDoc.exists) {
                throw new Error('Report not found in transaction');
            }

            // Get all reports for this imageId within the transaction
            const reportsQuery = this.reportsCollection.where('imageId', '==', report.imageId);
            const reportsSnapshot = await transaction.get(reportsQuery);

            if (reportsSnapshot.docs.length > 500) {
                throw new Error(
                    `Too many reports for imageId ${report.imageId} (${reportsSnapshot.docs.length}). Transaction limit is 500.`,
                );
            }

            const updateData: Partial<Report> = {
                status,
                reviewedAt: Timestamp.now(),
                reviewedBy: adminUserId,
            };

            if (adminNotes?.trim()) {
                updateData.adminNotes = adminNotes.trim();
            }

            // Update all reports for this imageId atomically
            reportsSnapshot.docs.forEach((doc) => {
                transaction.update(doc.ref, updateData);
            });

            logger.info(
                `Scheduled update of ${reportsSnapshot.docs.length} reports for imageId ${report.imageId} to status ${status}`,
            );
        });

        // If approving the report, handle image deletion AFTER successful transaction
        if (status === 'APPROVED') {
            await this.handleApprovedReport(report);
        }

        logger.info(
            `Successfully updated all reports for image ${report.imageId} to status ${status}`,
        );
    }

    /**
     * Handle actions when a report is approved
     */
    private async handleApprovedReport(report: Report): Promise<void> {
        const imageId = report.imageId;
        logger.info(
            `Taking action on approved report for image ${imageId} - deleting image completely`,
        );

        try {
            // 1. Get image data first to find the userId and imageUrl (same approach as users tab)
            const imageDoc = await this.imagesCollection.doc(imageId).get();

            if (!imageDoc.exists) {
                logger.warn(`Image ${imageId} not found when processing approved report`);
                return;
            }

            const imageData = imageDoc.data() as ImageData;
            const userId = imageData.userId;
            const imageUrl = imageData.imageUrl;

            // 2. Delete image from Google Cloud Storage
            try {
                const { storageService } = await import('./storage-service.js');
                await storageService.deleteImage(imageUrl);
                logger.info(`Deleted image from storage: ${imageUrl}`);
            } catch (storageError) {
                logger.warn(`Failed to delete image ${imageUrl}:`, storageError);
                // Continue with deletion even if storage deletion fails
            }

            // 3. Delete image-data document from Firestore
            await this.imagesCollection.doc(imageId).delete();
            logger.info(`Deleted image-data document: ${imageId}`);

            // 4. Remove imageId from user's uploadedImageIds and poolImageIds arrays
            const userDoc = await db.collection(COLLECTIONS.USERS).doc(userId).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                const updatedUploadedImageIds = (
                    (userData?.uploadedImageIds as string[]) || []
                ).filter((id: string) => id !== imageId);
                const updatedPoolImageIds = ((userData?.poolImageIds as string[]) || []).filter(
                    (id: string) => id !== imageId,
                );

                await db.collection(COLLECTIONS.USERS).doc(userId).update({
                    uploadedImageIds: updatedUploadedImageIds,
                    poolImageIds: updatedPoolImageIds,
                });
                logger.info(`Removed image ${imageId} from user ${userId} arrays`);
            }

            logger.info(`Successfully deleted image ${imageId} completely due to approved report`);
        } catch (error) {
            logger.error(`Failed to handle approved report for image ${imageId}:`, error);
            // Don't throw - we still want the report status to update even if image action fails
        }
    }

    /**
     * Get reports for a specific image
     */
    async getReportsForImage(imageId: string): Promise<ReportResponse[]> {
        const snapshot = await this.reportsCollection
            .where('imageId', '==', imageId)
            .orderBy('createdAt', 'desc')
            .get();

        return snapshot.docs.map((doc) => {
            const data = doc.data() as Report;
            return {
                ...data,
                createdAt: data.createdAt.toDate().toISOString(),
                reviewedAt: data.reviewedAt ? data.reviewedAt.toDate().toISOString() : undefined,
            };
        });
    }

    /**
     * Get report by ID
     */
    async getReportById(reportId: string): Promise<ReportResponse | null> {
        const doc = await this.reportsCollection.doc(reportId).get();
        if (!doc.exists) return null;

        const data = doc.data() as Report;
        return {
            ...data,
            createdAt: data.createdAt.toDate().toISOString(),
            reviewedAt: data.reviewedAt ? data.reviewedAt.toDate().toISOString() : undefined,
        };
    }
}

export const reportService = new ReportService();
