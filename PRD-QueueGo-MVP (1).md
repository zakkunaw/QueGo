# PRD: QueueGo — Sistem Antrian Digital (MVP)

## 1. Latar belakang & tujuan

QueueGo adalah sistem antrian digital berbasis web yang ditujukan untuk usaha kecil (klinik, salon, tempat cukur, resto kecil) yang masih mengelola antrian secara manual.

**Tujuan MVP:** membangun satu basis kode (codebase) yang bisa di-deploy ulang dengan cepat untuk klien baru, hanya dengan mengubah konfigurasi (bukan menulis ulang kode). Setiap klien mendapat instance terpisah, bukan sistem multi-tenant otomatis.

**Model bisnis di fase ini:** jual sebagai jasa setup + deploy ke tiap toko (one-time fee atau subscription kecil), bukan SaaS self-serve.

**Yang TIDAK dibangun di MVP ini** (sengaja dikecualikan agar scope tetap kecil):
- Sistem pendaftaran/login mandiri untuk toko baru
- Payment gateway / billing otomatis
- Multi-cabang dalam satu akun
- Aplikasi mobile native
- WhatsApp Business API resmi (pakai pendekatan link `wa.me`, lihat bagian 5)

---

## 2. User & peran

| Peran | Kebutuhan |
|---|---|
| Customer | Ambil nomor antrian tanpa install app, tahu posisi antrian, dapat notifikasi saat dipanggil |
| Admin/staff toko | Lihat daftar antrian real-time, panggil nomor, tandai selesai |
| Kamu (operator/builder) | Deploy cepat ke klien baru, ubah branding minimal effort |

---

## 3. User flow utama

**Catatan penting:** QR code di lokasi bersifat STATIS (dicetak sebagai poster, tidak berubah-ubah). Karena QR statis bisa di-screenshot dan disebar, sistem TIDAK langsung memberi nomor antrian resmi saat scan. Ada status perantara `menunggu_konfirmasi` di mana admin yang memverifikasi kehadiran fisik customer sebelum nomor resmi diberikan. Lihat bagian 3.1 untuk detail anti-troll/anti-spam.

**Flow customer:**
1. Scan QR code statis di lokasi toko (poster, tidak berubah)
2. Buka halaman web (tanpa install apa pun), isi nama (opsional nomor WA)
3. Klik "Daftar antrian" → masuk status `menunggu_konfirmasi` (BUKAN nomor resmi)
4. Diarahkan ke halaman status pribadi yang menampilkan pesan "Permintaan terkirim, tunjukkan ke kasir"
5. Customer datang ke kasir seperti biasa
6. Admin konfirmasi kehadiran → status berubah jadi `aktif`, nomor antrian resmi baru diberikan di titik ini
7. Halaman status customer otomatis update (realtime) jadi menampilkan nomor resmi dan posisi antrian
8. Saat dipanggil, status berubah jadi `dipanggil` (dan customer dapat link WA jika nomor diisi)
9. Pembayaran dan transaksi tetap dilakukan manual di kasir seperti biasa — sistem ini hanya mengatur urutan antrian, bukan order/pembayaran

**Flow admin:**
1. Login sederhana (password tunggal per toko, bukan multi-user)
2. Lihat dua daftar terpisah di dashboard:
   - **Daftar permintaan masuk** (`menunggu_konfirmasi`) — diurutkan dari yang paling lama menunggu di atas
   - **Daftar antrian aktif** (`aktif`, `dipanggil`) — nomor resmi yang sudah dikonfirmasi
3. Saat customer berdiri di kasir, admin klik "Terima" pada permintaan **paling atas** di daftar permintaan masuk (admin tidak perlu mencari nama — proses berdasarkan urutan waktu + kehadiran fisik, lihat 3.1)
4. Permintaan pindah ke daftar antrian aktif dengan nomor resmi
5. Klik "Panggil" pada satu baris di antrian aktif → status berubah, opsional klik tombol kirim WA
6. Klik "Selesai" setelah customer dilayani
7. Opsional: tombol "Reset antrian harian" di akhir hari

### 3.1 Pencegahan troll & spam (QR statis)

Karena QR bersifat statis dan bisa diakses dari mana saja (termasuk dari rumah tanpa datang ke lokasi), MVP menerapkan 3 lapis pencegahan:

| Lapis | Mekanisme | Tujuan |
|---|---|---|
| 1. Satu device, satu permintaan aktif | Fingerprint device (cookie/local storage) dicek sebelum izinkan submit baru | Mencegah satu orang spam berkali-kali dari HP yang sama |
| 2. Urutan waktu, bukan nama | Daftar permintaan masuk diurutkan FIFO (paling lama di atas); admin memproses berdasarkan urutan + kehadiran fisik, bukan mencari nama tertentu | Admin tidak bingung memilah nama asli vs spam meski ada entri sampah |
| 3. Auto-hapus permintaan basi | Permintaan dengan status `menunggu_konfirmasi` yang tidak dikonfirmasi admin dalam 15 menit otomatis terhapus/expired | Mencegah daftar permintaan menumpuk jadi panjang dan berantakan |

**Prinsip desain kunci:** nomor antrian resmi HANYA diberikan setelah admin mengonfirmasi kehadiran fisik. Troll yang scan dari rumah maksimal hanya membuat entri di "daftar permintaan masuk" yang terpisah dari antrian aktif — tidak pernah mengganggu nomor antrian customer yang asli.

---

## 4. Fitur MVP (in-scope)

### 4.1 Halaman customer
- [ ] Landing page daftar antrian (form nama + nomor WA opsional)
- [ ] Submit masuk status `menunggu_konfirmasi`, BUKAN langsung dapat nomor resmi
- [ ] Validasi: satu device hanya bisa punya satu permintaan aktif (fingerprint device)
- [ ] Halaman status pribadi, realtime update (pesan berbeda untuk tiap status: menunggu konfirmasi / aktif / dipanggil / selesai)
- [ ] Setelah dikonfirmasi admin, tampilkan nomor resmi dan posisi antrian

### 4.2 Dashboard admin
- [ ] Login password sederhana (1 password per instance/toko)
- [ ] **Daftar permintaan masuk** — list status `menunggu_konfirmasi`, urut FIFO (paling lama di atas), tombol "Terima" per baris
- [ ] **Daftar antrian aktif** — list status `aktif` dan `dipanggil`, realtime (auto-update tanpa refresh)
- [ ] Tombol "Panggil" pada antrian aktif → ubah status + generate link `wa.me` otomatis
- [ ] Tombol "Selesai" → ubah status, keluar dari daftar aktif
- [ ] Auto-expire permintaan masuk yang tidak dikonfirmasi dalam 15 menit
- [ ] Tombol reset/tutup antrian harian

### 4.3 Branding per klien (config-driven)
- [ ] Nama toko, logo, warna utama bisa diatur lewat satu file config (bukan ubah kode di banyak tempat)
- [ ] Nomor WA admin toko untuk notifikasi

### 4.4 QR code
- [ ] Generate QR code yang mengarah ke landing page ambil antrian, bisa didownload sebagai gambar untuk dicetak

---

## 5. Arsitektur teknis

| Komponen | Pilihan teknis | Alasan |
|---|---|---|
| Frontend | Next.js (React) | Familiar untuk AI coding tool, deploy mudah ke Vercel |
| Database + realtime | Supabase (Postgres + Realtime) | Tier gratis cukup untuk 1 toko, realtime built-in |
| Hosting | Vercel | Tier gratis, deploy via git push |
| Notifikasi customer | Link `wa.me/<nomor>?text=<pesan>` | Gratis, tanpa API berbayar, cukup untuk skala 1 toko |
| QR code | Library JS (`qrcode.react` atau sejenis) | Generate di sisi client, tanpa biaya |
| Autentikasi admin | Password tunggal disimpan sebagai env variable, dicek di server | Cukup untuk MVP, tidak butuh sistem user penuh |

**Catatan soal WhatsApp:** MVP ini TIDAK pakai WhatsApp Business API resmi (biayanya Rp300rb–1,5jt/bulan). Notifikasi dilakukan dengan link `wa.me` yang otomatis terisi nomor dan pesan, lalu admin tinggal klik kirim. Ini cukup untuk skala satu toko dan nol biaya bulanan. Upgrade ke API resmi hanya relevan jika klien sudah besar dan butuh broadcast otomatis tanpa klik manual — itu di luar scope MVP.

---

## 6. Struktur data (skema dasar)

Tabel `queue`:
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | bigint (identity) | primary key |
| tanggal_antrian | date | tanggal antrian berbasis timezone WIB (Asia/Jakarta), bukan UTC, dasar reset harian |
| nomor | int | nomor antrian resmi, NULL sebelum dikonfirmasi admin |
| nama_customer | text | opsional |
| nomor_wa | text | opsional, untuk link notifikasi |
| status | text | `menunggu_konfirmasi`, `aktif`, `dipanggil`, `selesai`, `expired` |
| device_fingerprint | text | identifier device (cookie/local storage id), untuk cegah submit ganda |
| user_id | uuid | identifier user (Anonymous Sign-In) untuk kepentingan keamanan RLS |
| requested_at | timestamptz | default now(), waktu submit awal (dasar urutan FIFO) |
| confirmed_at | timestamptz | nullable, waktu admin konfirmasi kehadiran |

**Catatan implementasi anti-spam:**
- Sebelum insert baru, cek apakah `device_fingerprint` yang sama sudah punya baris dengan status `menunggu_konfirmasi` atau `aktif`/`dipanggil` — jika ya, tolak submit baru
- Job/scheduled function (atau cek saat fetch data) untuk ubah status jadi `expired` jika `status = menunggu_konfirmasi` dan `requested_at` lebih dari 15 menit yang lalu
- Nomor antrian resmi (`nomor`) hanya di-assign saat admin klik "Terima", bukan saat submit awal

Konfigurasi per klien (file `config.json` atau env variable), bukan tabel database:
```json
{
  "nama_toko": "Klinik Sehat Bandung",
  "warna_utama": "#1D9E75",
  "logo_url": "/logo-klien.png",
  "nomor_wa_admin": "6281234567890",
  "admin_password": "diisi-saat-deploy"
}
```

---

## 7. Definisi "selesai" untuk MVP (acceptance criteria)

MVP dianggap selesai dan siap dijual ke klien pertama jika:
1. Customer bisa scan QR statis dan submit permintaan dari HP tanpa install apa pun
2. Permintaan TIDAK langsung jadi nomor resmi — masuk status `menunggu_konfirmasi` dulu
3. Admin bisa lihat daftar permintaan masuk (urut FIFO) dan daftar antrian aktif secara terpisah, keduanya realtime tanpa refresh manual
4. Admin bisa konfirmasi kehadiran (klik "Terima") dan nomor resmi baru muncul di titik itu
5. Satu device tidak bisa membuat lebih dari satu permintaan aktif sekaligus
6. Permintaan yang tidak dikonfirmasi dalam 15 menit otomatis expired/hilang dari daftar
7. Link WA notifikasi berhasil terbuka dengan nomor dan pesan yang benar
8. Branding (nama toko, warna, logo) bisa diubah hanya lewat file config, tidak perlu ubah kode di banyak file
9. QR code bisa di-generate dan didownload sebagai gambar siap cetak poster
10. Sistem berjalan di hosting gratis (Vercel + Supabase tier gratis) tanpa biaya bulanan

---

## 8. Di luar scope (untuk versi setelah MVP / "season 2")

- Multi-tenant otomatis (satu sistem untuk banyak toko, masing-masing daftar dan bayar sendiri)
- Payment gateway otomatis (Midtrans/Stripe)
- WhatsApp Business API resmi + broadcast otomatis
- Multi-cabang per akun
- Analytics (rata-rata waktu tunggu, jam tersibuk, dsb.)
- Suara panggilan otomatis / tampilan TV display

---

## 9. Rencana deploy per klien (sampai ada versi multi-tenant)

1. Duplikasi/clone project dasar
2. Isi `config.json` sesuai data klien (nama, warna, logo, nomor WA, password admin)
3. Buat project baru di Supabase untuk klien tersebut (isolasi data antar klien)
4. Deploy ke Vercel dengan subdomain/domain milik klien atau subdomain gratis (`namatoko.vercel.app`)
5. Generate dan kirim QR code ke klien untuk dicetak
6. Training singkat (5–10 menit) ke admin toko cara pakai dashboard
