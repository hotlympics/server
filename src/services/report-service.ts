import { Timestamp } from '@google-cloud/firestore';
import { db, COLLECTIONS } from '../config/firestore.js';
import { logger } from '../utils/logger.js';
import type { Report, ReportCategory, ReportStatus } from '../models/report.js';
import type { ImageData } from '../models/image-data.js';

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
     * Get reports for admin review
     */
    async getReports(
        status?: ReportStatus,
        limit: number = 50,
        offset: number = 0,
    ): Promise<Report[]> {
        let query = this.reportsCollection.orderBy('createdAt', 'desc');

        if (status) {
            query = query.where('status', '==', status);
        }

        const snapshot = await query.offset(offset).limit(limit).get();

        return snapshot.docs.map((doc) => doc.data() as Report);
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

        const updateData: Partial<Report> = {
            status,
            reviewedAt: Timestamp.now(),
            reviewedBy: adminUserId,
        };

        if (adminNotes?.trim()) {
            updateData.adminNotes = adminNotes.trim();
        }

        await reportRef.update(updateData);
        logger.info(`Report ${reportId} status updated successfully`);
    }

    /**
     * Get reports for a specific image
     */
    async getReportsForImage(imageId: string): Promise<Report[]> {
        const snapshot = await this.reportsCollection
            .where('imageId', '==', imageId)
            .orderBy('createdAt', 'desc')
            .get();

        return snapshot.docs.map((doc) => doc.data() as Report);
    }

    /**
     * Get report by ID
     */
    async getReportById(reportId: string): Promise<Report | null> {
        const doc = await this.reportsCollection.doc(reportId).get();
        return doc.exists ? (doc.data() as Report) : null;
    }
}

export const reportService = new ReportService();
