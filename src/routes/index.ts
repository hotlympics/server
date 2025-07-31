import { Router } from 'express';
import healthRouter from './health.js';
import authRouter from './auth.js';
import imagesRouter from './images.js';
import userRouter from './user.js';

const router = Router();

router.use('/health', healthRouter);
router.use('/auth', authRouter);
router.use('/images', imagesRouter);
router.use('/user', userRouter);

export default router;
