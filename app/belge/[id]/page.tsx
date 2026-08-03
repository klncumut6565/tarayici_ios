"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  getDocument,
  getPagesForDoc,
  deletePage,
  reorderPages,
  updatePage,
  markDocumentUploaded,
  markDocumentPending,
} from "@/lib/db";
import type { ScanDocument, ScanPage } from "@/lib/types";
import { pagesToPDF, downloadBlob, sharePDF } from "@/lib/pdf";
import { blobToImage, canvasToBlob, rotateCanvas90 } from "@/lib/imageProcessing";
import {
  readIntegrationOptions,
  hasActiveIntegration,
  isEmbedded,
  deliverDocument,
} from "@/lib/scannerModule";
import PdfPreview from "@/components/PdfPreview";

export default function DocumentPage() {
  return (
    <Suspense fallback={null}>
      <DocumentView />
    </Suspense>
  );
}

function DocumentView() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const integration = readIntegrationOptions(searchParams);
  const integrationActive = hasActiveIntegration(integration);

  const [doc, setDoc] = useState<ScanDocument | null>(null);
  const [pages, setPages] = useState<ScanPage[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [preparingPreview, setPreparingPreview] = useState(false);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [sendingIntegration, setSendingIntegration] = useState(false);
  const [integrationError, setIntegrationError] = useState<string | null>(null);

  async function reload() {
    const [d, p] = await Promise.all([getDocument(id), getPagesForDoc(id)]);
    setDoc(d ?? null);
    setPages(p);
    const urls: Record<string, string> = {};
    p.forEach((page) => (urls[page.id] = URL.createObjectURL(page.imageData)));
    setThumbs(urls);
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function move(index: number, dir: -1 | 1) {
    const next = [...pages];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setPages(next);
    await reorderPages(next);
  }

  async function remove(page: ScanPage) {
    if (!confirm("Bu sayfayı silmek istediğine emin misin?")) return;
    await deletePage(page);
    reload();
  }

  async function rotate(page: ScanPage) {
    const img = await blobToImage(page.imageData);
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    canvas.getContext("2d")!.drawImage(img, 0, 0);
    const rotated = rotateCanvas90(canvas);
    const blob = await canvasToBlob(rotated);
    await updatePage({ ...page, imageData: blob });
    reload();
  }

  async function openPreview() {
    if (pages.length === 0 || !doc) return;
    setPreparingPreview(true);
    setIntegrationError(null);
    try {
      const blob = await pagesToPDF(pages, doc.title);
      setPreviewBlob(blob);
    } finally {
      setPreparingPreview(false);
    }
  }

  function filenameFor(d: ScanDocument) {
    return `${d.title.replace(/[^\p{L}\p{N}\s-]/gu, "").trim() || "belge"}.pdf`;
  }

  async function handleShareOrDownload() {
    if (!previewBlob || !doc) return;
    const filename = filenameFor(doc);
    const shared = await sharePDF(previewBlob, filename);
    if (!shared) downloadBlob(previewBlob, filename);
  }

  async function handleIntegrationSend() {
    if (!doc) return;
    setSendingIntegration(true);
    setIntegrationError(null);
    try {
      const result = await deliverDocument(doc, integration);
      if (result.delivered) {
        setPreviewBlob(null);
        await reload();
        if (integration.returnTo) {
          window.location.href = integration.returnTo;
        }
      } else {
        setIntegrationError(result.error ?? "Bilinmeyen hata");
      }
    } finally {
      setSendingIntegration(false);
    }
  }

  async function toggleUploadStatus() {
    if (!doc) return;
    if (doc.uploadStatus === "uploaded") await markDocumentPending(doc.id);
    else await markDocumentUploaded(doc.id, "manual");
    reload();
  }

  if (!doc) {
    return (
      <main style={{ padding: 20 }}>
        <p style={{ color: "var(--ink-dim)" }}>Belge bulunamadı.</p>
      </main>
    );
  }

  const uploaded = doc.uploadStatus === "uploaded";

  return (
    <main style={{ padding: "calc(20px + var(--safe-top)) 20px 24px" }}>
      <button onClick={() => router.push("/")} className="mono" style={{ color: "var(--ink-dim)", fontSize: 12, marginBottom: 14 }}>
        ← BELGELER
      </button>

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, margin: "0 0 4px", fontWeight: 700 }}>{doc.title}</h1>
          <div className="eyebrow">{pages.length} SAYFA</div>
        </div>
        <button
          onClick={toggleUploadStatus}
          className="mono"
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: "6px 10px",
            borderRadius: 999,
            background: uploaded ? "var(--ok-dim, rgba(60,200,120,0.15))" : "rgba(255,143,0,0.15)",
            color: uploaded ? "var(--ok)" : "var(--scan)",
            border: `1px solid ${uploaded ? "var(--ok)" : "var(--scan)"}`,
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {uploaded ? "✓ YÜKLENDİ" : "YÜKLENMEDİ"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, margin: "20px 0 24px" }}>
        {pages.map((page, i) => (
          <div key={page.id} style={{ background: "var(--surface)", borderRadius: "var(--radius-md)", overflow: "hidden", border: "1px solid var(--line)" }}>
            <div style={{ aspectRatio: "3/4", background: "#000" }}>
              {thumbs[page.id] && (
                <img src={thumbs[page.id]} alt={`Sayfa ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              )}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 8px" }}>
              <span className="mono" style={{ fontSize: 10, color: "var(--ink-dim)" }}>{i + 1}</span>
              <div style={{ display: "flex", gap: 4 }}>
                <IconButton label="Sola taşı" onClick={() => move(i, -1)} disabled={i === 0}>↑</IconButton>
                <IconButton label="Sağa taşı" onClick={() => move(i, 1)} disabled={i === pages.length - 1}>↓</IconButton>
                <IconButton label="Döndür" onClick={() => rotate(page)}>⟳</IconButton>
                <IconButton label="Sil" onClick={() => remove(page)}>×</IconButton>
              </div>
            </div>
          </div>
        ))}

        <button
          onClick={() => router.push(`/tara?doc=${doc.id}`)}
          className="mono"
          style={{
            aspectRatio: "3/4",
            border: "1px dashed var(--line)",
            borderRadius: "var(--radius-md)",
            color: "var(--ink-dim)",
            fontSize: 12,
          }}
        >
          + SAYFA EKLE
        </button>
      </div>

      {integrationActive && (
        <div
          className="mono"
          style={{
            fontSize: 10,
            color: "var(--ink-dim)",
            border: "1px dashed var(--line)",
            borderRadius: "var(--radius-sm)",
            padding: "8px 10px",
            marginBottom: 12,
          }}
        >
          {isEmbedded() ? "Bu ekran bir üst sistem içine gömülü — PDF hazır olunca otomatik iletilecek." : "Dış sistem bağlantısı algılandı — PDF, önizleme ekranından gönderilebilir."}
        </div>
      )}

      <button
        onClick={openPreview}
        disabled={preparingPreview || pages.length === 0}
        className="mono"
        style={{
          width: "100%",
          padding: 16,
          borderRadius: "var(--radius-sm)",
          background: "var(--scan)",
          color: "#1a0a05",
          fontWeight: 700,
          fontSize: 14,
          opacity: preparingPreview || pages.length === 0 ? 0.5 : 1,
        }}
      >
        {preparingPreview ? "PDF HAZIRLANIYOR…" : "PDF ÖNİZLE"}
      </button>

      {previewBlob && doc && (
        <PdfPreview
          blob={previewBlob}
          filename={filenameFor(doc)}
          onClose={() => {
            setPreviewBlob(null);
            setIntegrationError(null);
          }}
          onShareOrDownload={handleShareOrDownload}
          integrationLabel={integrationActive ? (isEmbedded() ? "OTOMATİK GÖNDER" : "TMGD'YE GÖNDER") : undefined}
          onIntegrationSend={integrationActive ? handleIntegrationSend : undefined}
          sendingIntegration={sendingIntegration}
          integrationError={integrationError}
        />
      )}
    </main>
  );
}

function IconButton({
  children,
  onClick,
  label,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      style={{
        width: 24,
        height: 24,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: disabled ? "var(--line)" : "var(--ink-dim)",
        fontSize: 13,
      }}
    >
      {children}
    </button>
  );
}
