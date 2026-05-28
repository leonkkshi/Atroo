import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middlewares/auth';
import {
  getItems, createItem, updateItem, deleteItem,
  createInvoice, getInvoices,
  getExpenses, createExpense, deleteExpense,
} from '../controllers/posController';

const router = Router();

// ── Multer: lưu vào RAM (buffer), không lưu xuống disk ──────────────────────
// Railway (và mọi cloud platform) dùng ephemeral filesystem → lưu disk sẽ mất khi restart.
// Buffer được truyền thẳng lên Cloudinary trong controller.
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|svg/;
    const okMime = allowed.test(file.mimetype);
    const okExt  = allowed.test(file.originalname.split('.').pop()?.toLowerCase() ?? '');
    if (okMime && okExt) return cb(null, true);
    cb(new Error('Chỉ chấp nhận ảnh: JPEG, JPG, PNG, WEBP, SVG.'));
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

// Tất cả route POS đều yêu cầu đăng nhập
router.use(authMiddleware);

// Danh mục sản phẩm
router.get('/items',      getItems);
router.post('/items',     upload.single('image'), createItem);
router.put('/items/:id',  upload.single('image'), updateItem);
router.delete('/items/:id', deleteItem);

// Hóa đơn bán hàng
router.post('/invoices', createInvoice);
router.get('/invoices',  getInvoices);

// Chi phí phát sinh
router.get('/expenses',       getExpenses);
router.post('/expenses',      createExpense);
router.delete('/expenses/:id', deleteExpense);

export default router;
