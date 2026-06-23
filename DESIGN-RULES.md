# Panduan Desain (Design Rules) — QueueGo

Dokumen ini mendefinisikan sistem desain (design system) untuk QueueGo berdasarkan referensi desain antarmuka modern, bersih, dan premium yang bersumber dari gambar referensi. Semua komponen dan halaman dalam aplikasi wajib mengikuti aturan gaya ini untuk menjaga konsistensi.

---

## 1. Aturan Warna & Latar Belakang

* **Latar Belakang Utama (Body)**: Menggunakan warna abu-abu sangat muda dan bersih untuk memberikan kontras pada kartu konten.
  * Kode CSS: `#F5F6F8` (atau Tailwind `bg-[#F5F6F8]`)
* **Latar Belakang Kartu (Card)**: Putih bersih untuk menonjolkan konten di atas latar belakang abu-abu.
  * Kode CSS: `#FFFFFF` (atau Tailwind `bg-white`)
* **Warna Batas (Border)**: Tipis, tajam, dan tidak mencolok.
  * Kode CSS: `#E4E7EC` (atau Tailwind `border-[#E4E7EC]`)
* **Teks Utama**: Abu-abu gelap/hitam arang untuk keterbacaan tinggi.
  * Kode CSS: `#1D2939` (atau Tailwind `text-[#1D2939]`)
* **Teks Sekunder/Keterangan**: Abu-abu medium.
  * Kode CSS: `#667085` (atau Tailwind `text-[#667085]`)

---

## 2. Struktur Kartu & Batas (Layout)

* **Container Utama (Main Card)**:
  * Batas sudut melengkung besar (Border Radius): `24px` (atau Tailwind `rounded-[24px]`)
  * Bayangan (Shadow): Sangat halus dan menyebar.
    * CSS: `box-shadow: 0px 8px 30px rgba(0, 0, 0, 0.03);`
  * Ketebalan Border: `1px solid #E4E7EC`
* **Sub-Baris / Item List (seperti antrian)**:
  * Batas sudut: `16px` (atau Tailwind `rounded-[16px]`)
  * Latar belakang: Putih dengan border `#E4E7EC`.
  * Efek Hover: Transformasi naik tipis (`hover:-translate-y-0.5`) dan bayangan lebih lembut untuk interaksi yang hidup.

---

## 3. Komponen Formulir & Input

* **Kolom Input (`.input-field`)**:
  * Tinggi & Padding: Nyaman di peranti mobile, padding horizontal besar (`px-4.5 py-3.5`).
  * Batas sudut: `12px` (Tailwind `rounded-[12px]`)
  * Warna Border: `#E4E7EC`
  * Focus State: Ring hitam tipis tanpa border mencolok.
    * Tailwind: `focus:ring-1 focus:ring-black focus:border-black`

---

## 4. Tombol (Buttons)

* **Tombol Utama (`.btn-primary`)**:
  * Menggunakan warna hitam solid (`#000000` atau `#101213`) dengan teks putih untuk aksi utama (seperti "Ambil Nomor Antrian" atau "Continue").
  * Batas sudut: `12px` (Tailwind `rounded-[12px]`)
  * Efek Hover: Transisi kegelapan atau perbesaran mikro.
* **Tombol Sekunder (`.btn-secondary`) / Pilihan Status**:
  * Latar belakang putih dengan border tipis `#E4E7EC`, teks hitam `#1D2939`.
  * Batas sudut: `12px` (Tailwind `rounded-[12px]`)
* **Tombol Bahaya / Reset (`.btn-danger`)**:
  * Latar belakang merah solid `#D92D20` dengan teks putih, batas sudut `12px`.

---

## 5. Lencana Status (Badges)

Menggunakan warna-warna pastel lembut dengan teks yang kontras untuk kenyamanan visual:
* **Menunggu Konfirmasi**: Latar belakang `#FEEFC6` (kuning pastel), teks `#B54708`
* **Aktif / Menunggu**: Latar belakang `#D1FADF` (hijau pastel), teks `#027A48`
* **Dipanggil**: Latar belakang `#D1E9FF` (biru pastel), teks `#0053C4` (dilengkapi animasi denyut halus)
* **Selesai**: Latar belakang `#F2F4F7` (abu-abu pastel), teks `#475467`
* **Kedaluwarsa**: Latar belakang `#FEE4E2` (merah pastel), teks `#B42318`
