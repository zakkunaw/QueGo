# Kontrak Data: QueueGo Backend & Database (Supabase)

Dokumen ini berisi spesifikasi tabel, fungsi database (RPC), skema autentikasi, serta cara berlangganan ke pembaruan realtime dari database Supabase untuk digunakan oleh AI Frontend.

---

## 1. Skema Tabel `public.queue`

Setiap baris mewakili satu entri antrian (baik yang menunggu konfirmasi, aktif, dipanggil, selesai, maupun kedaluwarsa).

| Nama Kolom | Tipe Data | Nullable | Keterangan / Default |
|---|---|---|---|
| `id` | `bigint` | NO | Primary Key (Identity) |
| `tanggal_antrian` | `date` | NO | Default: Tanggal hari ini (WIB - `Asia/Jakarta`) |
| `nomor` | `integer` | YES | Nomor antrian resmi. `NULL` jika belum dikonfirmasi. |
| `nama_customer` | `text` | YES | Nama lengkap customer (opsional, disarankan wajib di FE) |
| `nomor_wa` | `text` | YES | Nomor WhatsApp customer untuk notifikasi (opsional) |
| `status` | `text` | NO | Default: `'menunggu_konfirmasi'`. Nilai: `menunggu_konfirmasi`, `aktif`, `dipanggil`, `selesai`, `expired` |
| `device_fingerprint` | `text` | NO | Kode unik peranti untuk mencegah spam antrian ganda |
| `user_id` | `uuid` | YES | ID user terautentikasi (Anonymous Sign-In). Default: `auth.uid()` |
| `requested_at` | `timestamptz` | NO | Default: `now()` (Waktu mendaftar antrian) |
| `confirmed_at` | `timestamptz` | YES | Waktu ketika admin menyetujui kehadiran fisik customer |

### Constraints (Aturan Integritas):
1. **`check_status`**: Status harus salah satu dari: `menunggu_konfirmasi`, `aktif`, `dipanggil`, `selesai`, `expired`.
2. **`check_nomor_status`**:
   * Jika status = `menunggu_konfirmasi` atau `expired`, kolom `nomor` **wajib** `NULL`.
   * Jika status = `aktif`, `dipanggil`, atau `selesai`, kolom `nomor` **wajib** memiliki nilai (tidak boleh `NULL`).

---

## 2. Alur Autentikasi

### A. Customer (Anonymous Sign-In)
Sebelum customer dapat mendaftar antrian atau melihat status pribadinya, peranti mereka harus masuk secara anonim ke Supabase Auth untuk mendapatkan `auth.uid()`. Hal ini diperlukan agar RLS (Row Level Security) mengizinkan pembacaan baris data miliknya.

**Kode Inisialisasi Frontend:**
Di halaman customer (seperti di `page.tsx` atau `status/[id]/page.tsx`), tambahkan inisialisasi session sebelum melakukan RPC atau query:
```javascript
import { createClient } from '@/lib/supabase';

const supabase = createClient();

async function initCustomerAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) console.error("Gagal masuk secara anonim:", error.message);
    return data?.session;
  }
  
  return session;
}
```

### B. Admin (Single Admin Account)
Admin masuk menggunakan satu email dan sandi statis yang dibuat saat tahap setup instansi toko di Supabase Auth.
* **Email Admin**: `admin@queuego.local`
* **Password Admin**: (Menggunakan nilai `ADMIN_PASSWORD` dari env)

Untuk memastikan bahwa client-side Supabase client terautentikasi (sehingga RLS mengizinkan SELECT seluruh baris dan realtime), admin harus login ke Supabase Auth di sisi browser (misalnya di `admin/login/page.tsx` setelah memanggil API lokal sukses):
```javascript
// Di admin/login/page.tsx setelah API Route login mengembalikan sukses:
const supabase = createClient();
const { error } = await supabase.auth.signInWithPassword({
  email: 'admin@queuego.local',
  password: password // password yang dimasukkan admin
});
```

---

## 3. Remote Procedure Call (RPC) / Fungsi Database

Semua perubahan status atau pendaftaran harus melalui fungsi RPC untuk menjamin logika validasi berjalan di sisi server.

### A. Submit Permintaan Baru (`submit_antrian`)
* **Pengguna**: Customer (Anonim)
* **Keterangan**: Mendaftarkan antrian baru. Fungsi ini otomatis membersihkan antrian basi (> 15 menit) dan memvalidasi apakah device fingerprint yang sama sudah memiliki antrian aktif hari ini.
* **Parameter**:
  * `p_nama_customer` (text)
  * `p_nomor_wa` (text - opsional)
  * `p_device_fingerprint` (text)
* **Return**: `jsonb` berformat `{"success": true, "data": {"id": <queue_id>}}`

**Contoh Pemanggilan Frontend:**
```javascript
const { data, error: submitError } = await supabase.rpc('submit_antrian', {
  p_nama_customer: 'Budi Santoso',
  p_nomor_wa: '6281234567890',
  p_device_fingerprint: 'device_unique_uuid_or_cookie'
});

if (submitError) {
  // Jika spam antrian ganda, database melempar error code 'P0001'
  if (submitError.code === 'P0001') {
    alert("Anda masih memiliki permintaan antrian aktif!");
  } else {
    alert("Terjadi kesalahan: " + submitError.message);
  }
} else {
  console.log("Antrian berhasil didaftarkan:", data);
  // data berformat: { success: true, data: { id: 123 } }
  if (data?.success && data.data?.id) {
    router.push(`/status/${data.data.id}`);
  }
}
```

### B. Terima / Konfirmasi Kehadiran (`konfirmasi_antrian`)
* **Pengguna**: Admin (Terautentikasi)
* **Keterangan**: Memberikan nomor antrian resmi berurutan (FIFO) dan mengubah status menjadi `aktif`.
* **Parameter**: `p_id` (bigint)
* **Return**: `public.queue` (Row yang diperbarui)

**Contoh Pemanggilan Frontend:**
```javascript
const { data, error } = await supabase.rpc('konfirmasi_antrian', {
  p_id: queueIdToConfirm
});
```

### C. Panggil Antrian (`panggil_antrian`)
* **Pengguna**: Admin (Terautentikasi)
* **Keterangan**: Mengubah status antrian menjadi `dipanggil`.
* **Parameter**: `p_id` (bigint)
* **Return**: `public.queue` (Row yang diperbarui)

**Contoh Pemanggilan Frontend:**
```javascript
const { data, error } = await supabase.rpc('panggil_antrian', {
  p_id: queueIdToCall
});
```

### D. Tandai Selesai (`selesai_antrian`)
* **Pengguna**: Admin (Terautentikasi)
* **Keterangan**: Mengubah status antrian menjadi `selesai`.
* **Parameter**: `p_id` (bigint)
* **Return**: `public.queue` (Row yang diperbarui)

**Contoh Pemanggilan Frontend:**
```javascript
const { data, error } = await supabase.rpc('selesai_antrian', {
  p_id: queueIdToComplete
});
```

---

## 4. Berlangganan Data Realtime (Supabase Realtime)

### A. Sisi Customer (Memantau Antrian Pribadi)
Customer mendengarkan perubahan data hanya untuk baris antrian milik mereka sendiri berdasarkan ID antrian.

```javascript
const queueId = 123; // Didapatkan setelah submit_antrian

const channel = supabase
  .channel(`queue-${queueId}`)
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'queue',
      filter: `id=eq.${queueId}`
    },
    (payload) => {
      console.log("Status antrian diperbarui:", payload.new);
      // Update UI sesuai status payload.new.status dan nomor payload.new.nomor
    }
  )
  .subscribe();

// Jangan lupa unsubscribe saat komponen unmount
// channel.unsubscribe();
```

### B. Sisi Admin (Memantau Dashboard Toko)
Admin mendengarkan semua perubahan data pada tabel `queue` untuk menyegarkan tampilan dashboard secara realtime.

```javascript
const adminChannel = supabase
  .channel('admin-queue')
  .on(
    'postgres_changes',
    {
      event: '*', // Listen to INSERT, UPDATE, DELETE
      schema: 'public',
      table: 'queue'
    },
    (payload) => {
      console.log("Perubahan data antrian terdeteksi:", payload);
      // Trigger fetch ulang data antrian hari ini atau gabungkan perubahan payload ke state lokal
    }
  )
  .subscribe();
```

---

## 5. Estimasi Posisi Antrian (Untuk Halaman Status Customer)
Untuk menampilkan estimasi posisi ("Ada X orang di depan Anda"), lakukan query berikut di frontend:
```javascript
// Ambil data antrian milik customer terlebih dahulu untuk tahu nomor antriannya
// Contoh nomor customer = 15, tanggal = '2026-06-22'
const { count, error } = await supabase
  .from('queue')
  .select('*', { count: 'exact', head: true })
  .eq('status', 'aktif')
  .lt('nomor', customerNomor); // Menghitung antrian aktif dengan nomor lebih kecil

if (!error) {
  console.log(`Ada ${count} orang sebelum Anda.`);
}
```
