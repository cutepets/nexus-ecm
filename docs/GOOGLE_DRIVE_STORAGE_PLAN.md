# Kế hoạch và phạm vi lưu trữ Google Drive

## Mục tiêu

- Chỉ hỗ trợ Google Drive bằng OAuth của tài khoản Google cá nhân trong My Drive.
- Giữ MinIO tự lưu trên VPS để dùng làm kho hiện tại, phương án chuyển đổi và đường đọc các tệp cũ.
- Chỉ bật lựa chọn Google Drive sau khi API xác nhận quyền đọc, tạo và xóa tệp trong thư mục đã chọn.
- API Nexus tiếp tục kiểm soát quyền tải lên và tải xuống; không tạo liên kết Drive công khai.

## Thiết kế hiện tại

1. `StorageService` giữ contract chung cho upload, download và delete. Upload mới đi theo provider đã chọn; khi đọc, Drive được kiểm tra trước rồi mới fallback về MinIO.
2. Tài khoản Google cá nhân kết nối bằng OAuth. OAuth Client Secret và refresh token được mã hóa trong database. State callback dùng một lần và hết hạn sau 10 phút.
3. `GET /settings/storage`, các endpoint `storage/google-drive/oauth/*`, `storage/google-drive/test` và `storage/provider` phục vụ cấu hình. Quyền được giới hạn bằng `settings:read`/`settings:update`.
4. MinIO vẫn được giữ vì đang chứa tệp hiện hữu và cho phép rollback. Công cụ migration sang Drive có dry-run mặc định, xác minh hash/kích thước và chỉ xóa bản MinIO khi truyền cờ riêng.
5. Không còn hỗ trợ Service Account, Shared Drive hay cấu hình Google Drive qua biến môi trường.

## Chuyển phiên bản

Migration `20261128180000_google_drive_personal_oauth_only` xóa cột và kiểu dữ liệu chỉ dành cho Service Account/Shared Drive. Nếu Drive đang được chọn nhưng chưa có OAuth cá nhân hoàn chỉnh, migration chuyển provider về MinIO. Kết nối OAuth cá nhân hợp lệ được giữ lại; cần giữ nguyên `FACE_ENCRYPTION_KEY` để giải mã credential đã lưu.

Tệp từng lưu trong Shared Drive không được chuyển hoặc xóa bởi migration, nhưng Nexus sẽ không còn truy cập chúng bằng Service Account. Nếu có dữ liệu như vậy, cần tải/chuyển dữ liệu sang My Drive cá nhân trước khi nâng cấp.

## Vận hành

- Cấu hình Google Drive cá nhân: `docs/GOOGLE_DRIVE_OAUTH_PERSONAL_SETUP.md`.
- Cấu hình VPS, backup, dry-run và di chuyển MinIO: `docs/GOOGLE_DRIVE_VPS_SETUP.md`.
- Việc chọn Google Drive không tự di chuyển các object cũ khỏi MinIO. Chỉ xóa MinIO sau backup và sau khi xác minh kết quả migration.

## Tiến độ

- [x] OAuth tài khoản Google cá nhân, bảo vệ callback và mã hóa credential.
- [x] Kiểm tra quyền đọc/ghi trước khi cho chọn Drive.
- [x] Dọn Service Account, Shared Drive, API/UI và cấu hình môi trường legacy.
- [x] Giữ lại MinIO để tương thích kho VPS và fallback file cũ.
- [ ] Xác minh kết nối bằng tài khoản Google cá nhân trên môi trường triển khai.
- [ ] Backup và chuyển dữ liệu MinIO nếu muốn giảm dung lượng VPS.
