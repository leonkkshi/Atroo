-- Migration: add userId to PosItem (per-user product catalog isolation)
-- Mỗi user có danh mục sản phẩm riêng, không dùng chung

-- Bước 1: Xóa toàn bộ seed data cũ (không có userId, vô nghĩa sau khi thêm constraint)
-- Dữ liệu sẽ được seed lại tự động theo từng user khi họ đăng nhập lần đầu
DELETE FROM "PosItem";

-- Bước 2: Thêm cột userId (NOT NULL — mọi sản phẩm phải thuộc về một user)
ALTER TABLE "PosItem" ADD COLUMN "userId" INTEGER NOT NULL;

-- Bước 3: Thêm foreign key constraint (xóa user → xóa toàn bộ sản phẩm của user đó)
ALTER TABLE "PosItem" ADD CONSTRAINT "PosItem_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Bước 4: Cập nhật default imageUrl (trước là /uploads/... không còn hợp lệ)
ALTER TABLE "PosItem" ALTER COLUMN "imageUrl" SET DEFAULT '';
