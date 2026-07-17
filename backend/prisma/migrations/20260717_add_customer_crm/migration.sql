-- AddCustomerCRM: Thêm bảng Customer và PointRedemption cho CRM

-- Tạo bảng Customer
CREATE TABLE "Customer" (
    "id"         TEXT NOT NULL,
    "userId"     INTEGER NOT NULL,
    "name"       TEXT NOT NULL,
    "phone"      TEXT,
    "birthday"   TEXT,
    "points"     INTEGER NOT NULL DEFAULT 0,
    "totalSpent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tier"       TEXT NOT NULL DEFAULT 'STANDARD',
    "note"       TEXT NOT NULL DEFAULT '',
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- Foreign key Customer → User
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Unique: mỗi user không có 2 khách cùng số điện thoại
CREATE UNIQUE INDEX "Customer_userId_phone_key" ON "Customer"("userId", "phone")
    WHERE "phone" IS NOT NULL;

-- Index tìm kiếm theo user
CREATE INDEX "Customer_userId_idx" ON "Customer"("userId");

-- Tạo bảng PointRedemption (lịch sử đổi điểm)
CREATE TABLE "PointRedemption" (
    "id"          TEXT NOT NULL,
    "customerId"  TEXT NOT NULL,
    "pointsUsed"  INTEGER NOT NULL,
    "discountAmt" DOUBLE PRECISION NOT NULL,
    "voucherCode" TEXT,
    "note"        TEXT NOT NULL DEFAULT '',
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointRedemption_pkey" PRIMARY KEY ("id")
);

-- Foreign key PointRedemption → Customer
ALTER TABLE "PointRedemption" ADD CONSTRAINT "PointRedemption_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Thêm cột customerId vào PosInvoice (liên kết với khách hàng khi thanh toán)
ALTER TABLE "PosInvoice" ADD COLUMN "customerId" TEXT;

-- Foreign key PosInvoice → Customer (SetNull khi xóa Customer)
ALTER TABLE "PosInvoice" ADD CONSTRAINT "PosInvoice_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
