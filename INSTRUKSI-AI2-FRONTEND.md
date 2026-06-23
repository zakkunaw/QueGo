# Instruksi untuk AI 2 — Frontend (Next.js + Tailwind)

## Peran kamu
Kamu bertugas membangun **seluruh tampilan/UI** untuk QueueGo, sistem antrian digital MVP. Ada AI lain yang sudah/sedang membangun backend dan struktur database di Supabase secara terpisah — kamu akan diberikan "kontrak data" (nama tabel, kolom, dan fungsi yang tersedia) yang HARUS kamu pakai apa adanya, jangan mengubah struktur data sendiri.

**Wajib pakai Tailwind CSS** untuk semua styling. Jangan pakai CSS vanilla/custom CSS file kecuali benar-benar tidak bisa dihindari (misal animasi kompleks tertentu). Tujuannya supaya development cepat dan konsisten.

---

## Konteks produk (ringkas dari PRD)

QueueGo adalah sistem antrian digital untuk satu toko (klinik, salon, resto kecil), diakses lewat browser (tidak perlu install app). Alur penggunanya:

**Customer:**
1. Scan QR code (poster statis) → buka halaman web.
2. Inisialisasi **Anonymous Sign-In** di Supabase (`supabase.auth.signInAnonymously()`) untuk mendapatkan session terautentikasi (syarat wajib RLS agar data tidak kosong).
3. Isi nama (+ nomor WA opsional) → submit.
4. Masuk status "menunggu konfirmasi" — BELUM dapat nomor resmi, hanya pesan "Permintaan terkirim, tunjukkan ke kasir".
5. Customer jalan ke kasir, admin konfirmasi kehadiran secara fisik.
6. Begitu admin konfirmasi, halaman customer otomatis update (realtime, tanpa refresh) menampilkan nomor antrian resmi dan posisi dalam antrian.
7. Saat dipanggil, halaman update lagi menampilkan status "Dipanggil, silakan ke loket" (dan tombol/link WA opsional jika nomor WA diisi).

**Admin/staff toko:**
1. Login dengan password sederhana (1 password per toko, simpan di env variable, verifikasi di server API Next.js).
2. Setelah sukses verifikasi di API server, jalankan **login ke Supabase Auth di sisi browser** (`supabase.auth.signInWithPassword`) menggunakan email statis `admin@queuego.local` agar RLS ter-bypass dan browser client diizinkan membaca semua data secara realtime.
3. Dashboard menampilkan DUA daftar terpisah:
   - **Daftar permintaan masuk** (status `menunggu_konfirmasi`), urut dari yang paling lama menunggu di atas (FIFO), dengan tombol "Terima" per baris.
   - **Daftar antrian aktif** (status `aktif` dan `dipanggil`), dengan tombol "Panggil" dan "Selesai".
4. Kedua daftar HARUS realtime — update otomatis tanpa refresh manual saat ada perubahan data.
5. Saat klik "Panggil", generate link `wa.me/<nomor_wa>?text=<pesan>` otomatis (jika nomor WA tersedia).
6. Tombol "Reset/tutup antrian harian" (opsional, bisa berupa konfirmasi sederhana — ingat ini HANYA mempengaruhi tampilan/filter tanggal, BUKAN menghapus data).

---

## Halaman yang harus dibangun

### 1. Halaman customer — ambil antrian (`/`)
- Tampilkan nama toko, logo, warna sesuai branding (lihat bagian "Konfigurasi per klien" di bawah)
- Form sederhana: nama (wajib), nomor WA (opsional)
- Tombol submit yang jelas, besar, mobile-friendly (asumsikan ini dibuka dari HP)
- Tampilkan pesan error yang jelas jika submit ditolak (misal karena device sudah punya permintaan aktif)
- Setelah submit sukses, redirect ke halaman status

### 2. Halaman customer — status pribadi (`/status/[id]`)
- Tampilan berbeda untuk tiap status:
  - `menunggu_konfirmasi`: "Permintaan terkirim, tunjukkan halaman ini ke kasir"
  - `aktif`: tampilkan nomor antrian besar dan jelas, plus estimasi posisi ("ada X orang sebelum Anda")
  - `dipanggil`: "Nomor Anda dipanggil! Silakan ke loket" (visual mencolok, misal warna berbeda/animasi sederhana)
  - `selesai`: "Terima kasih, antrian selesai"
  - `expired`: "Permintaan kedaluwarsa, silakan scan ulang QR di lokasi"
- Halaman ini HARUS subscribe ke realtime update dari Supabase (detail koneksi akan diberikan dalam kontrak data dari AI backend)

### 3. Halaman admin — login (`/admin/login`)
- Form password sederhana
- Setelah berhasil, set session/cookie, redirect ke dashboard

### 4. Halaman admin — dashboard (`/admin/dashboard`)
- Dua seksi/tabel terpisah seperti dijelaskan di atas
- Setiap baris di "daftar permintaan masuk" tampilkan: nama, waktu submit (relatif, misal "5 menit lalu"), tombol "Terima"
- Setiap baris di "daftar antrian aktif" tampilkan: nomor, nama, status, tombol aksi sesuai status (Panggil/Selesai)
- Desain harus jelas dibaca cepat dari jarak (asumsikan dibuka di tablet kasir), gunakan ukuran font besar dan kontras warna yang baik
- Tombol "Reset antrian harian" di pojok, dengan dialog konfirmasi sebelum dijalankan

### 5. Halaman generate QR code (`/admin/qr`)
- Tampilkan QR code yang mengarah ke halaman customer (`/`)
- Tombol download sebagai gambar (PNG) resolusi cukup tinggi untuk dicetak sebagai poster
- Bisa pakai library seperti `qrcode.react` atau sejenis

---

## Konfigurasi per klien (branding)

Buat sistem config terpusat (misal `config.json` atau file konstanta) yang berisi:
```json
{
  "nama_toko": "Nama Toko",
  "warna_utama": "#1D9E75",
  "logo_url": "/logo.png",
  "nomor_wa_admin": "6281234567890"
}
```
Semua halaman harus membaca dari file config ini untuk styling (warna utama Tailwind via CSS variable atau theme extend), nama toko, dan logo — JANGAN hardcode nama/warna di banyak file berbeda. Saat ganti klien, hanya file ini yang diubah.

---

## Yang TIDAK perlu kamu kerjakan
- Tidak perlu membuat schema database atau RLS — itu sudah/akan dikerjakan AI backend, kamu hanya konsumsi
- Tidak perlu memvalidasi logic anti-spam di sisi frontend secara mendalam (cukup tampilkan pesan error yang dikembalikan backend) — validasi sesungguhnya ada di server/database
- Tidak perlu sistem login admin multi-user, payment gateway, atau WhatsApp API resmi

## Stack yang wajib dipakai
- Next.js (App Router)
- Tailwind CSS untuk SEMUA styling
- Supabase client SDK untuk koneksi data + realtime
- Library QR code generator (boleh pilih yang paling ringan, misal `qrcode.react`)

## Pertanyaan untuk saya jawab balik (kalau ada ambiguitas)
Jika kontrak data dari AI backend belum saya berikan atau ada bagian yang tidak jelas (misal nama fungsi atau format response), tanyakan ke saya dulu sebelum membuat asumsi struktur data sendiri.
