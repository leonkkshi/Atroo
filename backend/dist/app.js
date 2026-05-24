"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
// Load variables from .env file
dotenv_1.default.config();
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const taxRoutes_1 = __importDefault(require("./routes/taxRoutes"));
const invoiceRoutes_1 = __importDefault(require("./routes/invoiceRoutes"));
const chatRoutes_1 = __importDefault(require("./routes/chatRoutes"));
const calendarRoutes_1 = __importDefault(require("./routes/calendarRoutes"));
const posRoutes_1 = __importDefault(require("./routes/posRoutes"));
const error_1 = require("./middlewares/error");
const app = (0, express_1.default)();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
// Cấu hình CORS mở hoàn toàn cho mobile app dễ kết nối
app.use((0, cors_1.default)({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Serve tĩnh thư mục uploads để các thiết bị mobile có thể xem ảnh hóa đơn
const uploadsPath = path_1.default.join(__dirname, '../uploads');
app.use('/uploads', express_1.default.static(uploadsPath));
// Endpoint Health Check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'A Trợ Backend API Server',
        time: new Date().toISOString()
    });
});
// Đăng ký các Route Modules
app.use('/api/v1/auth', authRoutes_1.default);
app.use('/api/v1/tax', taxRoutes_1.default);
app.use('/api/v1/invoices', invoiceRoutes_1.default);
app.use('/api/v1/ai', chatRoutes_1.default);
app.use('/api/v1/calendar', calendarRoutes_1.default);
app.use('/api/v1/pos', posRoutes_1.default);
// Bắt lỗi toàn hệ thống
app.use(error_1.errorHandler);
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
exports.default = app;
