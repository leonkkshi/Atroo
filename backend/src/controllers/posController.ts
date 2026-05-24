import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import prisma from '../utils/prisma';

const DEFAULT_ITEM_IMAGE = '/uploads/pos-placeholder.svg';
const DEFAULT_IMAGE_BY_TYPE: Record<string, string> = {
  FOOD: '/uploads/pos-food.svg',
  PRODUCT: '/uploads/pos-product.svg',
  SERVICE: '/uploads/pos-service.svg',
};

type UploadRequest = Request & {
  file?: Express.Multer.File;
};

type ItemBody = {
  id?: string;
  name?: string;
  price?: string | number;
  type?: string;
};

function normalizeItemBody(body: ItemBody) {
  const normalizedName = typeof body.name === 'string' ? body.name.trim() : '';
  const normalizedType = typeof body.type === 'string' ? body.type.trim().toUpperCase() : '';
  const normalizedPrice = Number(body.price);

  if (!normalizedName || !normalizedType || !Number.isFinite(normalizedPrice) || normalizedPrice <= 0) {
    throw new Error('Thiếu thông tin sản phẩm hợp lệ (name, price, type).');
  }

  if (!['FOOD', 'PRODUCT', 'SERVICE'].includes(normalizedType)) {
    throw new Error('Loại sản phẩm không hợp lệ.');
  }

  return {
    name: normalizedName,
    type: normalizedType,
    price: normalizedPrice,
  };
}

// ─── Danh sách sản phẩm mặc định ─────────────────────────────────────────────
// Bao gồm 3 loại hình: Quán ăn nhỏ · Tiệm cắt tóc · Tiệm sửa xe
const DEFAULT_ITEMS = [
  // ── 🍜 Quán ăn nhỏ ──────────────────────────────────────────────────────────
  { id: 'food_01', name: 'Cơm đĩa bình dân',      price:  30000, type: 'FOOD' },
  { id: 'food_02', name: 'Cơm sườn trứng',        price:  40000, type: 'FOOD' },
  { id: 'food_03', name: 'Bát phở bò tái',        price:  45000, type: 'FOOD' },
  { id: 'food_04', name: 'Bún bò Huế',            price:  40000, type: 'FOOD' },
  { id: 'food_05', name: 'Hũ tiếu Nam Vang',      price:  40000, type: 'FOOD' },
  { id: 'food_06', name: 'Bún riêu cua',          price:  35000, type: 'FOOD' },
  { id: 'food_07', name: 'Cơm tấm ba rọi',        price:  45000, type: 'FOOD' },
  { id: 'drk_01', name: 'Trà đá',                 price:   5000, type: 'PRODUCT' },
  { id: 'drk_02', name: 'Nước ngọt lon',          price:  12000, type: 'PRODUCT' },
  { id: 'drk_03', name: 'Cà phê đá',             price:  20000, type: 'PRODUCT' },
  { id: 'drk_04', name: 'Nước suối',              price:   8000, type: 'PRODUCT' },

  // ── ✂️ Tiệm cắt tóc ─────────────────────────────────────────────────────────
  { id: 'hair_01', name: 'Cắt tóc nam basic',     price:  50000, type: 'SERVICE' },
  { id: 'hair_02', name: 'Cắt tóc nam cao cấp',   price:  80000, type: 'SERVICE' },
  { id: 'hair_03', name: 'Cắt tóc nữ ngắn',       price:  80000, type: 'SERVICE' },
  { id: 'hair_04', name: 'Cắt tóc nữ dài',        price: 120000, type: 'SERVICE' },
  { id: 'hair_05', name: 'Gội đầu dưỡng tóc',    price:  50000, type: 'SERVICE' },
  { id: 'hair_06', name: 'Nhuộm tóc (basic)',     price: 250000, type: 'SERVICE' },
  { id: 'hair_07', name: 'Uốn tóc',               price: 350000, type: 'SERVICE' },
  { id: 'hair_08', name: 'Nối tóc',               price: 500000, type: 'SERVICE' },
  { id: 'hair_09', name: 'Cắt + gội + sấy',       price: 100000, type: 'SERVICE' },

  // ── 🔧 Tiệm sửa xe ──────────────────────────────────────────────────────────
  { id: 'bike_01', name: 'Vá xăm xe máy',         price:  20000, type: 'SERVICE' },
  { id: 'bike_02', name: 'Vá xe không ruột',       price:  40000, type: 'SERVICE' },
  { id: 'bike_03', name: 'Thay dầu xe máy',        price:  80000, type: 'SERVICE' },
  { id: 'bike_04', name: 'Thay lốp xe (1 bánh)',   price: 150000, type: 'SERVICE' },
  { id: 'bike_05', name: 'Rửa xe máy',             price:  30000, type: 'SERVICE' },
  { id: 'bike_06', name: 'Sửa điện xe máy',        price: 100000, type: 'SERVICE' },
  { id: 'bike_07', name: 'Thay nhớt + lọc',        price: 120000, type: 'SERVICE' },
  { id: 'bike_08', name: 'Sạc bình ắc quy',        price:  30000, type: 'SERVICE' },
  { id: 'bike_09', name: 'Dầu nhớt Honda',         price:  55000, type: 'PRODUCT' },
  { id: 'bike_10', name: 'Lốp xe Michelin',        price: 320000, type: 'PRODUCT' },
].map((item) => ({
  ...item,
  imageUrl: DEFAULT_IMAGE_BY_TYPE[item.type] ?? DEFAULT_ITEM_IMAGE,
}));

// ─── GET /pos/items ───────────────────────────────────────────────────────────
// Trả về toàn bộ danh mục sản phẩm. Auto-seed nếu bảng còn trống.
export const getItems = async (req: Request, res: Response) => {
  try {
    let items = await prisma.posItem.findMany({
      orderBy: { createdAt: 'asc' },
    });

    if (items.length === 0) {
      // Seed sản phẩm mặc định cho lần đầu
      await prisma.posItem.createMany({ data: DEFAULT_ITEMS });
      items = await prisma.posItem.findMany({ orderBy: { createdAt: 'asc' } });
    }

    res.json({ items });
  } catch (err) {
    console.error('[POS] getItems error:', err);
    res.status(500).json({ error: 'Không thể tải danh sách sản phẩm.' });
  }
};

// ─── POST /pos/items ──────────────────────────────────────────────────────────
// Thêm sản phẩm / dịch vụ mới vào danh mục
export const createItem = async (req: Request, res: Response) => {
  try {
    const uploadReq = req as UploadRequest;
    const { id } = req.body as ItemBody;

    let normalizedItem;
    try {
      normalizedItem = normalizeItemBody(req.body as ItemBody);
    } catch (validationError: any) {
      res.status(400).json({ error: validationError.message });
      return;
    }

    if (!uploadReq.file) {
      res.status(400).json({ error: 'Vui lòng chọn hình ảnh sản phẩm.' });
      return;
    }

    const item = await prisma.posItem.create({
      data: {
        id: id ?? `item_${Date.now()}`,
        name: normalizedItem.name,
        price: normalizedItem.price,
        type: normalizedItem.type,
        imageUrl: `/uploads/${uploadReq.file.filename}`,
      },
    });

    res.status(201).json({ item });
  } catch (err) {
    console.error('[POS] createItem error:', err);
    res.status(500).json({ error: 'Không thể thêm sản phẩm.' });
  }
};

// ─── PUT /pos/items/:id ──────────────────────────────────────────────────────
// Cập nhật thông tin sản phẩm / dịch vụ trong danh mục
export const updateItem = async (req: Request, res: Response) => {
  try {
    const uploadReq = req as UploadRequest;
    const id = req.params['id'] as string;

    const existingItem = await prisma.posItem.findUnique({ where: { id } });
    if (!existingItem) {
      res.status(404).json({ error: 'Không tìm thấy sản phẩm cần cập nhật.' });
      return;
    }

    let normalizedItem;
    try {
      normalizedItem = normalizeItemBody(req.body as ItemBody);
    } catch (validationError: any) {
      res.status(400).json({ error: validationError.message });
      return;
    }

    const item = await prisma.posItem.update({
      where: { id },
      data: {
        name: normalizedItem.name,
        price: normalizedItem.price,
        type: normalizedItem.type,
        imageUrl: uploadReq.file ? `/uploads/${uploadReq.file.filename}` : existingItem.imageUrl,
      },
    });

    res.json({ item });
  } catch (err) {
    console.error('[POS] updateItem error:', err);
    res.status(500).json({ error: 'Không thể cập nhật sản phẩm.' });
  }
};

// ─── DELETE /pos/items/:id ───────────────────────────────────────────────────
// Xóa sản phẩm / dịch vụ khỏi danh mục
export const deleteItem = async (req: Request, res: Response) => {
  try {
    const id = req.params['id'] as string;

    const existingItem = await prisma.posItem.findUnique({ where: { id } });
    if (!existingItem) {
      res.status(404).json({ error: 'Không tìm thấy sản phẩm cần xóa.' });
      return;
    }

    await prisma.posItem.delete({ where: { id } });

    res.json({ message: 'Đã xóa sản phẩm thành công.' });
  } catch (err) {
    console.error('[POS] deleteItem error:', err);
    res.status(500).json({ error: 'Không thể xóa sản phẩm.' });
  }
};

// ─── POST /pos/invoices ───────────────────────────────────────────────────────
// Lưu hóa đơn sau khi thanh toán
export const createInvoice = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const {
      id,
      total,
      estimatedTax,
      items,
      paymentMethod,
      createdAt,
    } = req.body as {
      id?: string;
      total: number;
      estimatedTax?: number;
      items: Array<{ id: string; name: string; price: number; type: string; quantity: number }>;
      paymentMethod?: string;
      createdAt?: string;
    };

    if (!total || !items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'Hóa đơn không hợp lệ. Vui lòng kiểm tra lại.' });
      return;
    }

    const invoice = await prisma.posInvoice.create({
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
  } catch (err) {
    console.error('[POS] createInvoice error:', err);
    res.status(500).json({ error: 'Không thể lưu hóa đơn. Vui lòng thử lại.' });
  }
};

// ─── GET /pos/invoices ────────────────────────────────────────────────────────
// Lịch sử hóa đơn của user hiện tại
export const getInvoices = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const limit = parseInt((req.query.limit as string) ?? '50', 10);

    const invoices = await prisma.posInvoice.findMany({
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
    const parsed = invoices.map((inv: {
      id: string;
      total: number;
      estimatedTax: number;
      itemsJson: string;
      paymentMethod: string;
      createdAt: Date;
    }) => ({
      id: inv.id,
      total: inv.total,
      estimatedTax: inv.estimatedTax,
      paymentMethod: inv.paymentMethod,
      createdAt: inv.createdAt,
      items: JSON.parse(inv.itemsJson) as Array<{
        id: string; name: string; price: number; type: string; quantity: number;
      }>,
    }));

    res.json({ invoices: parsed });
  } catch (err) {
    console.error('[POS] getInvoices error:', err);
    res.status(500).json({ error: 'Không thể tải lịch sử hóa đơn.' });
  }
};
