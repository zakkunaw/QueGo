# Instruksi untuk AI 1 — Backend & Database (Supabase)

## Peran kamu
Kamu bertugas membangun **layer backend dan database** untuk QueueGo, sistem antrian digital MVP. Ada AI lain yang akan membangun frontend secara terpisah dan akan mengonsumsi struktur data yang kamu buat — jadi **konsistensi nama tabel, kolom, dan fungsi sangat penting**, jangan diubah di tengah jalan tanpa alasan kuat.

Kamu TIDAK perlu membangun tampilan/UI. Fokus murni ke: schema database, fungsi-fungsi logic, dan keamanan (RLS).

---

## Konteks produk (ringkas dari PRD)

QueueGo adalah sistem antrian digital untuk satu toko (klinik, salon, resto kecil). Alurnya:
1. Customer scan QR statis → submit permintaan antrian → status awal `menunggu_konfirmasi` (BUKAN nomor resmi langsung)
2. Admin toko mengonfirmasi kehadiran fisik customer di kasir → status berubah `aktif`, nomor antrian resmi baru di-assign di titik ini
3. Admin memanggil nomor → status `dipanggil`
4. Admin menandai selesai → status `selesai`
5. Permintaan yang tidak dikonfirmasi admin dalam 15 menit → otomatis `expired`

Ini didesain sengaja begini untuk mencegah orang iseng (troll) mengambil nomor antrian dari rumah tanpa datang ke lokasi. QR-nya statis (dicetak sebagai poster), jadi siapa pun bisa scan dari mana saja — makanya nomor resmi hanya keluar setelah admin konfirmasi kehadiran fisik.

---

## Tugas teknis yang harus kamu kerjakan

### 1. Buat skema tabel `queue` di Supabase (SQL)

Kolom yang dibutuhkan:
- `id` — bigint, identity, primary key
- `tanggal_antrian` — date, tanggal antrian berbasis timezone WIB (Asia/Jakarta), bukan UTC
- `nomor` — int, nullable, nomor antrian resmi dalam `tanggal_antrian` tersebut (NULL sebelum dikonfirmasi admin)
- `nama_customer` — text, opsional
- `nomor_wa` — text, opsional
- `status` — text, salah satu dari: `menunggu_konfirmasi`, `aktif`, `dipanggil`, `selesai`, `expired`
- `device_fingerprint` — text, identifier device dari frontend (cookie/local storage id)
- `user_id` — uuid, nullable, mencatat auth.uid() milik peranti customer (Anonymous Sign-In) untuk RLS
- `requested_at` — timestamptz, default now()
- `confirmed_at` — timestamptz, nullable

Tambahkan index yang masuk akal untuk query yang sering dipakai (filter by `tanggal_antrian` + `status`, lookup by `device_fingerprint`, dan lookup by `user_id`).

### 2. Aktifkan Supabase Realtime untuk tabel ini
Tabel `queue` harus bisa di-subscribe realtime dari frontend (untuk update otomatis tanpa refresh).

### 3. Buat fungsi/logic berikut (sebagai SQL function/RPC):

**a. Fungsi submit permintaan baru (`submit_antrian`)**
- Input: `p_nama_customer` (text), `p_nomor_wa` (text - opsional), `p_device_fingerprint` (text)
- Return: `jsonb` dengan format `{"success": true, "data": {"id": <id>}}` untuk memudahkan redirect di frontend.
- Validasi: tolak jika `p_device_fingerprint` yang sama sudah punya baris dengan status `menunggu_konfirmasi`, `aktif`, atau `dipanggil` pada `tanggal_antrian` hari ini (WIB).
- Jika valid: bersihkan antrian basi via `expire_old_requests()`, lalu masukkan data dengan `user_id` = `auth.uid()`.

**b. Fungsi konfirmasi kehadiran oleh admin ("Terima") (`konfirmasi_antrian`)**
- Input: `p_id` (bigint)
- Return: `public.queue`
- Hitung `nomor` baru = (jumlah baris dengan status `aktif`/`dipanggil`/`selesai` pada `tanggal_antrian` yang sama) + 1. Menggunakan `LOCK TABLE public.queue IN SHARE ROW EXCLUSIVE MODE` untuk mencegah race condition.
- Update baris: `status` = `aktif`, `nomor` = hasil hitungan, `confirmed_at` = now().

**c. Fungsi panggil nomor (`panggil_antrian`)**
- Input: `p_id` (bigint)
- Return: `public.queue`
- Update `status` = `dipanggil`.

**d. Fungsi tandai selesai (`selesai_antrian`)**
- Input: `p_id` (bigint)
- Return: `public.queue`
- Update `status` = `selesai`.

**e. Fungsi auto-expire (`expire_old_requests`)**
- Baris dengan `status = menunggu_konfirmasi` dan `requested_at` lebih dari 15 menit yang lalu → ubah jadi `status = expired`. Dipanggil secara hibrida di dalam `submit_antrian` dan aksi admin.

### 4. Row Level Security (RLS)
- Customer (anon/public) menggunakan **Anonymous Sign-In** dari Supabase Auth. Kebijakan SELECT membatasi hanya bisa melihat baris data miliknya sendiri (`auth.uid() = user_id`).
- Admin masuk menggunakan satu akun khusus (`admin@queuego.local` dengan password dari config) di Supabase Auth. Kebijakan SELECT membolehkan admin membaca seluruh baris data (`auth.jwt() ->> 'email' = 'admin@queuego.local'`).
- Modifikasi data (INSERT/UPDATE) dilakukan via RPC database functions yang berjalan sebagai `SECURITY DEFINER` (admin bypass RLS, customer terproteksi logic).

### 5. Dokumentasikan "kontrak data" untuk AI frontend
Di akhir, buatkan berkas `KONTRAK-DATA.md` yang merinci skema tabel, fungsi RPC, realtime, dan contoh kode integrasi JS SDK.

---

## Yang TIDAK perlu kamu kerjakan
- Tidak perlu membuat UI/halaman apa pun
- Tidak perlu sistem login Supabase Auth penuh (cukup mekanisme password sederhana yang dijelaskan di RLS)
- Tidak perlu payment gateway, WhatsApp API resmi, atau multi-tenant — itu di luar scope MVP ini

## Pertanyaan untuk saya jawab balik (kalau ada ambiguitas)
Kalau ada keputusan desain yang tidak jelas dari instruksi ini, tanyakan ke saya sebelum lanjut, jangan asumsi sendiri terutama untuk bagian RLS dan auto-expire.
