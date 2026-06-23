export type QueueStatus =
  | 'menunggu_konfirmasi'
  | 'aktif'
  | 'dipanggil'
  | 'selesai'
  | 'expired';

export interface QueueItem {
  id: number;
  tanggal_antrian: string;
  nomor: number | null;
  nama_customer: string | null;
  nomor_wa: string | null;
  status: QueueStatus;
  device_fingerprint: string;
  requested_at: string;
  confirmed_at: string | null;
}

export interface SubmitQueueRequest {
  nama_customer: string;
  nomor_wa?: string;
  device_fingerprint: string;
}

export interface SubmitQueueResponse {
  success: boolean;
  data?: QueueItem;
  error?: string;
}

export interface AdminActionResponse {
  success: boolean;
  data?: QueueItem;
  error?: string;
}

export interface RealtimePayload {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: QueueItem | null;
  old: QueueItem | null;
}