# Kết nối Google Drive cá nhân

Nexus chỉ kết nối Drive bằng OAuth của tài khoản Google cá nhân. Chọn thư mục trong My Drive mà tài khoản đó có quyền tạo và xóa tệp.

## Chuẩn bị trong Google Cloud

1. Chọn hoặc tạo Google Cloud project và bật **Google Drive API**.
2. Cấu hình OAuth consent screen. Nếu ứng dụng ở chế độ **Testing**, thêm email Google sẽ kết nối vào danh sách test users.
3. Tạo OAuth Client ID loại **Web application**.
4. Trong **Authorized redirect URIs**, thêm chính xác URI hiển thị tại **Cài đặt → Lưu trữ → Tài khoản Google cá nhân**. Local mặc định là `http://localhost:4100/api/v1/settings/storage/google-drive/oauth/callback`; trên VPS dùng HTTPS và domain API công khai.
5. Sao chép folder ID của thư mục trong My Drive mà tài khoản OAuth có quyền ghi.

## Kết nối trong Nexus ECM

1. Mở **Cài đặt → Lưu trữ** bằng tài khoản có quyền `settings:update`.
2. Nhập folder ID, OAuth Client ID và Client Secret.
3. Bấm **Lưu và kết nối Google** rồi đăng nhập/chấp thuận quyền Drive trên trang Google.
4. Khi quay lại Nexus, hệ thống kiểm tra quyền đọc/ghi bằng cách tạo rồi xóa một tệp tạm. Chỉ sau khi kiểm tra thành công mới chọn được Google Drive làm nơi lưu.
5. Trên VPS, đặt `WEB_URL` là origin HTTPS của giao diện web (ví dụ `https://hr.example.com`) và `API_URL` là origin API được Google OAuth redirect URI sử dụng. Giữ `FACE_ENCRYPTION_KEY` ổn định để Nexus giải mã OAuth secret và refresh token đã mã hóa trong database.

Client Secret và refresh token được mã hóa trước khi lưu. OAuth state dùng một lần và hết hạn sau 10 phút. Không gửi Client Secret hoặc refresh token qua chat, log hay Git.

## Lỗi thường gặp

- **redirect_uri_mismatch**: URI trong Google Cloud không khớp chính xác giá trị Nexus hiển thị; kiểm tra scheme, domain, port và path.
- **access_denied / app not configured for users**: nếu consent screen đang ở Testing, thêm email cá nhân làm test user.
- **Google không trả refresh token**: thu hồi quyền Nexus ECM trong phần quyền ứng dụng của tài khoản Google rồi chọn kết nối lại để cấp quyền mới.
- **Folder not found / insufficient permissions**: kiểm tra folder ID thuộc đúng tài khoản đang đăng nhập và tài khoản có quyền tạo tệp trong thư mục.
- **Không truy cập được callback trên VPS**: đảm bảo API URL công khai có HTTPS, reverse proxy chuyển tiếp `/api/v1/settings/storage/google-drive/oauth/callback` đến API và biến `WEB_URL` trỏ về giao diện Nexus.
