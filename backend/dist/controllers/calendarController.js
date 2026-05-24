"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedDefaultDeadlines = exports.updateDeadlineStatus = exports.createDeadline = exports.getDeadlines = void 0;
const prisma_1 = __importDefault(require("../utils/prisma"));
const getDeadlines = async (req, res) => {
    try {
        const userId = req.user.id;
        let deadlines = await prisma_1.default.deadline.findMany({
            where: { userId },
            orderBy: { dueDate: 'asc' }
        });
        // Tự động khởi tạo dữ liệu mẫu nếu chưa có để tối ưu hóa trải nghiệm đầu tiên của người dùng
        if (deadlines.length === 0) {
            const currentYear = 2026;
            const defaultData = [
                {
                    title: `Lệ phí Môn bài năm ${currentYear}`,
                    taxType: 'MON_BAI',
                    dueDate: new Date(`${currentYear}-01-30T17:00:00Z`),
                    status: 'PAID'
                },
                {
                    title: 'Tờ khai & Thuế VAT + TNCN Quý 1/2026',
                    taxType: 'VAT',
                    dueDate: new Date(`${currentYear}-04-30T17:00:00Z`),
                    status: 'PAID'
                },
                {
                    title: 'Tờ khai & Thuế VAT + TNCN Quý 2/2026',
                    taxType: 'VAT',
                    dueDate: new Date(`${currentYear}-07-31T17:00:00Z`),
                    status: 'PENDING'
                },
                {
                    title: 'Tờ khai & Thuế VAT + TNCN Quý 3/2026',
                    taxType: 'VAT',
                    dueDate: new Date(`${currentYear}-10-31T17:00:00Z`),
                    status: 'PENDING'
                },
                {
                    title: 'Tờ khai & Thuế VAT + TNCN Quý 4/2026',
                    taxType: 'VAT',
                    dueDate: new Date(`${currentYear + 1}-01-31T17:00:00Z`),
                    status: 'PENDING'
                },
                {
                    title: 'Quyết toán thuế TNCN năm 2026',
                    taxType: 'TNCN',
                    dueDate: new Date(`${currentYear + 1}-03-31T17:00:00Z`),
                    status: 'PENDING'
                }
            ];
            await Promise.all(defaultData.map(item => prisma_1.default.deadline.create({
                data: {
                    userId,
                    title: item.title,
                    taxType: item.taxType,
                    dueDate: item.dueDate,
                    status: item.status
                }
            })));
            console.log(`[Calendar]: Đã tự động seed lịch nộp thuế mẫu năm 2026 cho User ${userId}`);
            deadlines = await prisma_1.default.deadline.findMany({
                where: { userId },
                orderBy: { dueDate: 'asc' }
            });
        }
        res.json(deadlines);
    }
    catch (error) {
        res.status(500).json({ error: 'Lấy lịch nộp thuế thất bại: ' + error.message });
    }
};
exports.getDeadlines = getDeadlines;
const createDeadline = async (req, res) => {
    try {
        const userId = req.user.id;
        const { title, taxType, dueDate, status = 'PENDING' } = req.body;
        if (!title || !taxType || !dueDate) {
            return res.status(400).json({ error: 'Vui lòng điền đầy đủ tiêu đề, loại thuế và ngày hạn nộp.' });
        }
        const deadline = await prisma_1.default.deadline.create({
            data: {
                userId,
                title,
                taxType,
                dueDate: new Date(dueDate),
                status
            }
        });
        res.status(201).json({
            message: 'Tạo hạn nộp thuế mới thành công.',
            deadline
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Không thể tạo hạn nộp thuế: ' + error.message });
    }
};
exports.createDeadline = createDeadline;
const updateDeadlineStatus = async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const { status } = req.body;
        if (!status || !['PENDING', 'OVERDUE', 'PAID'].includes(status)) {
            return res.status(400).json({ error: 'Trạng thái cập nhật không hợp lệ. Chỉ chấp nhận PENDING, OVERDUE, PAID.' });
        }
        const deadline = await prisma_1.default.deadline.findFirst({
            where: {
                id: parseInt(id),
                userId
            }
        });
        if (!deadline) {
            return res.status(404).json({ error: 'Không tìm thấy hạn nộp thuế này hoặc bạn không có quyền chỉnh sửa.' });
        }
        const updated = await prisma_1.default.deadline.update({
            where: { id: deadline.id },
            data: { status }
        });
        res.json({
            message: 'Cập nhật trạng thái thành công.',
            deadline: updated
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Không thể cập nhật hạn nộp thuế: ' + error.message });
    }
};
exports.updateDeadlineStatus = updateDeadlineStatus;
// Tự động tạo các mốc hạn nộp thuế cơ bản mặc định của năm 2026 cho hộ kinh doanh mới
const seedDefaultDeadlines = async (req, res) => {
    try {
        const userId = req.user.id;
        // Kiểm tra xem đã có deadline nào chưa
        const existing = await prisma_1.default.deadline.findFirst({ where: { userId } });
        if (existing) {
            return res.status(400).json({ error: 'Tài khoản đã được thiết lập các mốc thuế ban đầu.' });
        }
        const currentYear = 2026;
        const defaultData = [
            {
                title: `Lệ phí Môn bài năm ${currentYear}`,
                taxType: 'MON_BAI',
                dueDate: new Date(`${currentYear}-01-30T17:00:00Z`),
                status: 'PAID' // Đã nộp đầu năm
            },
            {
                title: 'Tờ khai & Thuế VAT + TNCN Quý 1/2026',
                taxType: 'VAT',
                dueDate: new Date(`${currentYear}-04-30T17:00:00Z`),
                status: 'PAID'
            },
            {
                title: 'Tờ khai & Thuế VAT + TNCN Quý 2/2026',
                taxType: 'VAT',
                dueDate: new Date(`${currentYear}-07-31T17:00:00Z`),
                status: 'PENDING'
            },
            {
                title: 'Tờ khai & Thuế VAT + TNCN Quý 3/2026',
                taxType: 'VAT',
                dueDate: new Date(`${currentYear}-10-31T17:00:00Z`),
                status: 'PENDING'
            },
            {
                title: 'Tờ khai & Thuế VAT + TNCN Quý 4/2026',
                taxType: 'VAT',
                dueDate: new Date(`${currentYear + 1}-01-31T17:00:00Z`),
                status: 'PENDING'
            },
            {
                title: 'Quyết toán thuế TNCN năm 2026',
                taxType: 'TNCN',
                dueDate: new Date(`${currentYear + 1}-03-31T17:00:00Z`),
                status: 'PENDING'
            }
        ];
        const seeded = await Promise.all(defaultData.map(item => prisma_1.default.deadline.create({
            data: {
                userId,
                title: item.title,
                taxType: item.taxType,
                dueDate: item.dueDate,
                status: item.status
            }
        })));
        res.status(201).json({
            message: 'Thiết lập các mốc hạn nộp thuế mặc định năm 2026 thành công.',
            count: seeded.length,
            deadlines: seeded
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Không thể thiết lập mốc thuế mặc định: ' + error.message });
    }
};
exports.seedDefaultDeadlines = seedDefaultDeadlines;
