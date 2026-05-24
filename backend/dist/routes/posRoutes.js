"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const auth_1 = require("../middlewares/auth");
const posController_1 = require("../controllers/posController");
const router = (0, express_1.Router)();
const uploadDir = path_1.default.join(__dirname, '../../uploads');
if (!fs_1.default.existsSync(uploadDir)) {
    fs_1.default.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, 'item-' + uniqueSuffix + path_1.default.extname(file.originalname));
    },
});
const upload = (0, multer_1.default)({
    storage,
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|webp/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path_1.default.extname(file.originalname).toLowerCase());
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Chỉ chấp nhận upload các định dạng ảnh: JPEG, JPG, PNG, WEBP.'));
    },
    limits: { fileSize: 10 * 1024 * 1024 },
});
// Tất cả route POS đều yêu cầu đăng nhập
router.use(auth_1.authMiddleware);
// Danh mục sản phẩm
router.get('/items', posController_1.getItems);
router.post('/items', upload.single('image'), posController_1.createItem);
// Hóa đơn bán hàng
router.post('/invoices', posController_1.createInvoice);
router.get('/invoices', posController_1.getInvoices);
exports.default = router;
