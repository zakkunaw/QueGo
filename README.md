# QueueGo - Sistem Antrian Digital (MVP)

QueueGo adalah sistem antrian digital berbasis web yang dirancang khusus untuk usaha kecil seperti klinik, salon, barber shop, rumah makan, dan sejenisnya yang ingin mendigitalisasi sistem antrian manual mereka.

Proyek ini menggunakan arsitektur satu basis kode (single codebase) yang dapat dideploy ulang dengan cepat untuk klien baru hanya dengan mengubah file konfigurasi dan variabel lingkungan, tanpa menulis ulang kode program. Setiap klien akan mendapatkan instance database dan hosting mandiri (isolated instance).

---

## Alur Kerja Utama (MVP)

1. **Customer - Pengambilan Antrian**:
   - Customer memindai QR Code statis yang ditempel di lokasi toko/klinik.
   - Mengakses halaman web pendaftaran tanpa perlu mengunduh aplikasi apa pun.
   - Mengisi nama dan nomor WhatsApp (opsional), lalu menekan tombol daftar.
   - Masuk ke status "menunggu_konfirmasi" (belum mendapatkan nomor antrian resmi).
   - Diarahkan ke halaman status pribadi yang meminta customer untuk menunjukkan kehadiran fisiknya ke kasir/admin.

2. **Admin - Konfirmasi & Pemanggilan**:
   - Customer datang secara fisik ke kasir/meja pendaftaran.
   - Admin memeriksa daftar permintaan masuk (diurutkan berdasarkan waktu kedatangan pertama atau First-In, First-Out).
   - Admin memverifikasi kehadiran customer dan menekan tombol "Terima".
   - Status antrian berubah menjadi "aktif" dan sistem memberikan nomor antrian resmi. Halaman di browser customer akan otomatis terupdate secara real-time.
   - Saat tiba giliran pelayanan, admin menekan tombol "Panggil". Admin dapat mengirim notifikasi WhatsApp secara langsung melalui tautan wa.me yang ter-generate otomatis.
   - Setelah pelayanan selesai, admin menekan tombol "Selesai" untuk menutup sesi antrian customer tersebut.

---

## Pencegahan Spam dan Troll (Anti-Spam Layar)

Karena QR Code dipasang secara statis di lokasi dan secara teori dapat disebar ke luar area, sistem ini memiliki 3 lapis proteksi:
1. **Satu Perangkat, Satu Antrian Aktif**: Sidik jari perangkat (Device Fingerprint) disimpan di local storage untuk mencegah satu ponsel mendaftar berkali-kali secara bersamaan.
2. **Konfirmasi Admin**: Nomor antrian resmi hanya diterbitkan setelah admin memverifikasi kehadiran fisik di lokasi. Upaya pendaftaran spam dari luar lokasi hanya akan menumpuk di daftar "menunggu_konfirmasi" dan tidak akan mengganggu urutan antrian resmi.
3. **Pembersihan Otomatis**: Permintaan antrian yang berstatus "menunggu_konfirmasi" dan tidak dikonfirmasi oleh admin dalam waktu 15 menit akan otomatis kedaluwarsa (expired) dan dihapus dari daftar tunggu admin.

---

## Spesifikasi Teknologi

- **Frontend**: Next.js (React) versi 16
- **Styling**: Tailwind CSS
- **Database & Realtime**: Supabase (PostgreSQL + Realtime Channel)
- **Deployment**: Vercel
- **Notifikasi**: Tautan WhatsApp API gratis (wa.me)
- **QR Code Generator**: qrcode.react (Sisi Klien)

---

## Persyaratan Sistem

Pastikan perangkat Anda telah terpasang:
- Node.js versi 18 atau yang lebih baru
- npm (Node Package Manager)
- Akun Supabase (untuk database dan sistem realtime)
- Akun Vercel (untuk deployment produksi)

---

## Panduan Instalasi Lokal

### Langkah 1: Clone Repository
Masuk ke direktori proyek lokal Anda:
```bash
cd c:\xampp\htdocs\QueGo
```

### Langkah 2: Install Dependensi
Pindah ke folder aplikasi Next.js dan jalankan perintah install:
```bash
cd queuego
npm install
```

### Langkah 3: Setup Database di Supabase
1. Buat proyek baru di dashboard Supabase Anda.
2. Masuk ke menu **SQL Editor** di panel kiri Supabase.
3. Salin seluruh isi dari berkas `schema.sql` yang terletak di direktori root proyek ini (`../schema.sql`).
4. Tempelkan (paste) kode SQL tersebut ke dalam editor dan tekan tombol **Run**.
   Script ini akan membuat:
   - Tabel `queue` beserta indeks dan batasan datanya (constraints).
   - Fungsi PostgreSQL untuk submit antrian, konfirmasi antrian, pemanggilan, penandaan selesai, dan fungsi expire otomatis.
   - Kebijakan keamanan Row Level Security (RLS) untuk memisahkan hak akses customer dan admin.
   - Aktivasi modul publikasi realtime untuk sinkronisasi instan data antrian.
5. Daftarkan akun admin di menu **Authentication -> Users** pada dashboard Supabase dengan:
   - Email: `admin@queuego.local`
   - Password: [Buat password admin Anda, misalnya: demo123]
   - *Catatan*: Pastikan fitur **Confirm email** dinonaktifkan di menu Authentication -> Providers -> Email, agar akun admin langsung aktif tanpa konfirmasi email. Di menu Authentication -> Providers, aktifkan pula opsi **Anonymous Sign-ins** karena customer masuk secara anonim ke Supabase agar RLS berfungsi dengan aman.

### Langkah 4: Konfigurasi Variabel Lingkungan
1. Di dalam folder `queuego`, salin berkas `.env.example` menjadi `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
2. Buka `.env.local` dan isi nilainya sesuai dengan kredensial proyek Supabase Anda:
   - `NEXT_PUBLIC_SUPABASE_URL`: Diperoleh dari dashboard Supabase -> Project Settings -> API.
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Diperoleh dari dashboard Supabase -> Project Settings -> API.
   - `SUPABASE_SERVICE_ROLE_KEY`: Diperoleh dari dashboard Supabase -> Project Settings -> API (gunakan kunci rahasia ini dengan hati-hati).
   - `ADMIN_PASSWORD`: Isi dengan password yang sama dengan akun `admin@queuego.local` yang Anda buat pada langkah sebelumnya.

### Langkah 5: Konfigurasi Klien dan Branding
Ubah berkas `queuego/config.json` untuk menyesuaikan branding toko klien Anda:
```json
{
  "nama_toko": "Nama Toko / Klinik Klien",
  "warna_utama": "#1D9E75",
  "logo_url": "/logo.png",
  "nomor_wa_admin": "6281234567890",
  "admin_password": "PasswordAdminKlien"
}
```
*Keterangan parameter*:
- `nama_toko`: Nama usaha yang akan tampil di halaman depan dan dashboard admin.
- `warna_utama`: Kode warna HEX untuk branding antarmuka klien.
- `logo_url`: Tautan gambar logo toko (dapat diletakkan di folder `public/` seperti `/logo.png`).
- `nomor_wa_admin`: Nomor WhatsApp admin toko untuk keperluan pengiriman pesan (gunakan kode negara tanpa tanda plus, contoh: 6281234567890).
- `admin_password`: Password yang digunakan pada halaman login admin `/admin/login` (harus sinkron dengan konfigurasi di `.env.local`).

### Langkah 6: Jalankan Server Lokal
Jalankan perintah berikut untuk mengaktifkan server pengembangan Next.js:
```bash
npm run dev
```
Buka browser Anda dan akses:
- Halaman Customer: `http://localhost:3000`
- Halaman Login Admin: `http://localhost:3000/admin/login`
- Dashboard Admin: `http://localhost:3000/admin/dashboard`

---

## Panduan Deployment (Produksi)

### 1. Database Supabase
Pastikan database di instansi produksi Supabase telah di-setup menggunakan `schema.sql` dan akun admin telah dibuat seperti langkah-langkah di atas.

### 2. Aplikasi di Vercel
1. Hubungkan repositori GitHub Anda ke Vercel.
2. Tambahkan proyek baru di Vercel dan pilih folder proyek `queuego` sebagai Root Directory (atau atur build command sesuai struktur direktori).
3. Masukkan variabel lingkungan di dashboard Vercel sesuai isi berkas `.env.local` Anda:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ADMIN_PASSWORD`
4. Tekan tombol **Deploy**.
5. Setelah berhasil, unduh kode QR statis dari dashboard admin untuk dicetak dan diletakkan pada lokasi fisik klien.
