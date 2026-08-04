"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { listDocuments, deleteDocument, getPagesForDoc, renameDocument } from "@/lib/db";
import { setPendingImport } from "@/lib/pendingImport";
import { pagesToPDF, downloadBlob, sharePDF, filenameForDoc } from "@/lib/pdf";
import AddMenu from "@/components/AddMenu";
import DocActionSheet from "@/components/DocActionSheet";
import Sidebar from "@/components/Sidebar";
import type { ScanDocument } from "@/lib/types";

export default function BelgelerimPage() {
  const [docs, setDocs] = useState<ScanDocument[] | null>(null);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [actionSheetDoc, setActionSheetDoc] = useState<ScanDocument | null>(null);
  const router = useRouter();
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);

  async function handleSaveDoc(doc: ScanDocument) {
    const pages = await getPagesForDoc(doc.id);
    const blob = await pagesToPDF(pages, doc.title);
    downloadBlob(blob, filenameForDoc(doc.title));
  }

  async function handleShareDoc(doc: ScanDocument) {
    const pages = await getPagesForDoc(doc.id);
    const blob = await pagesToPDF(pages, doc.title);
    const shared = await sharePDF(blob, filenameForDoc(doc.title));
    if (!shared) downloadBlob(blob, filenameForDoc(doc.title));
  }

  async function handleRenameDoc(doc: ScanDocument, newTitle: string) {
    await renameDocument(doc.id, newTitle);
    setDocs((prev) => prev?.map((d) => (d.id === doc.id ? { ...d, title: newTitle } : d)) ?? null);
  }

  useEffect(() => {
    listDocuments().then((d) => {
      setDocs(d);
      const urls: Record<string, string> = {};
      d.forEach((doc) => {
        if (doc.coverThumb) urls[doc.id] = URL.createObjectURL(doc.coverThumb);
      });
      setThumbs(urls);
    });
  }, []);

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Bu belgeyi silmek istediğine emin misin?")) return;
    await deleteDocument(id);
    setDocs((prev) => prev?.filter((d) => d.id !== id) ?? null);
  }

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
    <main style={{ padding: "calc(20px + var(--safe-top)) 20px 24px" }}>
      <header style={{ marginBottom: 24, display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 12 }}>
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Menü"
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              border: "1px solid var(--line)",
              color: "var(--ink)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              marginBottom: 2,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <line x1="4" y1="7" x2="20" y2="7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <line x1="4" y1="17" x2="14" y2="17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
          <div>
            <div className="eyebrow">Cihaz No. 001 — Yerel Depo</div>
            <h1 style={{ fontSize: 28, margin: "4px 0 0", fontWeight: 700 }}>Belgelerim</h1>
          </div>
        </div>
        <button
          onClick={() => setMenuOpen(true)}
          aria-label="Yeni belge ekle"
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: "var(--scan)",
            color: "#1a0a05",
            fontSize: 22,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          +
        </button>
      </header>

      {docs === null && <p style={{ color: "var(--ink-dim)" }}>Yükleniyor…</p>}

      {docs !== null && docs.length === 0 && (
        <div
          style={{
            border: "1px dashed var(--line)",
            borderRadius: "var(--radius-lg)",
            padding: "40px 20px",
            textAlign: "center",
            color: "var(--ink-dim)",
          }}
        >
          <p style={{ margin: "0 0 16px" }}>Henüz taranmış belge yok.</p>
          <button
            onClick={openCamera}
            className="mono"
            style={{
              background: "var(--scan)",
              color: "#1a0a05",
              padding: "10px 20px",
              borderRadius: "var(--radius-sm)",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            ŞİMDİ TARA
          </button>
          <div style={{ marginTop: 12 }}>
            <button
              onClick={() => setMenuOpen(true)}
              aria-label="Galeri, dosya veya kimlik seçenekleriyle ekle"
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                border: "1px solid var(--line)",
                color: "var(--ink)",
                fontSize: 18,
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              +
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {docs?.map((doc) => (
          <a
            key={doc.id}
            href={`/belge/${doc.id}`}
            onClick={(e) => {
              e.preventDefault();
              router.push(`/belge/${doc.id}`);
            }}
            style={{ display: "block" }}
          >
            <div
              style={{
                position: "relative",
                aspectRatio: "3/4",
                borderRadius: "var(--radius-md)",
                overflow: "hidden",
                background: "var(--surface)",
                border: "1px solid var(--line)",
              }}
            >
              {thumbs[doc.id] ? (
                <img
                  src={thumbs[doc.id]}
                  alt={doc.title}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--ink-dim)",
                    fontSize: 12,
                  }}
                >
                  boş
                </div>
              )}
              <div
                className="mono"
                style={{
                  position: "absolute",
                  top: 6,
                  left: 6,
                  fontSize: 9,
                  fontWeight: 700,
                  background: doc.uploadStatus === "uploaded" ? "rgba(60,200,120,0.85)" : "rgba(255,143,0,0.85)",
                  color: "#0a0c0e",
                  padding: "2px 6px",
                  borderRadius: 4,
                }}
              >
                {doc.uploadStatus === "uploaded" ? "✓ YÜKLENDİ" : "YÜKLENMEDİ"}
              </div>
              <button
                onClick={(e) => handleDelete(doc.id, e)}
                aria-label="Belgeyi sil"
                style={{
                  position: "absolute",
                  top: 6,
                  right: 6,
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  background: "rgba(10,12,14,0.7)",
                  color: "var(--ink)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ×
              </button>
              <div
                className="mono"
                style={{
                  position: "absolute",
                  bottom: 6,
                  left: 6,
                  fontSize: 10,
                  background: "rgba(10,12,14,0.7)",
                  padding: "2px 6px",
                  borderRadius: 4,
                }}
              >
                {doc.pageCount} SF
              </div>
              <div
                className="mono"
                style={{
                  position: "absolute",
                  bottom: 6,
                  right: 6,
                  fontSize: 9,
                  fontWeight: 700,
                  color: "var(--scan)",
                  background: "rgba(10,12,14,0.7)",
                  padding: "2px 6px",
                  borderRadius: 4,
                }}
              >
                PDF
              </div>
            </div>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setActionSheetDoc(doc);
              }}
              style={{ marginTop: 6, fontSize: 13, textAlign: "left", width: "100%" }}
            >
              <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {doc.title}
              </span>
            </button>
            <div className="eyebrow" style={{ fontSize: 10 }}>
              {new Date(doc.updatedAt).toLocaleDateString("tr-TR")}
            </div>
          </a>
        ))}
      </div>

      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChosen}
        style={{ display: "none" }}
      />
      <input
        ref={filesInputRef}
        type="file"
        accept="image/*,application/pdf"
        onChange={handleFileChosen}
        style={{ display: "none" }}
      />

      <AddMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onCamera={openCamera}
        onGallery={openGallery}
        onFiles={openFiles}
        onKimlik={openKimlik}
      />

      {actionSheetDoc && (
        <DocActionSheet
          doc={actionSheetDoc}
          onClose={() => setActionSheetDoc(null)}
          onSave={handleSaveDoc}
          onShare={handleShareDoc}
          onRename={handleRenameDoc}
        />
      )}

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </main>
  );
}
