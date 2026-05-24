"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInvoices = exports.createInvoice = exports.createItem = exports.getItems = void 0;
const prisma_1 = __importDefault(require("../utils/prisma"));
const DEFAULT_ITEM_IMAGE = '/uploads/pos-placeholder.svg';
const DEFAULT_IMAGE_BY_TYPE = {
    FOOD: '/uploads/pos-food.svg',
    PRODUCT: '/uploads/pos-product.svg',
    SERVICE: '/uploads/pos-service.svg',
};
// ─── Danh sách sản phẩm mặc định ─────────────────────────────────────────────
// Bao gồm 3 loại hình: Quán ăn nhỏ · Tiệm cắt tóc · Tiệm sửa xe
const DEFAULT_ITEMS = [
    // ── 🍜 Quán ăn nhỏ ──────────────────────────────────────────────────────────
    { id: 'food_01', name: 'Cơm đĩa bình dân', price: 30000, type: 'FOOD' },
    { id: 'food_02', name: 'Cơm sườn trứng', price: 40000, type: 'FOOD' },
    { id: 'food_03', name: 'Bát phở bò tái', price: 45000, type: 'FOOD' },
    { id: 'food_04', name: 'Bún bò Huế', price: 40000, type: 'FOOD' },
    { id: 'food_05', name: 'Hũ tiếu Nam Vang', price: 40000, type: 'FOOD' },
    { id: 'food_06', name: 'Bún riêu cua', price: 35000, type: 'FOOD' },
    { id: 'food_07', name: 'Cơm tấm ba rọi', price: 45000, type: 'FOOD' },
    { id: 'drk_01', name: 'Trà đá', price: 5000, type: 'PRODUCT' },
    { id: 'drk_02', name: 'Nước ngọt lon', price: 12000, type: 'PRODUCT' },
    { id: 'drk_03', name: 'Cà phê đá', price: 20000, type: 'PRODUCT' },
    { id: 'drk_04', name: 'Nước suối', price: 8000, type: 'PRODUCT' },
    // ── ✂️ Tiệm cắt tóc ─────────────────────────────────────────────────────────
    { id: 'hair_01', name: 'Cắt tóc nam basic', price: 50000, type: 'SERVICE' },
    { id: 'hair_02', name: 'Cắt tóc nam cao cấp', price: 80000, type: 'SERVICE' },
    { id: 'hair_03', name: 'Cắt tóc nữ ngắn', price: 80000, type: 'SERVICE' },
    { id: 'hair_04', name: 'Cắt tóc nữ dài', price: 120000, type: 'SERVICE' },
    { id: 'hair_05', name: 'Gội đầu dưỡng tóc', price: 50000, type: 'SERVICE' },
    { id: 'hair_06', name: 'Nhuộm tóc (basic)', price: 250000, type: 'SERVICE' },
    { id: 'hair_07', name: 'Uốn tóc', price: 350000, type: 'SERVICE' },
    { id: 'hair_08', name: 'Nối tóc', price: 500000, type: 'SERVICE' },
    { id: 'hair_09', name: 'Cắt + gội + sấy', price: 100000, type: 'SERVICE' },
    // ── 🔧 Tiệm sửa xe ──────────────────────────────────────────────────────────
    { id: 'bike_01', name: 'Vá xăm xe máy', price: 20000, type: 'SERVICE' },
    { id: 'bike_02', name: 'Vá xe không ruột', price: 40000, type: 'SERVICE' },
    { id: 'bike_03', name: 'Thay dầu xe máy', price: 80000, type: 'SERVICE' },
    { id: 'bike_04', name: 'Thay lốp xe (1 bánh)', price: 150000, type: 'SERVICE' },
    { id: 'bike_05', name: 'Rửa xe máy', price: 30000, type: 'SERVICE' },
    { id: 'bike_06', name: 'Sửa điện xe máy', price: 100000, type: 'SERVICE' },
    { id: 'bike_07', name: 'Thay nhớt + lọc', price: 120000, type: 'SERVICE' },
    { id: 'bike_08', name: 'Sạc bình ắc quy', price: 30000, type: 'SERVICE' },
    { id: 'bike_09', name: 'Dầu nhớt Honda', price: 55000, type: 'PRODUCT' },
    { id: 'bike_10', name: 'Lốp xe Michelin', price: 320000, type: 'PRODUCT' },
].map((item) => ({
    ...item,
    imageUrl: DEFAULT_IMAGE_BY_TYPE[item.type] ?? DEFAULT_ITEM_IMAGE,
}));
// ─── GET /pos/items ───────────────────────────────────────────────────────────
// Trả về toàn bộ danh mục sản phẩm. Auto-seed nếu bảng còn trống.
const getItems = async (req, res) => {
    try {
        let items = await prisma_1.default.posItem.findMany({
            orderBy: { createdAt: 'asc' },
        });
        if (items.length === 0) {
            // Seed sản phẩm mặc định cho lần đầu
            await prisma_1.default.posItem.createMany({ data: DEFAULT_ITEMS });
            items = await prisma_1.default.posItem.findMany({ orderBy: { createdAt: 'asc' } });
        }
        res.json({ items });
    }
    catch (err) {
        console.error('[POS] getItems error:', err);
        res.status(500).json({ error: 'Không thể tải danh sách sản phẩm.' });
    }
};
exports.getItems = getItems;
// ─── POST /pos/items ──────────────────────────────────────────────────────────
// Thêm sản phẩm / dịch vụ mới vào danh mục
const createItem = async (req, res) => {
    try {
        const uploadReq = req;
        const { id, name, price, type } = req.body;
        const normalizedName = typeof name === 'string' ? name.trim() : '';
        const normalizedType = typeof type === 'string' ? type.trim().toUpperCase() : '';
        const normalizedPrice = Number(price);
        if (!normalizedName || !normalizedType || !Number.isFinite(normalizedPrice) || normalizedPrice <= 0) {
            res.status(400).json({ error: 'Thiếu thông tin sản phẩm hợp lệ (name, price, type).' });
            return;
        }
        if (!['FOOD', 'PRODUCT', 'SERVICE'].includes(normalizedType)) {
            res.status(400).json({ error: 'Loại sản phẩm không hợp lệ.' });
            return;
        }
        if (!uploadReq.file) {
            res.status(400).json({ error: 'Vui lòng chọn hình ảnh sản phẩm.' });
            return;
        }
        const item = await prisma_1.default.posItem.create({
            data: {
                id: id ?? `item_${Date.now()}`,
                name: normalizedName,
                price: normalizedPrice,
                type: normalizedType,
                imageUrl: `/uploads/${uploadReq.file.filename}`,
            },
        });
        res.status(201).json({ item });
    }
    catch (err) {
        console.error('[POS] createItem error:', err);
        res.status(500).json({ error: 'Không thể thêm sản phẩm.' });
    }
};
exports.createItem = createItem;
// ─── POST /pos/invoices ───────────────────────────────────────────────────────
// Lưu hóa đơn sau khi thanh toán
const createInvoice = async (req, res) => {
    try {
        const userId = req.user.id;
        const { id, total, estimatedTax, items, paymentMethod, createdAt, } = req.body;
        if (!total || !items || !Array.isArray(items) || items.length === 0) {
            res.status(400).json({ error: 'Hóa đơn không hợp lệ. Vui lòng kiểm tra lại.' });
            return;
        }
        const invoice = await prisma_1.default.posInvoice.create({
            data: {
                id: id ?? `inv_${Date.now()}`,
                userId,
                total: Number(total),
                estimatedTax: Number(estimatedTax ?? 0),
                itemsJson: JSON.stringify(items),
                paymentMethod: paymentMethod ?? 'CASH',
                createdAt: createdAt ? new Date(createdAt) : new Date(),
            },
        });
        res.status(201).json({ invoice });
    }
    catch (err) {
        console.error('[POS] createInvoice error:', err);
        res.status(500).json({ error: 'Không thể lưu hóa đơn. Vui lòng thử lại.' });
    }
};
exports.createInvoice = createInvoice;
// ─── GET /pos/invoices ────────────────────────────────────────────────────────
// Lịch sử hóa đơn của user hiện tại
const getInvoices = async (req, res) => {
    try {
        const userId = req.user.id;
        const limit = parseInt(req.query.limit ?? '50', 10);
        const invoices = await prisma_1.default.posInvoice.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: limit,
            select: {
                id: true,
                total: true,
                estimatedTax: true,
                itemsJson: true,
                paymentMethod: true,
                createdAt: true,
            },
        });
        // Parse itemsJson trước khi gửi về client — mapping tường minh, tránh lỗi spread với Prisma type
        const parsed = invoices.map((inv) => ({
            id: inv.id,
            total: inv.total,
            estimatedTax: inv.estimatedTax,
            paymentMethod: inv.paymentMethod,
            createdAt: inv.createdAt,
            items: JSON.parse(inv.itemsJson),
        }));
        res.json({ invoices: parsed });
    }
    catch (err) {
        console.error('[POS] getInvoices error:', err);
        res.status(500).json({ error: 'Không thể tải lịch sử hóa đơn.' });
    }
};
exports.getInvoices = getInvoices;
