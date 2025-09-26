import dotenv from 'dotenv';
dotenv.config();

import createApp from './app.js';
import { logger } from './utils/logger.js';
import { ImageCacheService } from './services/image-cache-service.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

const validateEnvironment = (): void => {
    logger.info('Environment variables validated');
};

const startServer = async (): Promise<void> => {
    try {
        validateEnvironment();

        const imageCacheService = ImageCacheService.getInstance();
        await imageCacheService.initialize();
        logger.info('ImageCacheService initialized successfully');

        const app = createApp();

        const server = app.listen(PORT, '0.0.0.0', () => {
            logger.log('=================================');
            logger.log('Server Starting...');
            logger.log('=================================');
            logger.log('Environment Variables:');
            logger.log(`NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
            logger.log(`PORT: ${PORT}`);
            logger.log('=================================');
            logger.log(`Server running on port ${PORT}`);
            logger.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
            logger.log(`Health check: http://0.0.0.0:${PORT}/health`);
            logger.log(`Started at: ${new Date().toISOString()}`);
        });

        const gracefulShutdown = (signal: string) => {
            logger.info(`Received ${signal}. Starting graceful shutdown...`);

            imageCacheService.stop();

            server.close(() => {
                logger.info('HTTP server closed');
                logger.info('Server stopped gracefully');
                process.exit(0);
            });

            setTimeout(() => {
                logger.error('Forceful shutdown after 10s timeout.');
                process.exit(1);
            }, 10000);
        };

        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));

        process.on('uncaughtException', (error) => {
            logger.error('Uncaught exception:', error);
            gracefulShutdown('uncaughtException');
        });

        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Unhandled promise rejection:', reason, promise);
            gracefulShutdown('unhandledRejection');
        });
    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
};

void startServer();
