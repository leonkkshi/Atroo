"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const invoiceController_1 = require("../controllers/invoiceController");
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
// Đảm bảo thư mục uploads tồn tại
const uploadDir = path_1.default.join(__dirname, '../../uploads');
if (!fs_1.default.existsSync(uploadDir)) {
    fs_1.default.mkdirSync(uploadDir, { recursive: true });
}
// Cấu hình lưu trữ cho Multer
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, 'invoice-' + uniqueSuffix + path_1.default.extname(file.originalname));
    }
});
const upload = (0, multer_1.default)({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|webp/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path_1.default.extname(file.originalname).toLowerCase());
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Chỉ chấp nhận upload các định dạng ảnh: JPEG, JPG, PNG, WEBP.'));
    },
    limits: { fileSize: 10 * 1024 * 1024 } // Giới hạn 10MB
});
router.use(auth_1.authMiddleware);
// Route xử lý upload và phân tích hóa đơn
router.post('/upload', upload.single('invoice'), invoiceController_1.analyzeInvoice);
// Route lấy lịch sử hóa đơn đã quét
router.get('/', invoiceController_1.getInvoices);
exports.default = router;
