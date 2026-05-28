import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

// Cấu hình tự động từ biến môi trường CLOUDINARY_URL hoặc từng biến riêng
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload một buffer ảnh lên Cloudinary.
 * @param buffer  - Buffer của file ảnh (từ multer memoryStorage)
 * @param folder  - Thư mục lưu trên Cloudinary (mặc định: atroo/pos-items)
 * @returns secure_url — URL HTTPS của ảnh trên Cloudinary CDN
 */
export async function uploadImageToCloudinary(
  buffer: Buffer,
  folder = 'atroo/pos-items',
): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'svg'],
        transformation: [
          // Resize về tối đa 800px, giữ aspect ratio, nén chất lượng 85%
          { width: 800, height: 800, crop: 'limit', quality: 85, fetch_format: 'auto' },
        ],
      },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error('Cloudinary upload thất bại.'));
        } else {
          resolve(result.secure_url);
        }
      },
    );

    // Pipe buffer vào upload stream
    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);
    readable.pipe(stream);
  });
}

/**
 * Xóa ảnh khỏi Cloudinary theo URL.
 * Parse publicId từ URL (an toàn nếu URL không phải Cloudinary).
 */
export async function deleteImageFromCloudinary(imageUrl: string): Promise<void> {
  try {
    // URL Cloudinary có dạng: https://res.cloudinary.com/<cloud>/image/upload/v123/<folder>/<publicId>.ext
    const match = imageUrl.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-z]+$/i);
    if (!match) return; // Không phải URL Cloudinary → bỏ qua

    const publicId = match[1]; // vd: "atroo/pos-items/item-abc123"
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
  } catch {
    // Không throw — xóa ảnh cũ là best-effort, không chặn flow chính
  }
}
