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
                        className={`bg-white border border-border-main rounded-xl flex items-center justify-between gap-4 p-4 shadow-sm hover:border-bg-dark/20 hover:-translate-y-0.5 transition-all duration-150 ${
                          item.status === "dipanggil" ? "border-blue-300 bg-blue-50/20" : ""
                        }`}
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          {/* Nomor Antrean Bulat */}
                          <div className="h-12 w-12 rounded-xl flex items-center justify-center font-bold text-lg bg-bg-light text-text-main">
                            {item.nomor}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-text-main truncate">{item.nama_customer || "Tanpa Nama"}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`status-badge status-${item.status}`}>
                                {item.status === "aktif" ? "Menunggu" : "Dipanggil"}
                              </span>
                            </div>
                          </div>
                        </div>
                        {/* Aksi Aksi di Kanan */}
                        <div className="flex items-center gap-2 shrink-0">
                          {item.status === "aktif" && (
                            <button
                              onClick={() => handleAction("panggil", item.id)}
                              disabled={actionLoading === item.id}
                              className="bg-blue-600 text-white px-4 py-2.5 rounded-lg text-xs md:text-sm font-semibold hover:bg-blue-700 cursor-pointer disabled:opacity-50"
                            >
                              {actionLoading === item.id ? "..." : "Panggil"}
                            </button>
                          )}
                          <button
                            onClick={() => handleAction("selesai", item.id)}
                            disabled={actionLoading === item.id}
                            className="bg-bg-light text-text-medium border border-border-main px-4 py-2.5 rounded-lg text-xs md:text-sm font-semibold hover:bg-border-main cursor-pointer disabled:opacity-50"
                          >
                            {actionLoading === item.id ? "..." : "Selesai"}
                          </button>
                          {item.nomor_wa && (
                            <a
                              href={getWaLink(item)!}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bg-green-600 text-white p-2.5 rounded-lg hover:bg-green-700"
                              title="Kirim WhatsApp"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M13.601 2.326A7.85 7.85 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.9 7.9 0 0 0 3.79.977h.004c4.368 0 7.927-3.558 7.93-7.93a7.9 7.9 0 0 0-2.327-5.615zM7.994 14.52a6.6 6.6 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.56 6.56 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592m3.69-4.294c-.2-.1-.1.353-.298.545a1.13 1.13 0 0 1-.806.326c-.32 0-.64-.08-1.28-.387-.624-.26-1.01-.762-1.39-1.28a8.3 8.3 0 0 1-.41-.6c-.2-.3-.2-.5 0-.7l.32-.4c.1-.2.2-.3.3-.4.1-.1.2-.2.2-.3 0-.1 0-.3-.1-.4-.09-.2-.72-1.74-.98-2.38-.26-.64-.52-.54-.72-.54h-.62c-.2 0-.5.1-.7.4-.2.2-.8.8-.8 2 0 1.2.9 2.4 1 2.6.1.1 1.7 2.6 4.1 3.6.6.2 1 .4 1.4.5.6.2 1.1.2 1.5.1.5-.07 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2-.1-.1-.3-.2-.5-.3"/></svg>
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
                        className="bg-white border border-border-main rounded-xl flex items-center justify-between gap-4 p-4 shadow-sm hover:border-bg-dark/20 hover:-translate-y-0.5 transition-all duration-150"
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
                        <button
                          onClick={() => handleAction("confirm", item.id)}
                          disabled={actionLoading === item.id}
                          className="bg-bg-dark text-white px-5 py-3 rounded-lg text-xs md:text-sm font-semibold hover:bg-black cursor-pointer shrink-0 disabled:opacity-50"
                        >
                          {actionLoading === item.id ? "..." : "Terima"}
                        </button>
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
                        className="bg-white border border-border-main/70 rounded-xl flex items-center justify-between gap-4 p-4 opacity-75"
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