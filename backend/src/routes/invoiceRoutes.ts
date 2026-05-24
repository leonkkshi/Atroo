import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { analyzeInvoice, getInvoices } from '../controllers/invoiceController';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

// Đảm bảo thư mục uploads tồn tại
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Cấu hình lưu trữ cho Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'invoice-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Chỉ chấp nhận upload các định dạng ảnh: JPEG, JPG, PNG, WEBP.'));
  },
  limits: { fileSize: 10 * 1024 * 1024 } // Giới hạn 10MB
});

router.use(authMiddleware);

// Route xử lý upload và phân tích hóa đơn
router.post('/upload', upload.single('invoice'), analyzeInvoice);

// Route lấy lịch sử hóa đơn đã quét
router.get('/', getInvoices);

export default router;
