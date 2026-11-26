# Kế hoạch: mật khẩu, khuôn mặt và phân quyền

Trạng thái: đã triển khai; migration đã áp dụng vào DB local `nexus_ecm` ở localhost:5440

## Mục tiêu

Hoàn thiện onboarding tài khoản nhân viên, đăng ký lại khuôn mặt có kiểm soát, và phân quyền theo cấu trúc nhân sự hiện hành.

## Phạm vi và tiêu chí hoàn tất

1. **Đổi mật khẩu khởi tạo**
   - Tài khoản được tạo/cấp lại mật khẩu khởi tạo có `mustChangePassword`.
   - Sau đăng nhập, nhân viên thấy hộp thoại đổi mật khẩu; có thể đóng để làm sau.
   - Mở lại hộp thoại từ giao diện khi cờ vẫn còn; đổi thành công thì xóa cờ và không hỏi lại.
2. **Quản lý reset mật khẩu**
   - Trong chi tiết nhân viên, cạnh nút sửa có thao tác đặt mật khẩu tạm mới.
   - API cho phép người có quyền quản lý tài khoản đặt lại; buộc nhân viên đổi mật khẩu ở lần đăng nhập tiếp theo và thu hồi phiên cũ.
3. **Đăng ký khuôn mặt**
   - Nhân viên chưa có mẫu khuôn mặt được nhắc đăng ký bằng cửa sổ onboarding.
   - Nhân viên không thể tự thay mẫu đã đăng ký. Quản lý xóa mẫu trước; sau khi xóa, onboarding đăng ký hiện lại.
   - API cưỡng chế quy tắc, không chỉ ẩn nút trên giao diện; quản lý có thể xóa và đăng ký lại.
4. **Vai trò, quyền và tự gán vai trò**
   - Chỉ vai trò `ADMIN` có toàn quyền và không thể xóa; mọi vai trò còn lại có thể xóa.
   - Danh sách quyền bám theo module/thao tác đang khai báo trong app; không lưu hoặc hiển thị quyền cũ không còn tồn tại.
   - Cho cấu hình quy tắc tự gán vai trò theo phòng ban, chức vụ, chi nhánh; nhân viên khớp điều kiện nhận vai trò cấu hình.
   - Đồng bộ quyền ở API; giao diện là cấu hình và trạng thái phản ánh kết quả API.

## Thứ tự triển khai

1. Hoàn tất GitNexus impact trước khi sửa: auth, face, RBAC và `EmployeesService` ở cấp symbol đều LOW. Kiểm tra tổng hợp sau sửa báo CRITICAL vì 28 flow có symbol bị chạm; tập trung rà `EmployeesService.create/update` cho thấy caller thực tế là Excel apply và restore, các flow này cần đồng bộ role tự động theo yêu cầu.
2. Hoàn tất cờ đổi mật khẩu, API reset, cửa sổ onboarding sau login và thao tác reset ở hồ sơ nhân viên.
3. Hoàn tất giới hạn đăng ký face một lần, API tự đăng ký cho chính nhân viên, thao tác xóa của quản lý và cửa sổ đăng ký tự hiện lại.
4. Hoàn tất quyền ADMIN toàn quyền/không xóa, xóa mọi vai trò khác, đồng bộ danh mục quyền theo module app, và CRUD điều kiện tự gán vai trò. Quy tắc được áp vào tài khoản hiện có khi lưu và đồng bộ khi tạo/cập nhật nhân viên.
5. `pnpm db:generate`, `pnpm --filter @nexus/database migrate:deploy`, `pnpm typecheck` và `git diff --check` thành công. Chưa chạy test suite.

## Ghi chú an toàn

- Không đưa mật khẩu hoặc dữ liệu sinh trắc học thật vào seed/test/tài liệu.
- Mật khẩu tạm do quản lý đặt phải được đổi ở lần đăng nhập tiếp theo.
- Xóa mẫu khuôn mặt phải xóa cả ảnh mẫu lưu trữ; giữ log kiểm toán, không xóa lịch sử chấm công.
- Xóa vai trò ngoài `ADMIN` sẽ gỡ vai trò đó khỏi tài khoản đang được gán.
- Trước khi phát hành ở môi trường khác, chạy migration deploy để tạo bảng quy tắc và đồng bộ catalog quyền.
