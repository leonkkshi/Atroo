import { Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import prisma from '../utils/prisma';
import { AuthenticatedRequest } from '../middlewares/auth';

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  throw new Error('[chatController] GEMINI_API_KEY chưa được cấu hình trong file .env');
}
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

// System Prompt chuyên sâu về Thuế Việt Nam dành cho trợ lý ảo A Trợ
const SYSTEM_PROMPT = `
Bạn là "A Trợ" - Trợ lý ảo tư vấn Thuế thông minh và chuyên nghiệp tại Việt Nam dành cho các hộ kinh doanh cá thể và cá nhân kinh doanh.
Nhiệm vụ của bạn là giải đáp các câu hỏi liên quan đến chính sách thuế, cách tính thuế, thời hạn khai báo và nộp thuế một cách chính xác, dễ hiểu và lịch sự.

Hướng dẫn trả lời:
1. Luôn sử dụng ngôn ngữ Tiếng Việt, xưng hô là "A Trợ" hoặc "Trợ lý A Trợ" và gọi người dùng là "Anh/Chị" hoặc "Quý hộ kinh doanh".
2. Bám sát các quy định pháp luật Thuế Việt Nam hiện hành theo **Nghị định 68/2026/NĐ-CP** và các văn bản liên quan.
   - Lưu ý quan trọng: Hộ kinh doanh có doanh thu từ 500 triệu đồng/năm trở xuống được miễn thuế GTGT và TNCN hoàn toàn.
   - Thuế TNCN nhóm 2 (500 triệu – 3 tỷ): chỉ tính trên phần doanh thu **vượt 1 tỷ đồng**, không phải vượt 500 triệu.
3. Khi giải thích cách tính thuế, hãy đưa ra ví dụ bằng số liệu cụ thể nếu cần thiết.
4. Nhắc nhở người dùng về các mốc thời gian quan trọng:
   - Thuế môn bài: Hạn nộp là ngày 30 tháng 01 hàng năm (hoặc ngày cuối cùng của tháng bắt đầu hoạt động đối với hộ mới thành lập).
   - Thuế khoán nộp theo quý: Hạn nộp là ngày cuối cùng của tháng đầu tiên quý tiếp theo (Ví dụ: Quý 1 hạn nộp là 30/04).
   - Thuế kê khai nộp theo tháng: Hạn nộp là ngày 20 của tháng tiếp theo.
5. Định dạng câu trả lời rõ ràng bằng Markdown (dùng danh sách bullet, in đậm, hoặc bảng số liệu nếu cần thiết) để hiển thị đẹp mắt trên màn hình ứng dụng di động.
6. Nếu câu hỏi không liên quan đến thuế, kế toán, hóa đơn hoặc tài chính doanh nghiệp, hãy lịch sự từ chối trả lời và hướng người dùng quay lại chủ đề Thuế.
`;

export const sendMessage = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Nội dung tin nhắn không được để trống.' });
    }

    // 1. Lấy lịch sử hội thoại TRƯỚC KHI lưu tin mới.
    //    Gemini multi-turn: history = các lượt trước, sendMessage = lượt hiện tại.
    //    Nếu lấy sau khi lưu, tin user hiện tại sẽ nằm trong history lẫn sendMessage => AI nhận 2 lần.
    const recentMessages = await prisma.chatMessage.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20 // 10 lượt user-AI
    });
    const geminiHistory = recentMessages.reverse().map(msg => ({
      role: msg.sender === 'USER' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    // 2. Gọi Gemini API
    let aiResponseText = '';
    try {
      const ai = new GoogleGenerativeAI(API_KEY!);
      const model = ai.getGenerativeModel({
        model: GEMINI_MODEL,
        systemInstruction: SYSTEM_PROMPT
      });

      // history = các lượt trước; sendMessage = turn hiện tại (chưa trong history)
      const chat = model.startChat({ history: geminiHistory });
      const result = await chat.sendMessage(content);
      aiResponseText = result.response.text();
      console.log(`[AI Chat]: Gemini response: "${aiResponseText.substring(0, 100)}..."`);
    } catch (apiError: any) {
      console.warn('[AI Chat Warning]: Gemini API error. Using mock fallback. Error:', apiError.message);
      aiResponseText = getMockAiResponse(content);
    }

    // 3. Lưu tin nhắn user và AI sau khi đã có phản hồi
    const userMessage = await prisma.chatMessage.create({
      data: { userId, sender: 'USER', content }
    });
    const aiMessage = await prisma.chatMessage.create({
      data: { userId, sender: 'AI', content: aiResponseText }
    });

    res.status(200).json({
      message: 'Gửi tin nhắn và nhận phản hồi thành công.',
      userMessage,
      aiMessage
    });
  } catch (error: any) {
    console.error('Loi AI Chat:', error);
    res.status(500).json({ error: 'Giao tiep voi tro ly ao that bai. Loi: ' + error.message });
  }
};

export const getChatHistory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const history = await prisma.chatMessage.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' }
    });

    res.json(history);
  } catch (error: any) {
    res.status(500).json({ error: 'Lấy lịch sử trò chuyện thất bại: ' + error.message });
  }
};

export const clearChatHistory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    await prisma.chatMessage.deleteMany({
      where: { userId }
    });

    res.json({ message: 'Đã xóa toàn bộ lịch sử trò chuyện.' });
  } catch (error: any) {
    res.status(500).json({ error: 'Xóa lịch sử trò chuyện thất bại: ' + error.message });
  }
};

// Hàm sinh câu trả lời dự phòng khi Gemini API không khả dụng
function getMockAiResponse(content: string): string {
  const query = content.toLowerCase();

  // ─── Helpers ────────────────────────────────────────────────────────────────

  // Trả về true nếu câu hỏi liên quan đến thuế / tài chính / kinh doanh
  const isTaxRelated = () => [
    'thuế', 'thue', 'hoàn', 'hoan', 'khai', 'nộp', 'nop',
    'doanh thu', 'kinh doanh', 'tài chính', 'tai chinh',
    'lệ phí', 'le phi', 'kế toán', 'ke toan', 'hóa đơn', 'hoá đơn', 'hoa don',
    'mst', 'mã số thuế', 'vi phạm', 'phạt', 'miễn', 'giảm trừ',
    'quyết toán', 'quyet toan', 'tờ khai', 'to khai', 'chứng từ',
    'thu nhập', 'thu nhap', 'lợi nhuận', 'loi nhuan', 'chi phí', 'chi phi',
    'ngân sách', 'ngan sach', 'kế khai', 'khấu trừ', 'khau tru',
    'tncn', 'tndn', 'gtgt', 'vat', 'môn bài', 'mon bai',
  ].some(kw => query.includes(kw));

  // ─── Tầng 1: Các case đặc thù thường gặp ────────────────────────────────────

  // Chào hỏi
  if (query.includes('chào') || query.includes('hello') || query.includes('hi ') || query === 'hi') {
    return `Xin chào Anh/Chị! **A Trợ** rất vui được hỗ trợ Anh/Chị hôm nay. 👋

A Trợ có thể giúp Anh/Chị về:
*   **Hoàn thuế** — điều kiện, hồ sơ và quy trình hoàn thuế GTGT, TNCN
*   **Tính thuế khoán, GTGT, TNCN, TNDN** cho Hộ kinh doanh
*   **Lịch nộp thuế** và các mốc thời hạn quan trọng năm 2026
*   **Hóa đơn điện tử** — đăng ký, xuất, xử lý sai sót

Anh/Chị cần A Trợ tư vấn về chủ đề nào ạ?`;
  }

  // Hoàn thuế
  if (query.includes('hoàn thuế') || query.includes('hoan thue') || query.includes('hoàn lại') || query.includes('được hoàn')) {
    return `Dạ Anh/Chị, về **Hoàn thuế** — đây là quyền lợi rất quan trọng cần nắm rõ:

**1. Hoàn thuế GTGT — Điều kiện được hoàn:**
*   Doanh nghiệp xuất khẩu hàng hóa, dịch vụ ra nước ngoài
*   Đầu tư mới có số thuế GTGT đầu vào chưa khấu trừ hết từ **300 triệu ₫** trở lên
*   Trường hợp chuyển đổi sở hữu, giải thể, phá sản có số thuế còn dư

**2. Hoàn thuế TNCN — Điều kiện:**
*   Cá nhân đã nộp thuế TNCN nhưng số nộp **vượt quá** số phải nộp sau quyết toán
*   Thực hiện quyết toán thuế TNCN hàng năm (hạn 31/03 năm sau)

**3. Hộ kinh doanh cá thể:**
> **Lưu ý của A Trợ:** Hộ kinh doanh nộp thuế khoán hoặc trực tiếp trên doanh thu thường **không phát sinh hoàn thuế GTGT** do không kê khai theo phương pháp khấu trừ. Tuy nhiên nếu Anh/Chị đã nộp dư thuế TNCN thì được quyền đề nghị hoàn.

**4. Hồ sơ đề nghị hoàn thuế gồm:**
1.  Giấy đề nghị hoàn trả khoản thu NSNN (Mẫu 01/HT)
2.  Bảng kê chứng từ nộp thuế
3.  Tờ khai quyết toán thuế có xác nhận

Anh/Chị đang muốn hoàn thuế **GTGT hay TNCN**, và mô hình kinh doanh của Anh/Chị là gì để A Trợ tư vấn cụ thể hơn ạ?`;
  }

  // Thuế khoán
  if (query.includes('khoán') || query.includes('khoan')) {
    return `Chào Anh/Chị. Về **Thuế khoán** của Hộ kinh doanh cá thể, **A Trợ** xin tư vấn theo **Nghị định 68/2026/NĐ-CP**:

Hộ kinh doanh có doanh thu từ **500 triệu đồng/năm trở xuống** được **miễn hoàn toàn thuế GTGT và TNCN**.

Nếu doanh thu **trên 500 triệu đồng/năm** (Nhóm 2):

| Lĩnh vực ngành nghề | Thuế suất GTGT | Thuế suất TNCN | Tổng tỷ lệ |
| :--- | :---: | :---: | :---: |
| Phân phối, cung cấp hàng hóa | 1% | 0.5% | **1.5%** |
| Dịch vụ không bao thầu NVL (Ăn uống, cắt tóc, sửa xe...) | 5% | 2% | **7.0%** |
| Sản xuất, vận tải, xây dựng có bao thầu NVL | 3% | 1.5% | **4.5%** |
| Cho thuê tài sản (BĐS, máy móc...) | 5% | 5% | **10.0%** |
| Dịch vụ thông tin số, quảng cáo số | 5% | 5% | **10.0%** |
| Hoạt động kinh doanh khác | 2% | 1% | **3.0%** |

> **Lưu ý quan trọng (Nghị định 68/2026):** Thuế TNCN Nhóm 2 chỉ tính trên phần doanh thu **vượt 1 tỷ đồng** (không phải vượt 500 triệu).

*Ví dụ ngành Dịch vụ (ăn uống, cắt tóc...), doanh thu cả năm **1.200.000.000 ₫**:*
*   Thuế GTGT = 1.200.000.000 × 5% = **60.000.000 ₫**
*   Thuế TNCN = (1.200.000.000 - 1.000.000.000) × 2% = **4.000.000 ₫**
*   **Tổng phải nộp: 64.000.000 ₫**

*Nếu doanh thu chỉ **700.000.000 ₫**: GTGT = 700tr × 5% = 35.000.000 ₫ · TNCN = 0 ₫ (chưa vượt 1 tỷ).*

Anh/Chị có cần A Trợ tính cho mức doanh thu cụ thể của mình không ạ?`;
  }

  // Thuế môn bài / lệ phí môn bài
  if (query.includes('môn bài') || query.includes('mon bai')) {
    return `Dạ Anh/Chị, về **Lệ phí môn bài** năm 2026:

**Hạn nộp:** Ngày **30/01/2026** (hộ mới: cuối tháng bắt đầu hoạt động)

**Mức lệ phí theo doanh thu năm:**
*   Trên **500 triệu ₫/năm**: **1.000.000 ₫**
*   Từ **300 – 500 triệu ₫/năm**: **500.000 ₫**
*   Từ **100 – 300 triệu ₫/năm**: **300.000 ₫**
*   Dưới **100 triệu ₫/năm**: **Miễn nộp**

> **Lưu ý:** Hộ mới thành lập được **miễn lệ phí môn bài năm đầu** theo Nghị định 22/2020/NĐ-CP.

Anh/Chị kiểm tra mục **Lịch biểu** trên ứng dụng để nhận nhắc nhở trước hạn nộp nhé!`;
  }

  // Hạn nộp / lịch nộp
  if (query.includes('hạn nộp') || query.includes('lịch nộp') || query.includes('deadline') || query.includes('khi nào nộp')) {
    return `**A Trợ** xin gửi lịch nộp thuế quan trọng năm 2026:

**① Lệ phí Môn bài:** Hạn **30/01/2026**

**② Thuế khoán theo Quý:**
*   Quý 1 → hạn **30/04/2026**
*   Quý 2 → hạn **31/07/2026**
*   Quý 3 → hạn **31/10/2026**
*   Quý 4 → hạn **30/01/2027**

**③ Thuế kê khai theo Tháng:** Hạn **ngày 20 của tháng tiếp theo**
*(Ví dụ: Tháng 5 → hạn 20/06/2026)*

> Nộp chậm bị phạt **0.03%/ngày** trên số tiền thuế chậm nộp.

Anh/Chị theo dõi và tick trạng thái đã nộp tại màn hình **Lịch biểu** của ứng dụng nhé!`;
  }

  // GTGT / VAT
  if (query.includes('vat') || query.includes('gtgt') || query.includes('giá trị gia tăng') || query.includes('gia tri gia tang')) {
    return `Dạ Anh/Chị, **thuế GTGT** đối với hộ kinh doanh tính theo tỷ lệ % trên doanh thu (Nghị định 68/2026):

**Tỷ lệ thuế GTGT theo ngành:**
*   Thương mại (bán buôn, bán lẻ hàng hóa): **1%**
*   Dịch vụ không bao thầu NVL (Ăn uống, cắt tóc, sửa xe...): **5%**
*   Sản xuất, vận tải, xây dựng có bao thầu NVL: **3%**
*   Cho thuê tài sản (BĐS, máy móc...): **5%**
*   Dịch vụ thông tin số, quảng cáo số: **5%**
*   Hoạt động kinh doanh khác: **2%**

**Công thức:** Thuế GTGT = Doanh thu × Tỷ lệ tương ứng

Anh/Chị kinh doanh ngành nghề nào để A Trợ tính chính xác mức thuế ạ?`;
  }

  // TNCN / thu nhập cá nhân
  if (query.includes('tncn') || query.includes('thu nhập cá nhân') || query.includes('thu nhap ca nhan')) {
    return `Dạ Anh/Chị, **thuế TNCN** cho hộ kinh doanh tính trực tiếp trên doanh thu (Nghị định 68/2026):

**Tỷ lệ thuế TNCN theo ngành:**
*   Thương mại: **0.5%**
*   Dịch vụ không bao thầu NVL (Ăn uống, cắt tóc, sửa xe...): **2%**
*   Sản xuất, vận tải, xây dựng có bao thầu NVL: **1.5%**
*   Cho thuê tài sản: **5%**
*   Dịch vụ thông tin số, quảng cáo số: **5%**
*   Hoạt động khác: **1%**

> **Lưu ý:** Thuế TNCN nhóm 2 (DT 500 triệu – 3 tỷ) chỉ tính trên phần doanh thu **vượt 1 tỷ đồng**.

Anh/Chị có muốn A Trợ tính cụ thể cho doanh thu của mình không ạ?`;
  }

  // TNDN / thu nhập doanh nghiệp
  if (query.includes('tndn') || query.includes('thu nhập doanh nghiệp') || query.includes('thu nhap doanh nghiep')) {
    return `Chào Anh/Chị, về **Thuế TNDN**:

> **Lưu ý:** Hộ kinh doanh cá thể **không nộp thuế TNDN** — chỉ doanh nghiệp (Công ty TNHH, Cổ phần...) mới chịu TNDN.

Nếu Anh/Chị đang chuyển đổi lên doanh nghiệp:
*   **Thuế suất phổ thông:** **20%** trên thu nhập tính thuế
*   **Công thức:** Thuế TNDN = (Doanh thu − Chi phí được trừ) × 20%

Anh/Chị đang lên kế hoạch thành lập công ty không? A Trợ có thể tư vấn thêm!`;
  }

  // Hóa đơn
  if (query.includes('hóa đơn') || query.includes('hoá đơn') || query.includes('hoa don')) {
    return `Chào Anh/Chị, về **Hóa đơn điện tử** dành cho hộ kinh doanh:

Theo **Nghị định 123/2020/NĐ-CP**, từ 01/07/2022 hộ kinh doanh kê khai bắt buộc dùng hóa đơn điện tử có mã cơ quan thuế.

**Các bước đăng ký:**
1.  Mua **chữ ký số** (Token USB hoặc HSM từ xa)
2.  Chọn nhà cung cấp: VNPT, Viettel, MISA, Bkav...
3.  Lập tờ khai **Mẫu 01/ĐKTĐ-HĐĐT** qua hệ thống nhà cung cấp
4.  Nhận phản hồi từ cơ quan thuế trong **1 ngày làm việc**

Anh/Chị có thể dùng chức năng **Quét hóa đơn** trên ứng dụng để chụp và phân tích hóa đơn tự động!`;
  }

  // ─── Tầng 2: Broad tax detection — câu hỏi thuế chung chưa khớp case cụ thể ──

  if (isTaxRelated()) {
    return `Dạ Anh/Chị, **A Trợ** đã nhận được câu hỏi của Anh/Chị về chủ đề thuế và tài chính.

Hiện tại kết nối AI đang bị gián đoạn nên A Trợ chưa thể trả lời chi tiết câu hỏi này ngay lúc này. Tuy nhiên, Anh/Chị có thể tham khảo các chủ đề liên quan mà A Trợ đã có sẵn thông tin:

*   **Hoàn thuế GTGT / TNCN** — gõ "hoàn thuế" để xem điều kiện và hồ sơ
*   **Thuế khoán hộ kinh doanh** — gõ "thuế khoán" để xem bảng tỷ lệ
*   **Lịch nộp thuế 2026** — gõ "hạn nộp" để xem các mốc deadline
*   **Hoàn thiện tờ khai** — gõ "tờ khai" hoặc "kê khai" để được hướng dẫn

> A Trợ sẽ kết nối lại AI đầy đủ ngay khi mạng ổn định. Anh/Chị thử lại sau ít phút hoặc đặt câu hỏi cụ thể hơn nhé!`;
  }

  // ─── Tầng 3: Thực sự lạc đề ────────────────────────────────────────────────

  return `Chào Anh/Chị! **A Trợ** là trợ lý chuyên về **Thuế Việt Nam và tài chính hộ kinh doanh**, nên chủ đề này nằm ngoài phạm vi A Trợ có thể hỗ trợ ạ.

Anh/Chị có câu hỏi nào về thuế không? Ví dụ:
*   *Tôi có được hoàn thuế không?*
*   *Thuế khoán quý này tính thế nào?*
*   *Hạn nộp lệ phí môn bài năm 2026 là khi nào?*`;
}


