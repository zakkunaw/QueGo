"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { appConfig } from "@/lib/config";
import type { QueueItem } from "@/lib/types";

export default function AdminDashboard() {
  const router = useRouter();
  const supabase = createClient();
  const [permintaan, setPermintaan] = useState<QueueItem[]>([]);
  const [antrianAktif, setAntrianAktif] = useState<QueueItem[]>([]);
  const [antrianSelesai, setAntrianSelesai] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  
  // Segmented tab state
  const [activeTab, setActiveTab] = useState<"permintaan" | "aktif" | "selesai">("aktif");
  const [logoError, setLogoError] = useState(false);

  const checkAuth = useCallback(async () => {
    const res = await fetch("/api/admin/check-auth");
    if (!res.ok) {
      router.push("/admin/login");
    }
  }, [router]);

  const fetchData = useCallback(async () => {
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });

    const { data: permintaanData } = await supabase
      .from("queue")
      .select("*")
      .eq("tanggal_antrian", today)
      .eq("status", "menunggu_konfirmasi")
      .order("requested_at", { ascending: true });

    if (permintaanData) {
      setPermintaan(permintaanData as unknown as QueueItem[]);
    }

    const { data: aktifData } = await supabase
      .from("queue")
      .select("*")
      .eq("tanggal_antrian", today)
      .in("status", ["aktif", "dipanggil"])
      .order("nomor", { ascending: true });

    if (aktifData) {
      setAntrianAktif(aktifData as unknown as QueueItem[]);
    }

    const { data: selesaiData } = await supabase
      .from("queue")
      .select("*")
      .eq("tanggal_antrian", today)
      .eq("status", "selesai")
      .order("nomor", { ascending: true });

    if (selesaiData) {
      setAntrianSelesai(selesaiData as unknown as QueueItem[]);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    Promise.resolve().then(() => {
      checkAuth();
      fetchData();
    });

    const channel = supabase
      .channel("admin-queue")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "queue" },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [checkAuth, fetchData, supabase]);

  const handleAction = async (action: string, id: number) => {
    setActionLoading(id);
    await fetch(`/api/admin/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setActionLoading(null);
  };

  const handleReset = async () => {
    setShowResetConfirm(false);
    setLoading(true);
    await fetch("/api/admin/reset", { method: "POST" });
    await fetchData();
  };

  const getTimeAgo = (dateStr: string) => {
    // eslint-disable-next-line react-hooks/purity
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Baru saja";
    if (mins < 60) return `${mins} mnt lalu`;
    return `${Math.floor(mins / 60)} jam lalu`;
  };

  const getWaLink = (item: QueueItem) => {
    if (!item.nomor_wa) return null;
    const wa = item.nomor_wa.replace(/^0/, "62");
    const text = `Halo ${item.nama_customer || "pelanggan"}, nomor antrian ${item.nomor} sudah dipanggil. Silakan menuju ke kasir/loket.`;
    return `https://wa.me/${wa}?text=${encodeURIComponent(text)}`;
  };

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    await supabase.auth.signOut();
    router.push("/admin/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-base">
        <div className="text-gray-500 font-medium">Memuat dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-bg-base">
      
      {/* 1. SIDEBAR (Kiri) - Hanya muncul di layar Desktop */}
      <aside className="w-64 bg-white border-r border-border-main min-h-screen p-6 hidden md:flex flex-col justify-between sticky top-0 h-screen">
        <div className="space-y-8">
          {/* Logo & Nama Toko */}
          <div className="flex items-center gap-3 px-2">
            {!logoError && appConfig.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={appConfig.logo_url} alt="" className="h-9 w-auto rounded-lg" onError={() => setLogoError(true)} />
            )}
            <div>
              <h1 className="text-base font-bold text-text-main truncate max-w-[140px]">{appConfig.nama_toko}</h1>
              <p className="text-xs text-text-sub font-medium">Dashboard Admin</p>
            </div>
          </div>

          {/* Menu Navigasi */}
          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab("aktif")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                activeTab === "aktif" || activeTab === "permintaan" || activeTab === "selesai"
                  ? "bg-bg-light text-text-main"
                  : "text-text-sub hover:text-text-main hover:bg-bg-hover"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>
              Antrean Utama
            </button>
            <a
              href="/admin/qr"
              className="flex items-center gap-3 px-4 py-3 text-text-sub hover:text-text-main hover:bg-bg-hover rounded-xl text-sm font-semibold transition-all cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><line x1="7" y1="17" x2="7" y2="17.01"/><line x1="17" y1="7" x2="17" y2="7.01"/><line x1="17" y1="17" x2="17" y2="17.01"/></svg>
              Unduh QR Code
            </a>
          </nav>
        </div>

        {/* Bagian Bawah Sidebar (Reset Harian & Logout) */}
        <div className="space-y-4 pt-6 border-t border-border-main">
          {showResetConfirm ? (
            <div className="p-3 bg-danger-bg border border-danger-border rounded-xl space-y-2">
              <p className="text-xs text-red-danger font-semibold text-center">Yakin reset antrean?</p>
              <div className="flex gap-2">
                <button onClick={handleReset} className="flex-1 bg-danger-dark text-white py-1.5 text-xs font-bold rounded-lg cursor-pointer">Ya</button>
                <button onClick={() => setShowResetConfirm(false)} className="flex-1 bg-white text-gray-700 border border-border-main py-1.5 text-xs font-bold rounded-lg cursor-pointer">Batal</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowResetConfirm(true)}
              className="w-full flex items-center gap-3 px-4 py-3 text-red-danger hover:bg-danger-bg/50 rounded-xl text-sm font-semibold transition-all cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
              Reset Harian
            </button>
          )}

          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 text-text-sub hover:text-text-main hover:bg-bg-hover rounded-xl text-sm font-semibold transition-all cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Keluar
          </button>
        </div>
      </aside>

      {/* 2. CONTENT AREA (Kanan) */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Mobile Header (Hanya muncul di peranti mobile) */}
        <header className="bg-white border-b border-border-main px-4 py-3 flex items-center justify-between sticky top-0 z-10 md:hidden">
          <div className="flex items-center gap-2">
            {!logoError && appConfig.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={appConfig.logo_url} alt="" className="h-8 w-auto rounded-lg" onError={() => setLogoError(true)} />
            )}
            <h1 className="text-sm font-bold text-text-main">{appConfig.nama_toko}</h1>
          </div>
          <div className="flex items-center gap-3">
            <a href="/admin/qr" className="text-xs text-text-sub underline">QR</a>
            <button onClick={logout} className="text-xs text-red-600 font-semibold">Keluar</button>
          </div>
        </header>

        {/* Content Wrapper */}
        <main className="flex-1 p-4 md:p-10 max-w-4xl w-full mx-auto space-y-6">
          
          {/* Header Dashboard */}
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-text-main">Ringkasan Antrean</h2>
              <p className="text-sm text-text-sub">Kelola seluruh permintaan antrean hari ini</p>
            </div>
            {/* Tombol Reset Mobile (hanya muncul di hp) */}
            <div className="md:hidden">
              {showResetConfirm ? (
                <div className="flex gap-1.5">
                  <button onClick={handleReset} className="bg-danger-dark text-white px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer">Ya</button>
                  <button onClick={() => setShowResetConfirm(false)} className="bg-white text-gray-700 border border-border-main px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer">Batal</button>
                </div>
              ) : (
                <button
                  onClick={() => setShowResetConfirm(true)}
                  className="bg-danger-bg text-red-danger px-3 py-2 text-xs font-semibold rounded-lg hover:bg-danger-border cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* KARTU UTAMA REDESIGN (Seperti reference image) */}
          <div className="card space-y-6">
            
            {/* Header di dalam kartu & Segmented Tabs (Persis "Poll type" di reference image) */}
            <div className="space-y-4">
              <h3 className="text-base font-bold text-text-main">Daftar Antrean</h3>
              
              {/* Segmented Control Pill Container */}
              <div className="bg-bg-light p-1.5 rounded-2xl flex gap-1 w-full">
                <button
                  onClick={() => setActiveTab("aktif")}
                  className={`flex-1 py-3 text-xs md:text-sm font-semibold rounded-xl transition-all cursor-pointer ${
                    activeTab === "aktif"
                      ? "bg-white text-text-main shadow-[0px_4px_12px_rgba(0,0,0,0.05)] border border-border-main"
                      : "text-text-sub hover:text-text-main"
                  }`}
                >
                  Aktif ({antrianAktif.length})
                </button>
                <button
                  onClick={() => setActiveTab("permintaan")}
                  className={`flex-1 py-3 text-xs md:text-sm font-semibold rounded-xl transition-all cursor-pointer relative ${
                    activeTab === "permintaan"
                      ? "bg-white text-text-main shadow-[0px_4px_12px_rgba(0,0,0,0.05)] border border-border-main"
                      : "text-text-sub hover:text-text-main"
                  }`}
                >
                  Permintaan ({permintaan.length})
                  {permintaan.length > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 text-[10px] text-white font-bold items-center justify-center">{permintaan.length}</span>
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab("selesai")}
                  className={`flex-1 py-3 text-xs md:text-sm font-semibold rounded-xl transition-all cursor-pointer ${
                    activeTab === "selesai"
                      ? "bg-white text-text-main shadow-[0px_4px_12px_rgba(0,0,0,0.05)] border border-border-main"
                      : "text-text-sub hover:text-text-main"
                  }`}
                >
                  Selesai ({antrianSelesai.length})
                </button>
              </div>
            </div>

            {/* AREA DAFTAR KONTEN (Mengikuti gaya kotak Options di gambar referensi) */}
            <div className="bg-bg-surface border border-border-main rounded-2xl p-4 md:p-6 space-y-3">
              
              {/* TAB 1: ANTRIAN AKTIF */}
              {activeTab === "aktif" && (
                antrianAktif.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-text-muted text-sm">Tidak ada antrean aktif saat ini</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {antrianAktif.map((item) => (
                      <div
                        key={item.id}
                        className={`bg-white border border-border-main rounded-[16px] flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 p-4 shadow-sm hover:border-bg-dark/20 hover:-translate-y-0.5 transition-all duration-150 ${
                          item.status === "dipanggil" ? "border-blue-300 bg-blue-50/20" : ""
                        }`}
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          {/* Nomor Antrean Bulat */}
                          <div className="h-12 w-12 rounded-xl flex items-center justify-center font-bold text-lg bg-bg-light text-text-main shrink-0">
                            {item.nomor}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-text-main truncate text-sm md:text-base">{item.nama_customer || "Tanpa Nama"}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`status-badge status-${item.status}`}>
                                {item.status === "aktif" ? "Menunggu" : "Dipanggil"}
                              </span>
                            </div>
                          </div>
                        </div>
                        {/* Aksi Aksi di Kanan */}
                        <div className="flex items-center gap-2 justify-end w-full sm:w-auto border-t border-border-main/60 pt-3 sm:pt-0 sm:border-0 shrink-0">
                          {item.status === "aktif" && (
                            <button
                              onClick={() => handleAction("panggil", item.id)}
                              disabled={actionLoading === item.id}
                              className="bg-[#0053C4] hover:bg-[#003B91] text-white px-4 rounded-xl text-xs md:text-sm font-semibold transition-all duration-150 cursor-pointer disabled:opacity-50 h-10 flex items-center justify-center active:scale-95 flex-1 sm:flex-initial"
                            >
                              {actionLoading === item.id ? "..." : "Panggil"}
                            </button>
                          )}
                          <button
                            onClick={() => handleAction("selesai", item.id)}
                            disabled={actionLoading === item.id}
                            className="bg-white text-text-main border border-border-main px-4 rounded-xl text-xs md:text-sm font-semibold hover:bg-bg-hover transition-all duration-150 cursor-pointer disabled:opacity-50 h-10 flex items-center justify-center active:scale-95 flex-1 sm:flex-initial"
                          >
                            {actionLoading === item.id ? "..." : "Selesai"}
                          </button>
                          {item.nomor_wa && (
                            <a
                              href={getWaLink(item)!}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bg-[#25D366] hover:bg-[#20BA5A] text-white w-10 rounded-xl transition-all duration-150 h-10 flex items-center justify-center shadow-sm hover:shadow-md active:scale-95 cursor-pointer shrink-0"
                              title="Kirim WhatsApp"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white shrink-0" fill="currentColor" viewBox="0 0 448 512"><path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z"/></svg>
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}

              {/* TAB 2: PERMINTAAN MASUK */}
              {activeTab === "permintaan" && (
                permintaan.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-text-muted text-sm">Tidak ada permintaan masuk saat ini</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {permintaan.map((item) => (
                      <div
                        key={item.id}
                        className="bg-white border border-border-main rounded-[16px] flex items-center justify-between gap-4 p-4 shadow-sm hover:border-bg-dark/20 hover:-translate-y-0.5 transition-all duration-150"
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-text-main text-base truncate">{item.nama_customer || "Tanpa Nama"}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className="text-text-sub text-xs font-semibold">{getTimeAgo(item.requested_at)}</span>
                            {item.nomor_wa && (
                              <span className="text-text-muted text-xs font-medium truncate">({item.nomor_wa})</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleAction("tolak", item.id)}
                            disabled={actionLoading === item.id}
                            className="bg-white text-red-danger border border-danger-border px-4 rounded-xl text-xs md:text-sm font-semibold hover:bg-danger-bg transition-all duration-150 cursor-pointer disabled:opacity-50 h-10 flex items-center justify-center active:scale-95"
                          >
                            {actionLoading === item.id ? "..." : "Tolak"}
                          </button>
                          <button
                            onClick={() => handleAction("confirm", item.id)}
                            disabled={actionLoading === item.id}
                            className="bg-bg-dark text-white px-4 rounded-xl text-xs md:text-sm font-semibold hover:bg-black transition-all duration-150 cursor-pointer disabled:opacity-50 h-10 flex items-center justify-center active:scale-95"
                          >
                            {actionLoading === item.id ? "..." : "Terima"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}

              {/* TAB 3: ANTRIAN SELESAI */}
              {activeTab === "selesai" && (
                antrianSelesai.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-text-muted text-sm">Belum ada antrean selesai hari ini</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {antrianSelesai.map((item) => (
                      <div
                        key={item.id}
                        className="bg-white border border-border-main/70 rounded-[16px] flex items-center justify-between gap-4 p-4 opacity-75"
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          {/* Nomor Grayed */}
                          <div className="h-12 w-12 rounded-xl flex items-center justify-center font-bold text-lg bg-bg-light text-text-muted">
                            {item.nomor}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-text-sub line-through truncate">{item.nama_customer || "Tanpa Nama"}</p>
                            <span className="status-badge status-selesai text-[10px] mt-1">
                              Selesai
                            </span>
                          </div>
                        </div>
                        <div className="text-text-muted text-xs font-semibold">
                          Dilayani
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}

            </div>
          </div>
        </main>
      </div>
    </div>
  );
}