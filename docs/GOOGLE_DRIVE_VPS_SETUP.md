# Google Drive cá nhân và di chuyển dữ liệu trên VPS

## Kết nối tài khoản cá nhân

1. Sao lưu PostgreSQL và MinIO trước khi nâng cấp.
2. Deploy API/web cùng migration `20261128180000_google_drive_personal_oauth_only`. Nếu cấu hình cũ dùng Service Account mà chưa có OAuth hợp lệ, app sẽ tự chọn MinIO.
3. Đăng nhập tài khoản có quyền `settings:update`, mở **Cài đặt → Lưu trữ**.
4. Cấu hình Google Drive API và OAuth Client loại Web application theo `docs/GOOGLE_DRIVE_OAUTH_PERSONAL_SETUP.md`. Dùng redirect URI HTTPS mà Nexus hiển thị.
5. Nhập folder ID trong My Drive, Client ID và Client Secret; bấm **Lưu và kết nối Google** rồi chấp thuận quyền truy cập bằng tài khoản cá nhân.
6. Kiểm tra kết nối, sau đó chọn **Lưu trên Google Drive**. Thử tải lên, xem và xóa một ảnh/tài liệu.
7. Giữ `FACE_ENCRYPTION_KEY` ổn định qua các lần deploy và backup để giải mã OAuth secret/refresh token.

## Chuyển file MinIO sang Drive

Chọn Google Drive trong giao diện trước khi chạy lệnh. Lệnh mặc định chỉ lập báo cáo, không thay đổi file:

```powershell
docker compose -f docker/docker-compose.prod.yml exec api node apps/api/dist/core/storage/migrate-storage-to-google-drive.js
```

Thực hiện chuyển và giữ bản MinIO:

```powershell
docker compose -f docker/docker-compose.prod.yml exec api node apps/api/dist/core/storage/migrate-storage-to-google-drive.js --execute
```

Chỉ xóa object MinIO khi đã backup và xác nhận báo cáo hash/kích thước:

```powershell
docker compose -f docker/docker-compose.prod.yml exec api node apps/api/dist/core/storage/migrate-storage-to-google-drive.js --execute --delete-minio
```

## Rollback và dữ liệu cũ

- Có thể chọn lại **Lưu trên máy chủ (MinIO)** trong giao diện nếu bản sao VPS vẫn còn.
- Migration không xóa object trong Google Drive. Tuy vậy, các file cũ trong Shared Drive không còn truy cập được sau khi gỡ Service Account; cần chuyển chúng sang My Drive cá nhân trước khi nâng cấp.
- Không xóa bản MinIO backup cho đến khi đã kiểm tra các ảnh/tài liệu cũ trong ứng dụng.

VPS cần truy cập được Google Drive API qua HTTPS/DNS. Tệp Drive vẫn đi qua API Nexus bằng URL HMAC; app không lưu URL Drive công khai.
