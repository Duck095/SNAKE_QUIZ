# Snake Quiz

Game rắn hỏi đáp dùng React, Vite, TypeScript, Express và JSON cục bộ.

## Chạy ứng dụng

```bash
npm install
npm run dev
```

Mở URL Vite hiện trong terminal (thường là `http://localhost:5173`). API Express chạy ở `http://localhost:3001`. Build production bằng `npm run build`; chạy API và thư mục `dist` bằng `npm start` (mặc định cổng 3001).

## Dữ liệu mẫu

- Thay câu hỏi trong [server/questions.json](server/questions.json). Mỗi câu gồm `id`, `question`, `answers` và `correctIndex` (đếm từ 0).
- Thay danh sách ví dụ trong [server/valid-codes.json](server/valid-codes.json) bằng mã dự thi được phép dùng.
- Mỗi lượt được ghi trong `server/data/plays.json`; thư mục và tệp sẽ tự tạo khi có lượt đầu tiên.
- Âm thanh phát bằng synth khi chưa có file. Thay âm bằng cách thêm `public/sounds/correct.mp3`, `wrong.mp3`, `speed.mp3`, `combo.mp3` và `game-over.mp3`.
- Trang quản trị tại `/admin`, bảo vệ bằng HTTP Basic. Mật khẩu cục bộ được đặt trong `server/.env` bằng `ADMIN_PASSWORD`; khởi động lại server sau khi thay đổi. Có thể cấu hình `ADMIN_PASSWORD` trong môi trường deploy thay cho file cục bộ. Nút **Reset lượt** xóa toàn bộ lịch sử và leaderboard để cấp lại 4 lượt cho mọi người; CSV được xuất từ nút **Xuất CSV**.
- Lượt đang chơi gửi heartbeat; server tự kết thúc lượt nếu không có hoạt động trong 60 giây.

## Kiểm tra

```bash
npm test
npm run build
```

## Deploy trên Railway

Railway chạy một Express service cho cả React và API. Dữ liệu lượt chơi ghi vào `DATA_DIR/plays.json`; khi chạy local, mặc định là `server/data/plays.json`.

1. Trong Railway, tạo một project mới và chọn **Deploy from GitHub repo**. Kết nối repository `Duck095/SNAKE_QUIZ` và để root directory tại thư mục gốc repository. `railway.json` đặt build command là `npm run build` và start command là `npm start`.
2. Trong service, thêm một Railway Volume với mount path `/data`.
3. Trong Variables, đặt `DATA_DIR=/data` và `ADMIN_PASSWORD` thành mật khẩu quản trị. Railway cấp `PORT`; Express tự đọc giá trị này khi khởi động. Không đưa `server/.env` lên GitHub.
4. Deploy service, sau đó vào **Settings → Networking → Public Networking → Generate Domain** để tạo URL HTTPS `*.up.railway.app`.
5. Giữ service ở một replica vì lượt chơi đang dùng một file JSON và hàng tuần tự trong một tiến trình.

Railway tự deploy các commit mới từ repository đã kết nối. Sau deploy, mở URL trên hai máy tính và bắt đầu lượt ở cả hai máy; leaderboard phải cập nhật trên cả hai. Trên cùng một browser ID, kiểm tra lượt thứ tư được chấp nhận và lượt thứ năm bị từ chối. Sau đó restart service và xác nhận leaderboard/lượt vẫn còn trong Admin. Volume Railway giữ dữ liệu qua restart và deploy mới; không xóa volume nếu cần giữ lịch sử.

Chi tiết nền tảng: [kết nối GitHub và auto-deploy](https://docs.railway.com/deployments/github-autodeploys), [Railway Volumes](https://docs.railway.com/volumes), [biến môi trường](https://docs.railway.com/variables).
