"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const errorHandler = (err, req, res, next) => {
    console.error('[Error Handler]:', err.stack || err);
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.';
    res.status(statusCode).json({
        error: message,
        // Chỉ hiển thị stack trace ở môi trường phát triển nếu cần, ẩn đi ở production
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
};
exports.errorHandler = errorHandler;
