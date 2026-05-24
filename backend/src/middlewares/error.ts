import { Request, Response, NextFunction } from 'express';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[Error Handler]:', err.stack || err);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.';

  res.status(statusCode).json({
    error: message,
    // Chỉ hiển thị stack trace ở môi trường phát triển nếu cần, ẩn đi ở production
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
};
