"use client";

import { useEffect, useState } from "react";

interface Props {
  blob: Blob;
  filename: string;
  onClose: () => void;
  onShareOrDownload: () => void;
  /** Aktif bir dış sistem entegrasyonu varsa (embedded/callbackUrl), o gönder butonu. */
  integrationLabel?: string;
  onIntegrationSend?: () => void;
  sendingIntegration?: boolean;
  integrationError?: string | null;
}

export default function PdfPreview({
  blob,
  filename,
  onClose,
  onShareOrDownload,
  integrationLabel,
  onIntegrationSend,
  sendingIntegration,
  integrationError,
}: Props) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const objUrl = URL.createObjectURL(blob);
    setUrl(objUrl);
    return () => URL.revokeObjectURL(objUrl);
  }, [blob]);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000", zIndex: 50, display: "flex", flexDirection: "column" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "calc(14px + var(--safe-top)) 16px 12px",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <button onClick={onClose} className="mono" style={{ color: "#fff", opacity: 0.7, fontSize: 13 }}>
          ← KAPAT
        </button>
        <span className="mono" style={{ color: "#fff", opacity: 0.9, fontSize: 12 }}>
          {filename}
        </span>
      </div>

      <div style={{ flex: 1, background: "#1a1a1a" }}>
        {url ? (
          <iframe
            src={url}
            title="PDF önizleme"
            style={{ width: "100%", height: "100%", border: "none", background: "#fff" }}
          />
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#fff" }}>
            Yükleniyor…
          </div>
        )}
      </div>

      <div style={{ padding: "16px 20px calc(20px + var(--safe-bottom))", display: "flex", flexDirection: "column", gap: 10 }}>
        {integrationLabel && onIntegrationSend && (
          <>
            <button
              onClick={onIntegrationSend}
              disabled={sendingIntegration}
              className="mono"
              style={{
                width: "100%",
                padding: 16,
                borderRadius: "var(--radius-sm)",
                background: "var(--ok)",
                color: "#062012",
                fontWeight: 700,
                fontSize: 14,
                opacity: sendingIntegration ? 0.6 : 1,
              }}
            >
              {sendingIntegration ? "GÖNDERİLİYOR…" : integrationLabel}
            </button>
            {integrationError && (
              <div className="mono" style={{ color: "var(--scan)", fontSize: 11, textAlign: "center" }}>
                Gönderilemedi: {integrationError} — aşağıdan indirip elle yükleyebilirsin.
              </div>
            )}
          </>
        )}

        <button
          onClick={onShareOrDownload}
          className="mono"
          style={{
            width: "100%",
            padding: 16,
            borderRadius: "var(--radius-sm)",
            background: integrationLabel ? "transparent" : "var(--scan)",
            border: integrationLabel ? "1px solid var(--line)" : "none",
            color: integrationLabel ? "#fff" : "#1a0a05",
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          PDF OLARAK PAYLAŞ / İNDİR
        </button>
      </div>
    </div>
  );
}
