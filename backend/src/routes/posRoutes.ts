import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authMiddleware } from '../middlewares/auth';
import { getItems, createItem, updateItem, deleteItem, createInvoice, getInvoices, getExpenses, createExpense, deleteExpense } from '../controllers/posController';

const router = Router();

const uploadDir = path.join(__dirname, '../../uploads');

if (!fs.existsSync(uploadDir)) {
	fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		cb(null, uploadDir);
	},
	filename: (req, file, cb) => {
		const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
		cb(null, 'item-' + uniqueSuffix + path.extname(file.originalname));
	},
});

const upload = multer({
	storage,
	fileFilter: (req, file, cb) => {
		const filetypes = /jpeg|jpg|png|webp|svg/;
		const mimetype = filetypes.test(file.mimetype);
		const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

		if (mimetype && extname) {
			return cb(null, true);
		}

		cb(new Error('Chỉ chấp nhận upload các định dạng ảnh: JPEG, JPG, PNG, WEBP, SVG.'));
	},
	limits: { fileSize: 10 * 1024 * 1024 },
});

// Tất cả route POS đều yêu cầu đăng nhập
router.use(authMiddleware);

// Danh mục sản phẩm
router.get('/items', getItems);
router.post('/items', upload.single('image'), createItem);
router.put('/items/:id', upload.single('image'), updateItem);
router.delete('/items/:id', deleteItem);

// Hóa đơn bán hàng
router.post('/invoices', createInvoice);
router.get('/invoices', getInvoices);

// Chi phí phát sinh
router.get('/expenses', getExpenses);
router.post('/expenses', createExpense);
router.delete('/expenses/:id', deleteExpense);

export default router;
