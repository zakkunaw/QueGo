"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { appConfig } from "@/lib/config";

const QRCode = dynamic(() => import("qrcode.react").then((mod) => ({ default: mod.QRCodeSVG })), {
  ssr: false,
});

export default function AdminQRPage() {
  const router = useRouter();
  const qrRef = useRef<HTMLDivElement>(null);
  const [origin, setOrigin] = useState("");
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetch("/api/admin/check-auth").then((res) => {
      if (!res.ok) router.push("/admin/login");
      setChecking(false);
    });
    Promise.resolve().then(() => {
      setOrigin(window.location.origin);
    });
  }, [router]);

  const downloadQR = () => {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    const size = 1024;
    canvas.width = size;
    canvas.height = size;

    const img = new Image();
    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 40, 40, size - 80, size - 80);

      ctx.fillStyle = "#000000";
      ctx.font = "bold 32px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(appConfig.nama_toko, size / 2, size - 10);

      const link = document.createElement("a");
      link.download = `qrcode-${appConfig.nama_toko.toLowerCase().replace(/\s+/g, "-")}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      URL.revokeObjectURL(url);
    };

    img.src = url;
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Memuat...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900">QR Code Antrian</h1>
          <a href="/admin/dashboard" className="text-sm text-gray-600 hover:text-gray-900 underline">
            Dashboard
          </a>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-8">
        <div className="card text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Scan untuk Ambil Antrian</h2>
          <p className="text-sm text-gray-500 mb-6">{appConfig.nama_toko}</p>

          <div ref={qrRef} className="flex justify-center mb-6">
            <div className="bg-white p-4 rounded-xl border border-gray-200 inline-block">
              <QRCode value={origin} size={280} level="H" />
            </div>
          </div>

          {origin && (
            <p className="text-xs text-gray-400 mb-6 break-all bg-gray-50 p-2 rounded">{origin}</p>
          )}

          <button onClick={downloadQR} className="btn-primary w-full">
            Download QR Code (PNG)
          </button>

          <p className="mt-4 text-xs text-gray-400">
            Cetak QR code sebagai poster dan tempel di lokasi strategis
          </p>
        </div>
      </main>
    </div>
  );
}