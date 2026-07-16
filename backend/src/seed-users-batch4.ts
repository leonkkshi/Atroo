import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ──────────────────────────────────────────────────────
// Batch 4 – createdAt: 04/07 → 16/07/2026
// ──────────────────────────────────────────────────────
const NEW_USERS = [
  // ── Đã tồn tại từ batch 3 (sẽ bị skip tự động) ──
  { businessName: 'Tiệm bánh mình Hiếu',               phone: '',             address: 'Đường Cổng Nùi, Vĩnh Lộc, Tây Phương, Hà Nội' },
  { businessName: 'Quán Phở Mạnh Tiến',                phone: '0366342755',   address: 'Đường Cổng Kết, Vĩnh Lộc, Tây Phương, Hà Nội' },
  { businessName: 'Bún Đậu Mắm Tôm Thanh Lan',         phone: '0973085381',   address: 'Đường Cổng Đình, Tây Phương, Hà Nội' },
  { businessName: 'Phở Gà Nhớ',                        phone: '0946373383',   address: '96 Đường Đa Khoa, Tây Phương, Hà Nội' },
  { businessName: 'Buffet Chay Happy',                  phone: '0966306361',   address: '59 Liên Xã, Tây Phương, Hà Nội' },
  { businessName: 'Trạm Trà Kami',                     phone: '',             address: 'Cổng Đông, Tây Phương, Hà Nội' },
  { businessName: 'Bún Cá Quả Sơn Tây',               phone: '0387021593',   address: '79 Đ. Trường Học, Hữu Bằng, Hà Nội' },
  { businessName: 'Guu Chicken',                       phone: '0987565940',   address: '28 Đ. Trường Học, Tây Phương, Hà Nội' },
  { businessName: 'Ếch Xanh Thạch Thất',              phone: '0337421879',   address: '11 Đường 419 Phùng Xá, Tây Phương, Hà Nội' },
  // ── Mới – Hưng Yên ──
  { businessName: 'Phở Nam Định',                      phone: '984408367',    address: 'Nghĩa Dân, Hưng Yên' },
  { businessName: 'KEN QUÁN',                          phone: '966771221',    address: 'Bô Thời, Việt Tiến, Hưng Yên' },
  { businessName: 'Phở Trần Gia - Chuyên Phở Gà',     phone: '981144225',    address: 'Ngã 4, Bô Thời, Việt Tiến, Hưng Yên' },
  { businessName: 'Lẩu Nướng Sapa',                   phone: '977068886',    address: 'Trung tâm thương mại, Việt Tiến, Hưng Yên' },
  { businessName: 'Wi Hair Salon',                     phone: '973752739',    address: 'Gần trường cao đẳng thuỷ lợi, Việt Tiến, Hưng Yên' },
  { businessName: 'Lẩu Mang Về - Lẩu Lòng Bò Chợ Viềng Food', phone: '366533211', address: 'Chợ Đình Yên Khê, Việt Tiến, Hưng Yên' },
  { businessName: 'Quán Lẩu Việt',                    phone: '931318386',    address: 'Trung tâm thương mại, Việt Tiến, Hưng Yên' },
  { businessName: 'Hands Barber Shop',                 phone: '775347712',    address: 'Đ. Cấp 3 Nghĩa Dân, Trương Xá, Hưng Yên' },
  { businessName: 'Cơm Bình Dân Sơn Thắm',            phone: '986013253',    address: 'QL39A, Nghĩa Dân, Hưng Yên' },
  { businessName: 'Khánh Barber Shop',                 phone: '352717170',    address: 'Cầu Mụa, Lương Bằng, Hưng Yên' },
  { businessName: 'Barber Shop - Cắt Tóc Nam',        phone: '372353098',    address: '23 ĐT196, Phố Nối, Mỹ Hào, Hưng Yên' },
  { businessName: 'Cơm Bình Dân Tuyết Nhi',           phone: '385090058',    address: 'Xã Xuân Trúc, Cù Tu, Hưng Yên' },
  { businessName: 'Quán Bia Bằng Chưa',               phone: '974956061',    address: 'Đào Xá Nghĩa Dân, Hưng Yên' },
  { businessName: 'Vườn Trúc Quán: Cơm, Phở, Bia, Lẩu', phone: '901032888', address: 'Khu CN số 5, Ngô Xá, Xuân Trúc, Hưng Yên' },
  { businessName: 'Sửa Chữa Xe Máy Huy Hùng',         phone: '987105566',    address: 'Đào Xá Nghĩa Dân, Hưng Yên' },
  { businessName: 'Quán Sửa Xe Máy',                  phone: '379795976',    address: 'Đạo Khê, Yên Mỹ, Hưng Yên' },
  { businessName: 'Bún Chả Sinh Từ 2',                phone: '382119553',    address: 'Thôn Đa Ngưu, Xã Tân Tiến, Văn Giang, Hưng Yên' },
  { businessName: 'Cơm Bình Dân Anh Bốn',             phone: '964746850',    address: 'QL39A, Nghĩa Dân, Hưng Yên' },
  { businessName: 'Quán Cơm Cô Tấm',                  phone: '359853389',    address: 'Thôn Bảo Tàng, Xuân Trúc, Hưng Yên' },
  { businessName: 'Cơm Rang Thập Cẩm Chú Bẩy',        phone: '392114887',    address: 'Khu TT 226, P. Bạch Sam, TX Mỹ Hào, Hưng Yên' },
  { businessName: 'Bia Hơi Hà Nội',                   phone: '375212170',    address: 'QL39A, Việt Tiến, Hưng Yên' },
  { businessName: 'Tiệm Cơm Rang Đệ Nhất Khói',       phone: '336114775',    address: 'Thôn Lại Ốc, Xã Long Hưng, Văn Giang, Hưng Yên' },
  { businessName: 'Quán Cơm Lâm An',                  phone: '369482281',    address: 'Thôn Tượng Cước, Xuân Trúc, Hưng Yên' },
  { businessName: 'Phở Cổ',                           phone: '326855421',    address: 'QL39A, Bô Thời, Việt Tiến, Hưng Yên' },
  { businessName: 'PHỞ BÒ CỒ CHẤT 3',                 phone: '979769140',    address: 'QL39A, Việt Tiến, Hưng Yên' },
  // ── Mới – Hoàng Mai / Thanh Xuân / Đống Đa / Hà Đông ──
  { businessName: 'Cắt Tóc Nam Đinh Nguyễn',          phone: '961293100',    address: '49 P. Giáp Nhị, Giáp Nhị, Hoàng Mai, Hà Nội' },
  { businessName: 'Cắt Tóc Minh Kiên',                phone: '868402900',    address: '73 P. Nguyễn Chính, Hoàng Mai, Hà Nội' },
  { businessName: 'Bún Cô Thắng (Bún Riêu Bún Dọc Mùng)', phone: '397213540', address: '94 Ng. 521 Đ. Trương Định, Hoàng Mai, Hà Nội' },
  { businessName: 'Bánh Đa Ghẹ Sơn Béo',              phone: '902169186',    address: 'Số 3k7, Ngõ 43 Nguyễn An Ninh, Tương Mai, Hà Nội' },
  { businessName: 'Cô Diệp Bánh Đa Cua Hải Phòng',    phone: '984171616',    address: 'Ngõ 622 P. Minh Khai, Vĩnh Tuy, Hà Nội' },
  { businessName: 'Bếp Mẹ Na - Nem Nướng Nha Trang & Ăn Vặt', phone: '972565633', address: '37 P. Bùi Huy Bích, Pháp Vân, Hoàng Mai, Hà Nội' },
  { businessName: 'Nem Nướng Nha Trang Hà Anh',       phone: '966404313',    address: '103 Ngh. 98 Ng. Tự Do, Bạch Mai, Hà Nội' },
  { businessName: 'Bia Hơi TỒ CON',                   phone: '386936368',    address: '129 P. Giáp Nhị, Giáp Nhị, Hoàng Mai, Hà Nội' },
  { businessName: 'Bún Đậu Mẹt Thu Béo',              phone: '983849887',    address: '103 E13, KTT Thanh Xuân Bắc, Thanh Xuân, Hà Nội' },
  { businessName: 'Cơm Tấm Sài Gòn',                  phone: '987835594',    address: '1b P. Đại Từ, Định Công, Hà Nội' },
  { businessName: 'Cơm Sườn Phố Cổ BBQ',              phone: '947309209',    address: '241 Trần Đại Nghĩa, Bạch Mai, Hà Nội' },
  { businessName: 'Vân Food',                          phone: '965845225',    address: 'Lộc Thượng Đinh, Thanh Xuân, Hà Nội' },
  { businessName: 'Ổ Bánh Mì - 85C Nguyễn Văn Tuyết', phone: '963056599',   address: '85c Nguyễn Văn Tuyết, Đống Đa, Hà Nội' },
  { businessName: 'Bánh Rán Khương Hạ - Bánh Mỳ Pate', phone: '979184424',  address: '72 Ng. 29 P. Khương Hạ, Khương Đình, Hà Nội' },
  { businessName: 'Pate Đò Quan Nam Định',             phone: '989233930',    address: 'Ngõ29/78 P. Khương Hạ, Khương Đình, Hà Nội' },
  { businessName: 'TIỆM BÁNH MỲ CHẢO SỐ 7 TRẦN PHÚ', phone: '984109604',    address: '7 Đ. Trần Phú, Thanh Liệt, Hà Nội' },
  { businessName: 'Tiệm Bánh Mỳ Que 105E2',           phone: '913576633',    address: '105-E2 P. Thái Thịnh, Đống Đa, Hà Nội' },
  { businessName: 'Vạn Gia Food',                      phone: '904319194',    address: 'KTT Thanh Xuân Bắc, Thanh Xuân, Hà Nội' },
  { businessName: 'Mê Hải Sản',                        phone: '869688688',    address: '19 Đ. Láng, Đống Đa, Hà Nội' },
  { businessName: 'Bếp Gạo Bắp',                       phone: '966709748',    address: 'Số 49 Ng. 47 P. Khương Trung, Khương Đình, Hà Nội' },
  { businessName: 'Quán Cháo Dinh Dưỡng Minh Phúc',   phone: '382180435',    address: '48 P. Giáp Nhị, Giáp Nhị, Hoàng Mai, Hà Nội' },
  { businessName: 'Gỏi Cá Định Công',                  phone: '988869757',    address: '477 Ng. 192 P. Lê Trọng Tấn, Định Công, Hà Nội' },
  { businessName: 'Nộm Thanh Hà',                      phone: '936327079',    address: 'C21 Nguyễn Quý Đức, KTT Thanh Xuân Bắc, Hà Nội' },
  { businessName: 'Nét Cuốn',                          phone: '357727919',    address: '30 P. Nguyễn Văn Lộc, KĐT Bắc Hà, Hà Đông, Hà Nội' },
  { businessName: 'Bánh Canh Cá Rô Đồng Nem Nướng Nha Trang', phone: '986456788', address: '18 Ngõ 71 Nguyên Hồng, C9 P. Hoàng Ngọc Phách, Hà Nội' },
  { businessName: 'Gội Đầu & Massage Sen Xanh',        phone: '947380838',    address: '81 Ng. 634 Đ. Kim Giang, Thanh Liệt, Hà Nội' },
  { businessName: 'Hoa Sáp Hà Nội',                   phone: '399518131',    address: '271/3 P. Bùi Xương Trạch, Khương Đình, Hà Nội' },
  { businessName: 'Hoa Tươi Hồng Thắm',               phone: '964671482',    address: '176 Đ. Kim Giang, Kim Văn, Định Công, Hà Nội' },
  { businessName: 'Cafe Hoa',                          phone: '934686815',    address: '63 Ngõ 12 Khuất Duy Tiến, Thanh Xuân, Hà Nội' },
  { businessName: 'Shop Hoa Hồng Huệ',                phone: '984193096',    address: '6 Nguyễn Hữu Thọ, Định Công, Hà Nội' },
  // ── Mới – Thái Nguyên ──
  { businessName: 'Bún Miến Ngan Thái Hà',            phone: '0912443125',   address: 'Ngõ 1, Đường Minh Cầu, Phan Đình Phùng, TP. Thái Nguyên' },
  { businessName: 'Phở Gà Ta Minh Hằng',              phone: '0915662445',   address: '88 Phùng Chí Kiên, Trưng Vương, TP. Thái Nguyên' },
  { businessName: 'Phở Trộn & Phở Cuốn Hà Nội',      phone: '0989112344',   address: '68 Quang Trung, TP. Thái Nguyên' },
  { businessName: 'Bún Trộn Nam Bộ & Mì Trộn',       phone: '0965223114',   address: '28 Hoàng Hoa Thám, TP. Thái Nguyên' },
  { businessName: "Bi's Flame Pizza",                  phone: '0862058822',   address: '342 Thống Nhất, Phan Đình Phùng, Thái Nguyên' },
  { businessName: 'Hải Sản Minh Châu',                phone: '0385186789',   address: 'Phan Đình Phùng, TP. Thái Nguyên' },
  { businessName: 'Cao Quán - Hải Sản & Ốc Xào',     phone: '0984665221',   address: 'Ngã ba Bắc Nam, TP. Thái Nguyên' },
  { businessName: 'Xưa Quán',                         phone: '0976558332',   address: '126 Đường Minh Cầu, TP. Thái Nguyên' },
  { businessName: 'Quang Tèo - Ốc Ngon',              phone: '0964223558',   address: 'Ngã Ba Bắc Nam, TP. Thái Nguyên' },
  { businessName: 'K-Express - Pizza Chicken',         phone: '0988554112',   address: '132 Phan Đình Phùng, TP. Thái Nguyên' },
  { businessName: 'Làng Nướng An Bình',               phone: '0983554226',   address: 'Khu dân cư số 5, P. Túc Duyên, TP. Thái Nguyên' },
  { businessName: 'Trâu Giật Hưng Mạnh',              phone: '0975441552',   address: 'Khu Hoàng Gia, Tân Thịnh, TP. Thái Nguyên' },
  { businessName: 'Thanh Nhung Bakery',                phone: '0983452114',   address: 'Cổng Trường ĐH Nông Lâm, TP. Thái Nguyên' },
  { businessName: 'Tiệm Bánh Kem Paris Gateaux',      phone: '02435123888',  address: '88 Lương Ngọc Quyến, TP. Thái Nguyên' },
  { businessName: 'Bánh Mì Dân Tổ Thái Nguyên',      phone: '0968221445',   address: '52 Hoàng Văn Thụ, TP. Thái Nguyên' },
  { businessName: 'Tiệm Bánh Ngọt Và Trà Hoa Lụa',   phone: '0975881223',   address: 'Ngõ 45 Minh Cầu, TP. Thái Nguyên' },
  { businessName: 'Tóc Nam 430',                      phone: '0868023069',   address: '430 Đường CM Tháng Tám, KĐT Hồ Xương Rồng, TP. Thái Nguyên' },
  { businessName: 'Sinh Anh Hair Salon Thái Nguyên',  phone: '0934519566',   address: '450 Lương Ngọc Quyến, TP. Thái Nguyên' },
  { businessName: 'A Cường Hair Studio',              phone: '0972554118',   address: '144 Đường Việt Bắc, TP. Thái Nguyên' },
  { businessName: 'Bún Chả Ngọc Bích',               phone: '0982355346',   address: 'Xóm Trung, Điềm Thụy, Thái Nguyên' },
  { businessName: 'Kiều Gác Bếp',                    phone: '0975269763',   address: 'Xóm Trung, Điềm Thụy, Thái Nguyên' },
  { businessName: 'Em Tài Food & Drink',              phone: '0977128104',   address: 'Cổng sau KCN Điềm Thụy, Thái Nguyên' },
  { businessName: 'Vừng Quán',                       phone: '0393289777',   address: 'KCN Yên Bình, Thái Nguyên' },
  { businessName: 'Bánh Sinh Nhật Nhung Nhung',       phone: '0962393064',   address: 'Khu Lê Hồng Phong, Thái Nguyên' },
  { businessName: 'Cá Kho Nguyễn Cường',             phone: '0973465074',   address: 'Chợ KTX Sam Sung, Thái Nguyên' },
  { businessName: 'Thùy Dương Healthy',               phone: '0862818893',   address: 'Khu Bãi Bông, Phổ Yên, Thái Nguyên' },
  { businessName: 'LINH ANH HEALTHY',                phone: '0348301311',   address: 'Xóm Trung, Điềm Thụy, Thái Nguyên' },
  { businessName: 'Kim Bắp Thủy Tiên',               phone: '0878541886',   address: 'Đán, Thái Nguyên' },
  { businessName: 'Ăn Ngon Trà Phạm',                phone: '0374996787',   address: 'Phường Quyết Thắng, Thái Nguyên' },
  { businessName: 'Mì Cay Thanh Thi',                phone: '0338696863',   address: '270 Đường Việt Bắc, Thái Nguyên' },
  { businessName: 'Chân Gà Sốt Thái Thu Hương',      phone: '0989256155',   address: '346 Bắc Sơn, Thái Nguyên' },
  { businessName: 'Tiệm Trà Cô Ba',                  phone: '0868802176',   address: 'Số nhà 13, Đường Quang Trung, Đồng Quang, TP. Thái Nguyên' },
  { businessName: 'Cẩm Vân Bakery',                  phone: '0369507915',   address: '150 Đường Bắc Sơn, TP. Thái Nguyên' },
  { businessName: 'Ri.O Hair Salon',                 phone: '0981225220',   address: '315 Đường Hoàng Văn Thụ, Phan Đình Phùng, Thái Nguyên' },
  { businessName: 'Jun Hair Salon',                  phone: '0383833835',   address: '58C Hoàng Hoa Thám, Phan Đình Phùng, Thái Nguyên' },
  { businessName: 'Bakery Quốc Đại',                 phone: '0389570851',   address: '87 Đường Lương Thế Vinh, Phan Đình Phùng, Thái Nguyên' },
  // ── Mới – Hồng Vân, Thường Tín & Tây Phương / Cầu Giấy / Hà Đông ──
  { businessName: 'Gà Rán Yên',                      phone: '345346218',    address: 'Thôn Xâm Xuyên, Hồng Vân, Thường Tín, Hà Nội' },
  { businessName: 'Cafe Hoa Thịnh',                  phone: '794283394',    address: 'Thôn Vân La, Hồng Vân, Thường Tín, Hà Nội' },
  { businessName: 'Trà Chanh Đạt',                   phone: '974366833',    address: '38 Đường Đê Sông Hồng, La Thượng, Hồng Vân, Thường Tín, Hà Nội' },
  { businessName: 'Spa An Quán',                     phone: '964039891',    address: 'Thôn Cơ Giáo, Hồng Vân, Thường Tín, Hà Nội' },
  { businessName: 'Vịt Quay Bình Phát',              phone: '975974232',    address: 'Thôn Cẩm Cơ, Hồng Vân, Thường Tín, Hà Nội' },
  { businessName: 'Shop Mẹ Và Bé Quỳnh',             phone: '835256778',    address: 'Thôn La Thượng, Hồng Vân, Thường Tín, Hà Nội' },
  { businessName: 'Hair & Beauty Đức',               phone: '322816113',    address: '6 Đường Đồng Trúc, Yên Lạc, Tây Phương, Hà Nội' },
  { businessName: 'Nhà Của Diệp',                    phone: '858326642',    address: 'Xóm 1, Đồng Trúc, Tây Phương, Hà Nội' },
  { businessName: 'Spa Loan',                        phone: '780048201',    address: 'Xóm Chùa, Đồng Trúc, Tây Phương, Hà Nội' },
  { businessName: 'Spa Kiên',                        phone: '398456815',    address: '42 Đường Cổng Đình, Vĩnh Lộc, Tây Phương, Hà Nội' },
  { businessName: 'Quán Ăn Sơn Phát',               phone: '788752741',    address: '79 Trần Bình, Nghĩa Đô, Cầu Giấy, Hà Nội' },
  { businessName: 'Hair & Beauty Yến Thịnh',         phone: '812968708',    address: '32 Nghĩa Đô, Nghĩa Đô, Cầu Giấy, Hà Nội' },
  { businessName: 'Quán Nướng Dũng',                phone: '388811863',    address: '163 Tô Hiệu, Nghĩa Đô, Cầu Giấy, Hà Nội' },
  { businessName: 'Nem Nướng My',                    phone: '813122563',    address: '114 Trần Bình, Nghĩa Đô, Cầu Giấy, Hà Nội' },
  { businessName: 'Quán Ăn An',                      phone: '333663560',    address: 'Ngách 5, Đường Hoàng Quốc Việt 59, Nghĩa Đô, Cầu Giấy, Hà Nội' },
  { businessName: 'Cafe Giang',                      phone: '362740465',    address: '16 Quang Trung, Hà Đông, Hà Nội' },
  { businessName: 'Hair & Beauty Bình Phạm',         phone: '913274535',    address: '85 Nguyễn Trãi, Hà Đông, Hà Nội' },
  { businessName: 'Hair & Beauty Huyền',             phone: '797602988',    address: '39 Tô Hiệu, Hà Đông, Hà Nội' },
];

// ── Helpers ──────────────────────────────────────────
function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randFloat(min: number, max: number) {
  return Math.random() * (max - min) + min;
}
function randDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

/** Chuẩn hóa SĐT: bỏ khoảng trắng; thêm "0" nếu đủ 9 chữ số */
function normalizePhone(raw: string): string {
  const clean = raw.replace(/\s+/g, '');
  if (!clean) return '';
  // Nếu chưa có "0" ở đầu và dài 9 chữ số → thêm "0"
  if (/^\d{9}$/.test(clean)) return '0' + clean;
  return clean;
}

let fallbackIdx = 9000;
function genFallbackTaxCode(): string {
  return `TX${++fallbackIdx}`;
}

// ── Tạo sessions cho 1 user ────────────────────────
async function createSessions(userId: number, createdAt: Date, now: Date) {
  const sessions: { userId: number; loginAt: Date; logoutAt: Date; duration: number }[] = [];

  const cursor = new Date(createdAt);
  cursor.setHours(0, 0, 0, 0);

  while (cursor <= now) {
    const sessionsPerDay = randInt(1, 3);
    const totalSec = randInt(3600, 14400); // 1h – 4h

    // Phân bổ duration
    const durations: number[] = [];
    let rem = totalSec;
    for (let s = 0; s < sessionsPerDay; s++) {
      if (s === sessionsPerDay - 1) { durations.push(Math.max(600, rem)); break; }
      const d = randInt(Math.max(600, Math.floor(rem * 0.2)), Math.floor(rem * 0.6));
      durations.push(d);
      rem -= d;
    }

    // Giờ login 7h – 21h
    const hours = Array.from({ length: durations.length }, () => randFloat(7, 21)).sort((a, b) => a - b);

    for (let s = 0; s < durations.length; s++) {
      const h = hours[s];
      const loginAt = new Date(cursor);
      loginAt.setHours(Math.floor(h), Math.floor((h % 1) * 60), randInt(0, 59), 0);
      if (loginAt > now || loginAt < createdAt) continue;

      const rawLogout = new Date(loginAt.getTime() + durations[s] * 1000);
      const logoutAt = rawLogout > now ? now : rawLogout;
      const duration = Math.floor((logoutAt.getTime() - loginAt.getTime()) / 1000);
      if (duration < 120) continue;
      sessions.push({ userId, loginAt, logoutAt, duration });
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  if (sessions.length > 0) await prisma.userSession.createMany({ data: sessions });
  return sessions;
}

// ── Main ─────────────────────────────────────────────
async function main() {
  const now = new Date();
  const rangeStart = new Date('2026-07-04T07:00:00+07:00');
  const rangeEnd   = new Date('2026-07-16T22:00:00+07:00');
  const effectiveEnd = rangeEnd < now ? rangeEnd : now;

  console.log('🚀 Bắt đầu import đợt 4...');
  console.log(`   createdAt: ${rangeStart.toLocaleDateString('vi-VN')} → ${effectiveEnd.toLocaleDateString('vi-VN')}`);
  console.log(`   Tổng entries: ${NEW_USERS.length}`);
  console.log('══════════════════════════════════════════════════════════');

  let created = 0, skipped = 0, failed = 0;

  for (const u of NEW_USERS) {
    const phone = normalizePhone(u.phone);
    const taxCode = phone !== '' ? phone : genFallbackTaxCode();
    const rawPassword = phone !== '' ? phone : taxCode;

    try {
      const existing = await prisma.user.findUnique({ where: { taxCode } });
      if (existing) {
        console.log(`⏭  Bỏ qua: ${u.businessName}`);
        skipped++; continue;
      }

      const hashedPassword = await bcrypt.hash(rawPassword, 10);
      const createdAt  = randDate(rangeStart, effectiveEnd);
      const lastActiveAt = randDate(createdAt, now);

      const user = await prisma.user.create({
        data: { taxCode, businessName: u.businessName, password: hashedPassword,
                phone: phone || null, address: u.address || null,
                role: 'USER', status: 'ACTIVE', createdAt, lastActiveAt },
      });

      const sessions = await createSessions(user.id, createdAt, now);
      const totalH = sessions.reduce((s, x) => s + x.duration, 0) / 3600;
      const days = Math.max(1, Math.ceil((now.getTime() - createdAt.getTime()) / 86400000));

      console.log(
        `✅ [${String(user.id).padStart(3)}] ${u.businessName.padEnd(40)} | ${sessions.length} sessions | ${totalH.toFixed(1)}h / ${days}d | lastActive: ${lastActiveAt.toLocaleString('vi-VN')}`
      );
      created++;
    } catch (err: any) {
      console.error(`❌ Lỗi "${u.businessName}": ${err.message}`);
      failed++;
    }
  }

  console.log('══════════════════════════════════════════════════════════');
  console.log(`📊 Kết quả: ${created} tạo mới | ${skipped} bỏ qua | ${failed} lỗi`);
}

main()
  .catch(e => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
