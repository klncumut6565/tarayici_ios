"use client";

import { useEffect, useState } from "react";
import type { ScanDocument } from "@/lib/types";

interface Props {
  doc: ScanDocument;
  onClose: () => void;
  onSave: (doc: ScanDocument) => Promise<void>;
  onShare: (doc: ScanDocument) => Promise<void>;
  onRename: (doc: ScanDocument, newTitle: string) => Promise<void>;
}

type Busy = "save" | "share" | null;

export default function DocActionSheet({ doc, onClose, onSave, onShare, onRename }: Props) {
  const [mode, setMode] = useState<"menu" | "rename">("menu");
  const [titleDraft, setTitleDraft] = useState(doc.title);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMode("menu");
    setTitleDraft(doc.title);
    setError(null);
  }, [doc]);

  async function handleSave() {
    setBusy("save");
    setError(null);
    try {
      await onSave(doc);
      onClose();
    } catch {
      setError("Kaydedilemedi, tekrar dene.");
    } finally {
      setBusy(null);
    }
  }

  async function handleShare() {
    setBusy("share");
    setError(null);
    try {
      await onShare(doc);
      onClose();
    } catch {
      setError("Paylaşılamadı, tekrar dene.");
    } finally {
      setBusy(null);
    }
  }

  async function handleRenameSave() {
    const trimmed = titleDraft.trim();
    if (!trimmed || trimmed === doc.title) {
      onClose();
      return;
    }
    await onRename(doc, trimmed);
    onClose();
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        zIndex: 40,
        display: "flex",
        alignItems: "flex-end",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          background: "var(--surface)",
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          padding: "10px 16px calc(20px + var(--safe-bottom))",
          border: "1px solid var(--line)",
          borderBottom: "none",
        }}
      >
        <div
          style={{
            width: 36,
            height: 4,
            borderRadius: 2,
            background: "var(--line)",
            margin: "6px auto 14px",
          }}
        />

        {mode === "menu" ? (
          <>
            <div
              className="mono"
              style={{
                fontSize: 12,
                color: "var(--ink-dim)",
                textAlign: "center",
                marginBottom: 14,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {doc.title}
            </div>

            <SheetButton icon="⬇" label="Kaydet" sub="Cihaza indir" onClick={handleSave} loading={busy === "save"} />
            <SheetButton icon="↗" label="Paylaş" sub="AirDrop, WhatsApp, e-posta…" onClick={handleShare} loading={busy === "share"} />
            <SheetButton icon="✎" label="Adını Düzenle" onClick={() => setMode("rename")} />

            {error && (
              <div className="mono" style={{ color: "var(--scan)", fontSize: 11, textAlign: "center", marginTop: 8 }}>
                {error}
              </div>
            )}

            <button
              onClick={onClose}
              className="mono"
              style={{
                width: "100%",
                marginTop: 10,
                padding: 14,
                borderRadius: "var(--radius-sm)",
                background: "var(--surface2, rgba(255,255,255,0.06))",
                color: "var(--ink-dim)",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              Vazgeç
            </button>
          </>
        ) : (
          <>
            <div className="eyebrow" style={{ marginBottom: 8 }}>
              DOSYA ADI
            </div>
            <input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRenameSave();
                if (e.key === "Escape") setMode("menu");
              }}
              className="mono"
              style={{
                width: "100%",
                fontSize: 16,
                fontWeight: 600,
                background: "var(--bg, #0a0c0e)",
                border: "1px solid var(--scan)",
                borderRadius: "var(--radius-sm)",
                padding: "12px 14px",
                color: "var(--ink)",
                marginBottom: 14,
              }}
            />
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setMode("menu")}
                className="mono"
                style={{
                  flex: 1,
                  padding: 14,
                  borderRadius: "var(--radius-sm)",
                  background: "var(--surface2, rgba(255,255,255,0.06))",
                  color: "var(--ink-dim)",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Geri
              </button>
              <button
                onClick={handleRenameSave}
                className="mono"
                style={{
                  flex: 1,
                  padding: 14,
                  borderRadius: "var(--radius-sm)",
                  background: "var(--scan)",
                  color: "#1a0a05",
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                Kaydet
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SheetButton({
  icon,
  label,
  sub,
  onClick,
  loading,
}: {
  icon: string;
  label: string;
  sub?: string;
  onClick: () => void;
  loading?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "14px 8px",
        borderBottom: "1px solid var(--line)",
        opacity: loading ? 0.5 : 1,
        textAlign: "left",
      }}
    >
      <span
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: "rgba(255,143,0,0.12)",
          color: "var(--scan)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 15,
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <span style={{ flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{loading ? "İşleniyor…" : label}</div>
        {sub && <div style={{ fontSize: 11, color: "var(--ink-dim)" }}>{sub}</div>}
      </span>
    </button>
  );
}
