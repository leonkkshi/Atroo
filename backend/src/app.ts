import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';


// Load variables from .env file
dotenv.config();

import authRoutes from './routes/authRoutes';
import taxRoutes from './routes/taxRoutes';
import invoiceRoutes from './routes/invoiceRoutes';
import chatRoutes from './routes/chatRoutes';
import calendarRoutes from './routes/calendarRoutes';
import posRoutes from './routes/posRoutes';
import { errorHandler } from './middlewares/error';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

// Cấu hình CORS mở hoàn toàn cho mobile app dễ kết nối
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// Endpoint Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'A Trợ Backend API Server',
    time: new Date().toISOString()
  });
});

// Đăng ký các Route Modules
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/tax', taxRoutes);
app.use('/api/v1/invoices', invoiceRoutes);
app.use('/api/v1/ai', chatRoutes);
app.use('/api/v1/calendar', calendarRoutes);
app.use('/api/v1/pos', posRoutes);

// Bắt lỗi toàn hệ thống
app.use(errorHandler);

// Lắng nghe trên 0.0.0.0 là cực kỳ quan trọng cho các ứng dụng di động
// Giúp thiết bị thật (qua Wi-Fi cục bộ) hoặc máy ảo Android/iOS kết nối trực tiếp được
app.listen(PORT, '0.0.0.0', () => {
  console.log('========================================================');
  console.log(`🚀 A Trợ Backend API Server đang chạy tại:`);
  console.log(`   - Local:            http://localhost:${PORT}`);
  console.log(`   - Môi trường Mobile: http://0.0.0.0:${PORT}`);
  console.log(`   - Dành cho Android Emulator: kết nối tới IP máy của bạn`);
  console.log('========================================================');
});

export default app;
