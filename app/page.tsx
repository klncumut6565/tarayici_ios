"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { setPendingImport } from "@/lib/pendingImport";
import AddMenu from "@/components/AddMenu";
import Sidebar from "@/components/Sidebar";

export default function HomePage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);

  function openCamera() {
    setMenuOpen(false);
    router.push("/tara");
  }

  function openGallery() {
    setMenuOpen(false);
    galleryInputRef.current?.click();
  }

  function openFiles() {
    setMenuOpen(false);
    filesInputRef.current?.click();
  }

  function openKimlik() {
    setMenuOpen(false);
    router.push("/tara?mode=kimlik");
  }

  function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.type === "application/pdf") {
      alert("PDF dosyaları şu an desteklenmiyor. Lütfen bir görüntü (JPEG/PNG) seç.");
      return;
    }
    setPendingImport(file, "standart");
    router.push("/tara");
  }

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        padding: "calc(20px + var(--safe-top)) 20px calc(24px + var(--safe-bottom))",
      }}
    >
      <button
        onClick={() => setSidebarOpen(true)}
        aria-label="Menü"
        style={{
          width: 44,
          height: 44,
          borderRadius: "50%",
          border: "1px solid var(--line)",
          color: "var(--ink)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
          <line x1="4" y1="7" x2="20" y2="7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="4" y1="17" x2="14" y2="17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 28 }}>
        <div style={{ textAlign: "center" }}>
          <div className="eyebrow">Cihaz No. 001 — Yerel Depo</div>
          <h1 style={{ fontSize: 26, margin: "6px 0 0", fontWeight: 700 }}>Tarayıcı</h1>
        </div>

        <button
          onClick={openCamera}
          className="mono"
          style={{
            background: "var(--scan)",
            color: "#1a0a05",
            padding: "16px 36px",
            borderRadius: "var(--radius-sm)",
            fontSize: 15,
            fontWeight: 700,
          }}
        >
          ŞİMDİ TARA
        </button>

        <button
          onClick={() => setMenuOpen(true)}
          aria-label="Galeri, dosya veya kimlik seçenekleriyle ekle"
          style={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            border: "1px solid var(--line)",
            color: "var(--ink)",
            fontSize: 24,
            fontWeight: 700,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          +
        </button>
      </div>

      <input ref={galleryInputRef} type="file" accept="image/*" onChange={handleFileChosen} style={{ display: "none" }} />
      <input ref={filesInputRef} type="file" accept="image/*,application/pdf" onChange={handleFileChosen} style={{ display: "none" }} />

      <AddMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onCamera={openCamera}
        onGallery={openGallery}
        onFiles={openFiles}
        onKimlik={openKimlik}
      />

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </main>
  );
}
