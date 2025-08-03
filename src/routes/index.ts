import { Router } from 'express';
import healthRouter from './health.js';
import firebaseAuthRouter from './firebase-auth.js';
import imagesRouter from './images.js';
import userRouter from './user.js';
import ratingsRouter from './ratings.js';
import adminRouter from './admin.js';

const router = Router();

router.use('/health', healthRouter);
router.use('/auth', firebaseAuthRouter);
router.use('/images', imagesRouter);
router.use('/user', userRouter);
router.use('/ratings', ratingsRouter);
router.use('/admin', adminRouter);

export default router;
