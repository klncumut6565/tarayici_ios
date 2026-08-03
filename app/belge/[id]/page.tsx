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
  setDocumentType,
  renameDocument,
} from "@/lib/db";
import { DOC_TYPES } from "@/lib/types";
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
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

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

  async function chooseDocType(type: string) {
    if (!doc) return;
    await setDocumentType(doc.id, doc.docType === type ? "" : type);
    reload();
  }

  function startRename() {
    if (!doc) return;
    setTitleDraft(doc.title);
    setEditingTitle(true);
  }

  async function saveTitle() {
    setEditingTitle(false);
    if (!doc) return;
    const trimmed = titleDraft.trim();
    if (!trimmed || trimmed === doc.title) return;
    await renameDocument(doc.id, trimmed);
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
        <div style={{ minWidth: 0, flex: 1 }}>
          {editingTitle ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                if (e.key === "Escape") setEditingTitle(false);
              }}
              className="mono"
              style={{
                fontSize: 18,
                fontWeight: 700,
                background: "var(--surface)",
                border: "1px solid var(--scan)",
                borderRadius: "var(--radius-sm)",
                padding: "5px 8px",
                color: "var(--ink)",
                width: "100%",
                marginBottom: 4,
              }}
            />
          ) : (
            <button
              onClick={startRename}
              aria-label="Belgeyi yeniden adlandır"
              style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4, textAlign: "left", maxWidth: "100%" }}
            >
              <h1 style={{ fontSize: 22, margin: 0, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis" }}>{doc.title}</h1>
              <span style={{ color: "var(--ink-dim)", fontSize: 13, flexShrink: 0 }}>✎</span>
            </button>
          )}
          <div className="eyebrow">
            {pages.length} SAYFA · PDF
          </div>
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

      <div className="eyebrow" style={{ marginTop: 18, marginBottom: 8 }}>
        BELGE TÜRÜ
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
        {DOC_TYPES.map((type) => {
          const active = doc.docType === type;
          return (
            <button
              key={type}
              onClick={() => chooseDocType(type)}
              className="mono"
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: "7px 12px",
                borderRadius: 999,
                background: active ? "var(--scan)" : "var(--surface)",
                color: active ? "#1a0a05" : "var(--ink-dim)",
                border: `1px solid ${active ? "var(--scan)" : "var(--line)"}`,
              }}
            >
              {type}
            </button>
          );
        })}
      </div>
      <div className="eyebrow" style={{ marginBottom: 20, fontSize: 9, opacity: 0.6 }}>
        {doc.docType ? `TMGD'ye gönderildiğinde "${doc.docType}" klasörüne yönlendirilir` : "Seçilirse TMGD'de otomatik klasörlenir"}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 24 }}>
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
