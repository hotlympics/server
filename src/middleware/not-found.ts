import { Request, Response } from 'express';

const notFoundHandler = (req: Request, res: Response): void => {
    res.status(404).json({
        error: {
            message: 'Not Found',
            status: 404,
            path: req.path,
        },
    });
};

export default notFoundHandler;
