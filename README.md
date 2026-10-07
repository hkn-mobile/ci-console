# CI Console

Web quản lý secret GitHub Actions cho tất cả app ở một chỗ, thay vì vào từng repo. Dùng chung với các workflow trong [`hkn-mobile/ci-templates`](https://github.com/hkn-mobile/ci-templates).

- **Tổng quan**: bảng app × secret, cho biết secret nào đã có (kèm lần cập nhật cuối) và secret nào còn thiếu.
- **Từng secret**: đặt hoặc đổi giá trị cho nhiều app cùng lúc, hoặc xoá.
- **Bộ keystore**: chọn file `.jks` và `key.properties`, điền một lần cả 4 secret ký app.
- **Phát hành**: chạy workflow `android-release.yml` của từng app (chạy thử hoặc đẩy lên Google Play), xem 5 lần chạy gần nhất; trang tự làm mới khi có lần chạy đang diễn ra.

Web **không lưu giá trị secret**. Giá trị được mã hoá bằng public key của từng repo rồi gửi thẳng lên GitHub; GitHub chỉ cho ghi, không cho đọc lại. Hãy giữ bản gốc (keystore, mật khẩu, file JSON) trong trình quản lý mật khẩu.

## Cài đặt

Yêu cầu Node.js 20 trở lên.

```bash
npm install
cp .env.example .env.local
```

Điền `.env.local`:

| Biến | Giá trị |
|---|---|
| `GITHUB_TOKEN` | Fine-grained token (xem bên dưới) |
| `CONSOLE_PASSWORD` | Mật khẩu vào web (tên đăng nhập `admin`). Bắt buộc; chưa đặt thì web từ chối mọi request |
| `CONSOLE_DEMO` | `1` để thử giao diện với kho lưu tạm trong bộ nhớ, không gọi GitHub |

### Thêm app

Cấp quyền repo cho token trên GitHub (sửa token → *Repository access* → chọn thêm repo), rồi tải lại trang Tổng quan. Repo mới hiện ở mục **Repo chưa có trong danh sách**: đặt tên hiển thị và bấm **Thêm**. Repo không phải app (ví dụ `ci-templates`) thì bấm **Ẩn**. Web chỉ gợi ý repo mà token có quyền Secrets, và kiểm tra lại quyền đó trước khi thêm.

**Bỏ khỏi danh sách** ở từng app chỉ xoá app khỏi web, không đụng tới secret trên GitHub.

Các thao tác trên ghi vào `console.config.json`; có thể sửa tay file này:

```json
{
  "apps": [
    { "name": "CoolKa", "repo": "hkn-mobile/ac_remote_control" }
  ],
  "ignored": ["hkn-mobile/ci-templates"]
}
```

Sửa file này là web nhận ngay, không cần chạy lại.

### Tạo fine-grained token

1. GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. **Resource owner**: organization giữ các repo app (`hkn-mobile`).
3. **Expiration**: đặt ngày hết hạn (ví dụ 90 ngày) và nhớ gia hạn.
4. **Repository access** → *Only select repositories* → chọn các repo app có trong `console.config.json`.
5. **Permissions → Repository permissions**:
   - **Secrets** → *Read and write* (trang Tổng quan, Bộ keystore).
   - **Actions** → *Read and write* (trang Phát hành). Không cần nếu không dùng trang này.
6. Tạo token, dán vào `GITHUB_TOKEN` trong `.env.local`.


## Chạy

```bash
npm run build
npm run start -- -H 127.0.0.1 -p 3100
```

Mở http://127.0.0.1:3100, đăng nhập `admin` / `CONSOLE_PASSWORD`. Khi phát triển giao diện dùng `npm run dev`.

`-H 127.0.0.1` giữ web chỉ mở trên máy này. Muốn cho người khác trong mạng dùng thì đưa lên server nội bộ có HTTPS; web có quyền ghi secret của mọi app nên đừng mở ra Internet chỉ với mật khẩu này.

## Triển khai lên server

Web đang chạy trên server `hkn` (Ubuntu, Docker) ở cổng riêng **3100**, chỉ dùng trong mạng nội bộ:

```
http://192.168.1.57:3100
```

Nó chạy bằng `docker compose` riêng trong `~/ci-console`, không dùng chung gì với các stack khác trên server.

| Trên server | Nội dung |
|---|---|
| `~/ci-console/.env` | `GITHUB_TOKEN`, `CONSOLE_PASSWORD`, `CONSOLE_DEMO=0` (quyền 600) |
| `~/ci-console/data/console.config.json` | Danh sách app; sửa trên web hoặc sửa tay |
| `~/ci-console/data/builds/` | File APK/AAB đã lưu, mỗi lần chạy một thư mục |

Cập nhật code lên server:

```bash
scripts/deploy.sh
```

Script chỉ chép code và build lại container; không đụng `.env` và `data/` trên server. Đổi token hay mật khẩu: sửa `~/ci-console/.env` trên server rồi chạy `docker compose up -d` trong thư mục đó.

## Bản build

Khi trang **Phát hành** hoặc **Bản build** được mở, web hỏi GitHub các lần chạy gần nhất và tải về server những bản build thành công chưa lưu (APK từ Android CI, AAB từ Android Release). Không có gì chạy ngầm định kỳ. File được giữ lại kể cả khi GitHub đã xoá artifact (14 ngày với CI, 30 ngày với Release).

- Bản đã đẩy lên Google Play được giữ mãi; các bản khác giữ 30 bản mới nhất mỗi app (`CONSOLE_KEEP_BUILDS`).
- APK có mã QR để cài thẳng từ điện thoại trong mạng công ty.

## Thêm loại secret

Danh mục secret nằm trong `src/lib/catalog.ts`. Thêm một mục mới (tên, nhãn, kiểu nhập) là cột mới xuất hiện ở trang Tổng quan.

## Cấu trúc

| File | Vai trò |
|---|---|
| `src/proxy.ts` | Chặn mọi trang và Server Action sau HTTP Basic auth |
| `src/app/actions.ts` | Server Action đặt, xoá secret và bộ keystore; kiểm tra lại quyền và chỉ chấp nhận repo có trong config |
| `src/lib/github.ts` | Gọi GitHub API (và kho demo trong bộ nhớ) |
| `src/lib/seal.ts` | Mã hoá giá trị bằng libsodium sealed box, đúng định dạng GitHub yêu cầu |
| `src/lib/catalog.ts` | Danh mục secret mà workflow trong `ci-templates` đọc |
