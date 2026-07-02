-- AddVoucher: Thêm bảng Voucher và cập nhật PosInvoice

-- Thêm cột voucherCode và discountAmount vào PosInvoice
ALTER TABLE "PosInvoice" ADD COLUMN "voucherCode" TEXT;
ALTER TABLE "PosInvoice" ADD COLUMN "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Tạo bảng Voucher
CREATE TABLE "Voucher" (
    "id"             TEXT NOT NULL,
    "userId"         INTEGER NOT NULL,
    "code"           TEXT NOT NULL,
    "type"           TEXT NOT NULL,
    "value"          DOUBLE PRECISION NOT NULL,
    "minOrderAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "usageLimit"     INTEGER,
    "usageCount"     INTEGER NOT NULL DEFAULT 0,
    "status"         TEXT NOT NULL DEFAULT 'ACTIVE',
    "expiresAt"      TIMESTAMP(3),
    "description"    TEXT NOT NULL DEFAULT '',
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Voucher_pkey" PRIMARY KEY ("id")
);

-- Foreign key từ Voucher → User
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Unique constraint: mỗi user không được trùng code
CREATE UNIQUE INDEX "Voucher_userId_code_key" ON "Voucher"("userId", "code");
