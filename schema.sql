-- =====================================================================
-- SCHEMA: QueueGo MVP — Sistem Antrian Digital
-- =====================================================================

-- 1. PEMBUATAN TABEL QUEUE
CREATE TABLE IF NOT EXISTS public.queue (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tanggal_antrian date NOT NULL DEFAULT (timezone('Asia/Jakarta'::text, now()))::date,
    nomor integer,
    nama_customer text,
    nomor_wa text,
    status text NOT NULL DEFAULT 'menunggu_konfirmasi',
    device_fingerprint text NOT NULL,
    user_id uuid DEFAULT auth.uid(),
    requested_at timestamp with time zone NOT NULL DEFAULT now(),
    confirmed_at timestamp with time zone,
    
    -- Validasi status yang diperbolehkan
    CONSTRAINT check_status CHECK (status IN ('menunggu_konfirmasi', 'aktif', 'dipanggil', 'selesai', 'expired')),
    
    -- Validasi korelasi nomor antrian dengan status
    CONSTRAINT check_nomor_status CHECK (
        (status = 'menunggu_konfirmasi' AND nomor IS NULL) OR
        (status = 'expired' AND nomor IS NULL) OR
        (status IN ('aktif', 'dipanggil', 'selesai') AND nomor IS NOT NULL)
    )
);

-- 2. PEMBUATAN INDEX UNTUK OPTIMALISASI QUERY
CREATE INDEX IF NOT EXISTS queue_tanggal_status_idx ON public.queue (tanggal_antrian, status);
CREATE INDEX IF NOT EXISTS queue_device_fingerprint_idx ON public.queue (device_fingerprint);
CREATE INDEX IF NOT EXISTS queue_user_id_idx ON public.queue (user_id);

-- 3. FUNGSI LOGIKA DATABASE (RPC)

-- A. Fungsi Auto-Expire (Membersihkan permintaan > 15 menit)
CREATE OR REPLACE FUNCTION public.expire_old_requests()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count integer;
BEGIN
    WITH expired_rows AS (
        UPDATE public.queue
        SET status = 'expired'
        WHERE status = 'menunggu_konfirmasi'
          AND requested_at < (now() - interval '15 minutes')
        RETURNING id
    )
    SELECT count(*) INTO v_count FROM expired_rows;
    
    RETURN v_count;
END;
$$;

-- B. Fungsi Submit Permintaan Baru (Customer)
CREATE OR REPLACE FUNCTION public.submit_antrian(
    p_nama_customer text,
    p_nomor_wa text,
    p_device_fingerprint text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_today date;
    v_new_row public.queue;
BEGIN
    -- Bersihkan antrian basi terlebih dahulu
    PERFORM public.expire_old_requests();
    
    v_today := (timezone('Asia/Jakarta'::text, now()))::date;
    
    -- Validasi anti-spam: Satu device hanya boleh memiliki satu antrian aktif hari ini
    IF EXISTS (
        SELECT 1 FROM public.queue
        WHERE device_fingerprint = p_device_fingerprint
          AND tanggal_antrian = v_today
          AND status IN ('menunggu_konfirmasi', 'aktif', 'dipanggil')
    ) THEN
        RAISE EXCEPTION 'Anda masih memiliki permintaan antrian yang aktif atau menunggu konfirmasi.'
            USING ERRCODE = 'P0001';
    END IF;
    
    -- Insert data baru dengan mengaitkan user_id (jika terautentikasi anonim)
    INSERT INTO public.queue (
        tanggal_antrian,
        nama_customer,
        nomor_wa,
        status,
        device_fingerprint,
        user_id
    )
    VALUES (
        v_today,
        p_nama_customer,
        p_nomor_wa,
        'menunggu_konfirmasi',
        p_device_fingerprint,
        auth.uid()
    )
    RETURNING * INTO v_new_row;
    
    RETURN jsonb_build_object(
        'success', true,
        'data', jsonb_build_object('id', v_new_row.id)
    );
END;
$$;

-- C. Fungsi Konfirmasi Kehadiran / Terima (Admin)
CREATE OR REPLACE FUNCTION public.konfirmasi_antrian(p_id bigint)
RETURNS public.queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_row public.queue;
    v_count integer;
    v_next_nomor integer;
BEGIN
    -- Proteksi akses admin
    IF coalesce(auth.role(), '') <> 'service_role' AND coalesce(auth.jwt() ->> 'email', '') <> 'admin@queuego.local' THEN
        RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
    END IF;
    
    -- Lock table untuk mencegah balapan (race condition) penomoran
    LOCK TABLE public.queue IN SHARE ROW EXCLUSIVE MODE;
    
    -- Ambil dan validasi antrian
    SELECT * INTO v_row FROM public.queue WHERE id = p_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Antrian tidak ditemukan' USING ERRCODE = 'P0002';
    END IF;
    
    IF v_row.status <> 'menunggu_konfirmasi' THEN
        RAISE EXCEPTION 'Hanya antrian menunggu_konfirmasi yang dapat diterima' USING ERRCODE = 'P0003';
    END IF;
    
    -- Hitung nomor antrian resmi: (jumlah antrian aktif/dipanggil/selesai hari ini) + 1
    SELECT count(*) INTO v_count
    FROM public.queue
    WHERE tanggal_antrian = v_row.tanggal_antrian
      AND status IN ('aktif', 'dipanggil', 'selesai');
    
    v_next_nomor := v_count + 1;
    
    -- Update status menjadi aktif dan berikan nomor resmi
    UPDATE public.queue
    SET status = 'aktif',
        nomor = v_next_nomor,
        confirmed_at = now()
    WHERE id = p_id
    RETURNING * INTO v_row;
    
    RETURN v_row;
END;
$$;

-- D. Fungsi Panggil Antrian (Admin)
CREATE OR REPLACE FUNCTION public.panggil_antrian(p_id bigint)
RETURNS public.queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_row public.queue;
BEGIN
    -- Proteksi akses admin
    IF coalesce(auth.role(), '') <> 'service_role' AND coalesce(auth.jwt() ->> 'email', '') <> 'admin@queuego.local' THEN
        RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
    END IF;
    
    UPDATE public.queue
    SET status = 'dipanggil'
    WHERE id = p_id
      AND status = 'aktif'
    RETURNING * INTO v_row;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Antrian tidak ditemukan atau tidak dalam status aktif' USING ERRCODE = 'P0004';
    END IF;
    
    RETURN v_row;
END;
$$;

-- E. Fungsi Tandai Selesai (Admin)
CREATE OR REPLACE FUNCTION public.selesai_antrian(p_id bigint)
RETURNS public.queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_row public.queue;
BEGIN
    -- Proteksi akses admin
    IF coalesce(auth.role(), '') <> 'service_role' AND coalesce(auth.jwt() ->> 'email', '') <> 'admin@queuego.local' THEN
        RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
    END IF;
    
    UPDATE public.queue
    SET status = 'selesai'
    WHERE id = p_id
      AND status IN ('aktif', 'dipanggil')
    RETURNING * INTO v_row;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Antrian tidak ditemukan atau tidak dalam status aktif/dipanggil' USING ERRCODE = 'P0005';
    END IF;
    
    RETURN v_row;
END;
$$;


-- 4. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.queue ENABLE ROW LEVEL SECURITY;

-- Kebijakan SELECT untuk Customer (Membaca antrian milik sendiri berdasarkan user_id / auth.uid())
DROP POLICY IF EXISTS "Customers can view their own queues" ON public.queue;
CREATE POLICY "Customers can view their own queues"
ON public.queue
FOR SELECT
TO anon, authenticated
USING (auth.uid() = user_id);

-- Kebijakan SELECT untuk Admin (Membaca semua antrian berdasarkan email admin)
DROP POLICY IF EXISTS "Admin can view all queues" ON public.queue;
CREATE POLICY "Admin can view all queues"
ON public.queue
FOR SELECT
TO authenticated
USING (coalesce(auth.jwt() ->> 'email', '') = 'admin@queuego.local');

-- Catatan: Kebijakan INSERT dan UPDATE tidak dibuat secara langsung karena seluruh
-- operasi penulisan dipaksa melalui RPC database fungsi yang berjalan sebagai SECURITY DEFINER.


-- 5. AKTIVASI SUPABASE REALTIME
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_rel pr
    JOIN pg_publication p ON p.oid = pr.prpubid
    JOIN pg_class c ON c.oid = pr.prrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE p.pubname = 'supabase_realtime'
      AND n.nspname = 'public'
      AND c.relname = 'queue'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.queue;
  END IF;
END;
$$;
