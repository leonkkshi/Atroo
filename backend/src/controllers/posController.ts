import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import prisma from '../utils/prisma';
import { uploadImageToCloudinary, deleteImageFromCloudinary } from '../utils/cloudinary';

// ─── Ảnh mặc định ─────────────────────────────────────────────────────────────
// Dùng inline SVG data URI thay vì file /uploads/*.svg
// → hoạt động trên mọi môi trường kể cả Railway (không cần filesystem)
const makeSvg = (emoji: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150" viewBox="0 0 200 150">` +
    `<rect width="200" height="150" fill="%231C2340"/>` +
    `<text x="100" y="95" font-size="64" text-anchor="middle" dominant-baseline="middle">${emoji}</text>` +
    `</svg>`,
  )}`;

const DEFAULT_ITEM_IMAGE = makeSvg('📦');
const DEFAULT_IMAGE_BY_TYPE: Record<string, string> = {
  FOOD:    makeSvg('🍜'),
  PRODUCT: makeSvg('📦'),
  SERVICE: makeSvg('⚙️'),
};

type UploadRequest = Request & {
  file?: Express.Multer.File; // file.buffer có sẵn vì dùng memoryStorage
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

// ─── Danh sách sản phẩm mặc định ──────────────────────────────────────────────
// Seed riêng cho từng user lần đầu đăng nhập POS (id gắn với userId tránh đụng)
const DEFAULT_ITEMS_TEMPLATE = [
  // ── 🍜 Quán ăn nhỏ ──────────────────────────────────────────────────────────────────
  { key: 'food_01', name: 'Cơm đĩa bình dân',      price:  30000, type: 'FOOD' },
  { key: 'food_02', name: 'Cơm sườn trứng',        price:  40000, type: 'FOOD' },
  { key: 'food_03', name: 'Bát phở bò tái',        price:  45000, type: 'FOOD' },
  { key: 'food_04', name: 'Bún bò Huế',            price:  40000, type: 'FOOD' },
  { key: 'food_05', name: 'Hũ tiếu Nam Vang',      price:  40000, type: 'FOOD' },
  { key: 'food_06', name: 'Bún riêu cua',          price:  35000, type: 'FOOD' },
  { key: 'food_07', name: 'Cơm tấm ba rọi',        price:  45000, type: 'FOOD' },
  { key: 'drk_01', name: 'Trà đá',                 price:   5000, type: 'PRODUCT' },
  { key: 'drk_02', name: 'Nước ngọt lon',          price:  12000, type: 'PRODUCT' },
  { key: 'drk_03', name: 'Cà phê đá',             price:  20000, type: 'PRODUCT' },
  { key: 'drk_04', name: 'Nước suối',              price:   8000, type: 'PRODUCT' },

  // ── ✂️ Tiệm cắt tóc ────────────────────────────────────────────────────────────────
  { key: 'hair_01', name: 'Cắt tóc nam basic',     price:  50000, type: 'SERVICE' },
  { key: 'hair_02', name: 'Cắt tóc nam cao cấp',   price:  80000, type: 'SERVICE' },
  { key: 'hair_03', name: 'Cắt tóc nữ ngắn',       price:  80000, type: 'SERVICE' },
  { key: 'hair_04', name: 'Cắt tóc nữ dài',        price: 120000, type: 'SERVICE' },
  { key: 'hair_05', name: 'Gội đầu dưỡng tóc',    price:  50000, type: 'SERVICE' },
  { key: 'hair_06', name: 'Nhuộm tóc (basic)',     price: 250000, type: 'SERVICE' },
  { key: 'hair_07', name: 'Uốn tóc',               price: 350000, type: 'SERVICE' },
  { key: 'hair_08', name: 'Nối tóc',               price: 500000, type: 'SERVICE' },
  { key: 'hair_09', name: 'Cắt + gội + sấy',       price: 100000, type: 'SERVICE' },

  // ── 🔧 Tiệm sửa xe ────────────────────────────────────────────────────────────
  { key: 'bike_01', name: 'Vá xăm xe máy',         price:  20000, type: 'SERVICE' },
  { key: 'bike_02', name: 'Vá xe không ruột',       price:  40000, type: 'SERVICE' },
  { key: 'bike_03', name: 'Thay dầu xe máy',        price:  80000, type: 'SERVICE' },
  { key: 'bike_04', name: 'Thay lốp xe (1 bánh)',   price: 150000, type: 'SERVICE' },
  { key: 'bike_05', name: 'Rửa xe máy',             price:  30000, type: 'SERVICE' },
  { key: 'bike_06', name: 'Sửa điện xe máy',        price: 100000, type: 'SERVICE' },
  { key: 'bike_07', name: 'Thay nhớt + lọc',        price: 120000, type: 'SERVICE' },
  { key: 'bike_08', name: 'Sạc bình ắc quy',        price:  30000, type: 'SERVICE' },
  { key: 'bike_09', name: 'Dầu nhớt Honda',         price:  55000, type: 'PRODUCT' },
  { key: 'bike_10', name: 'Lốp xe Michelin',        price: 320000, type: 'PRODUCT' },
];

// Build seed data gắn với một userId cụ thể
function buildSeedItems(userId: number) {
  return DEFAULT_ITEMS_TEMPLATE.map((item) => ({
    id: `u${userId}_${item.key}`,          // id duy nhất theo user
    userId,
    name: item.name,
    price: item.price,
    type: item.type,
    imageUrl: DEFAULT_IMAGE_BY_TYPE[item.type] ?? DEFAULT_ITEM_IMAGE,
  }));
}

// ─── GET /pos/items ────────────────────────────────────────────────────────────
// Trả về danh mục sản phẩm riêng của user đăng nhập. Auto-seed nếu user chưa có sản phẩm nào.
export const getItems = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    let items = await prisma.posItem.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });

    if (items.length === 0) {
      // Seed sản phẩm mặc định riêng cho user này
      const seedData = buildSeedItems(userId);
      try {
        await prisma.posItem.createMany({ data: seedData });
      } catch {
        // Bỏ qua nếu seed bị trùng (ví dụ: gọi lại 2 lần đồng thời)
      }
      items = await prisma.posItem.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
    }

    res.json({ items });
  } catch (err) {
    console.error('[POS] getItems error:', err);
    res.status(500).json({ error: 'Không thể tải danh sách sản phẩm.' });
  }
};

// ─── POST /pos/items ────────────────────────────────────────────────────────────
// Thêm sản phẩm / dịch vụ mới vào danh mục của user
export const createItem = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const uploadReq = req as unknown as UploadRequest;
    const { id } = req.body as ItemBody;

    let normalizedItem;
    try {
      normalizedItem = normalizeItemBody(req.body as ItemBody);
    } catch (validationError: any) {
      res.status(400).json({ error: validationError.message });
      return;
    }

    if (!uploadReq.file?.buffer) {
      res.status(400).json({ error: 'Vui lòng chọn hình ảnh sản phẩm.' });
      return;
    }

    // Upload ảnh lên Cloudinary → nhận URL bền vững
    let imageUrl: string;
    try {
      imageUrl = await uploadImageToCloudinary(uploadReq.file!.buffer);
    } catch {
      res.status(500).json({ error: 'Upload ảnh thất bại. Vui lòng thử lại.' });
      return;
    }

    const item = await prisma.posItem.create({
      data: {
        id: id ?? `u${userId}_item_${Date.now()}`,
        userId,
        name: normalizedItem.name,
        price: normalizedItem.price,
        type: normalizedItem.type,
        imageUrl,
      },
    });

    res.status(201).json({ item });
  } catch (err) {
    console.error('[POS] createItem error:', err);
    res.status(500).json({ error: 'Không thể thêm sản phẩm.' });
  }
};

// ─── PUT /pos/items/:id ──────────────────────────────────────────────────────
// Cập nhật thông tin sản phẩm của user (chỉ sửa sản phẩm thuộc về mình)
export const updateItem = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const uploadReq = req as unknown as UploadRequest;
    const id = req.params['id'] as string;

    const existingItem = await prisma.posItem.findUnique({ where: { id } });
    if (!existingItem) {
      res.status(404).json({ error: 'Không tìm thấy sản phẩm cần cập nhật.' });
      return;
    }
    // Kiểm tra quyền sở hữu
    if (existingItem.userId !== userId) {
      res.status(403).json({ error: 'Bạn không có quyền sửa sản phẩm này.' });
      return;
    }

    let normalizedItem;
    try {
      normalizedItem = normalizeItemBody(req.body as ItemBody);
    } catch (validationError: any) {
      res.status(400).json({ error: validationError.message });
      return;
    }

    // Nếu có file mới → upload Cloudinary, xóa ảnh cũ (best-effort)
    let imageUrl = existingItem.imageUrl;
    if (uploadReq.file?.buffer) {
      try {
        imageUrl = await uploadImageToCloudinary(uploadReq.file.buffer);
        // Xóa ảnh cũ trên Cloudinary (bỏ qua nếu là data URI mặc định)
        if (existingItem.imageUrl.startsWith('https://res.cloudinary.com')) {
          await deleteImageFromCloudinary(existingItem.imageUrl);
        }
      } catch {
        res.status(500).json({ error: 'Upload ảnh thất bại. Vui lòng thử lại.' });
        return;
      }
    }

    const item = await prisma.posItem.update({
      where: { id },
      data: {
        name: normalizedItem.name,
        price: normalizedItem.price,
        type: normalizedItem.type,
        imageUrl,
      },
    });

    res.json({ item });
  } catch (err) {
    console.error('[POS] updateItem error:', err);
    res.status(500).json({ error: 'Không thể cập nhật sản phẩm.' });
  }
};

// ─── DELETE /pos/items/:id ───────────────────────────────────────────────────
// Xóa sản phẩm của user (chỉ xóa sản phẩm thuộc về mình)
export const deleteItem = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const id = req.params['id'] as string;

    const existingItem = await prisma.posItem.findUnique({ where: { id } });
    if (!existingItem) {
      res.status(404).json({ error: 'Không tìm thấy sản phẩm cần xóa.' });
      return;
    }
    // Kiểm tra quyền sở hữu
    if (existingItem.userId !== userId) {
      res.status(403).json({ error: 'Bạn không có quyền xóa sản phẩm này.' });
      return;
    }

    await prisma.posItem.delete({ where: { id } });

    // Xóa ảnh trên Cloudinary sau khi xóa record (best-effort)
    if (existingItem.imageUrl.startsWith('https://res.cloudinary.com')) {
      await deleteImageFromCloudinary(existingItem.imageUrl);
    }

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

// ─── Chi phí POS ─────────────────────────────────────────────────────────────

// Lấy danh sách chi phí của user hiện tại
export const getExpenses = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const expenses = await prisma.posExpense.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
    });
    res.json({ expenses });
  } catch (err) {
    console.error('[POS] getExpenses error:', err);
    res.status(500).json({ error: 'Không thể tải danh sách chi phí.' });
  }
};

// Thêm khoản chi phí mới
export const createExpense = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id, title, amount, category, date } = req.body as {
      id?: string;
      title: string;
      amount: number;
      category: string;
      date: string;
    };

    if (!title || !amount || !category || !date) {
      res.status(400).json({ error: 'Thông tin chi phí không hợp lệ.' });
      return;
    }

    const expense = await prisma.posExpense.create({
      data: {
        id: id ?? `exp_${Date.now()}`,
        userId,
        title: title.trim(),
        amount: Number(amount),
        category: category.trim(),
        date: date.trim(),
      },
    });

    res.status(201).json({ expense });
  } catch (err) {
    console.error('[POS] createExpense error:', err);
    res.status(500).json({ error: 'Không thể tạo chi phí mới.' });
  }
};

// Xóa khoản chi phí theo ID
export const deleteExpense = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const id = req.params['id'] as string;

    const existingExpense = await prisma.posExpense.findUnique({ where: { id } });
    if (!existingExpense) {
      res.status(404).json({ error: 'Không tìm thấy chi phí cần xóa.' });
      return;
    }

    if (existingExpense.userId !== userId) {
      res.status(403).json({ error: 'Bạn không có quyền xóa chi phí này.' });
      return;
    }

    await prisma.posExpense.delete({ where: { id } });

    res.json({ message: 'Đã xóa chi phí thành công.' });
  } catch (err) {
    console.error('[POS] deleteExpense error:', err);
    res.status(500).json({ error: 'Không thể xóa chi phí.' });
  }
};
