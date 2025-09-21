import { Router } from 'express';
import healthRouter from './health.js';
import firebaseAuthRouter from './firebase-auth.js';
import imagesRouter from './images.js';
import userRouter from './user.js';
import ratingsRouter from './ratings.js';
import adminRouter from './admin.js';
import reportsRouter from './reports.js';
import leaderboardsRouter from './leaderboards.js';
import schedulerRouter from './scheduler.js';

const router = Router();

router.use('/health', healthRouter);
router.use('/auth', firebaseAuthRouter);
router.use('/images', imagesRouter);
router.use('/user', userRouter);
router.use('/ratings', ratingsRouter);
router.use('/reports', reportsRouter);
router.use('/admin', adminRouter);
router.use('/leaderboards', leaderboardsRouter);
router.use('/scheduler', schedulerRouter);

export default router;
