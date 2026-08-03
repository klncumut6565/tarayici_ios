"use client";

import { useEffect, useRef, useState, useCallback, WheelEvent as ReactWheelEvent, TouchEvent as ReactTouchEvent } from "react";

interface Props {
  blob: Blob;
  filename: string;
  onClose: () => void;
  onShareOrDownload: () => void;
  integrationLabel?: string;
  onIntegrationSend?: () => void;
  sendingIntegration?: boolean;
  integrationError?: string | null;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.5;

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const pagesWrapRef = useRef<HTMLDivElement>(null);
  const [pageCanvases, setPageCanvases] = useState<HTMLCanvasElement[]>([]);
  const [baseWidth, setBaseWidth] = useState(0);
  const [baseHeight, setBaseHeight] = useState(0); // toplam (tüm sayfalar alt alta)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  const pinchState = useRef<{ startDist: number; startZoom: number } | null>(null);

  // PDF'i kendi kontrolümüzde render ediyoruz (pdf.js) — tarayıcının
  // native PDF eklentisine (iframe) GÜVENMİYORUZ, çünkü o eklenti iOS'ta
  // sayfayı ekrana sığdırmadan, %100 boyutta ("çok yakınlaşmış" görünen)
  // açıyor ve zoom davranışı cihazdan cihaza tutarsız. Burada varsayılan
  // olarak TELEFON GENİŞLİĞİNE TAM SIĞACAK şekilde çiziyoruz, zoom'u da
  // kendi buton + pinch kontrolümüzle veriyoruz (sayfa geneli pinch-zoom
  // kapalı olduğu için native zoom zaten çalışmıyordu).
  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        setLoading(true);
        setError(null);

        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

        const arrayBuffer = await blob.arrayBuffer();
        const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        if (cancelled) return;

        const containerWidth = scrollRef.current?.clientWidth || 360;
        const dpr = Math.min(window.devicePixelRatio || 1, 2.5);

        const canvases: HTMLCanvasElement[] = [];
        let totalHeightAtBaseWidth = 0;
        let widthAtBase = containerWidth;

        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const unscaledViewport = page.getViewport({ scale: 1 });
          const fitScale = containerWidth / unscaledViewport.width;
          const renderViewport = page.getViewport({ scale: fitScale * dpr });

          const canvas = document.createElement("canvas");
          canvas.width = Math.ceil(renderViewport.width);
          canvas.height = Math.ceil(renderViewport.height);
          canvas.style.width = "100%";
          canvas.style.display = "block";

          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          await page.render({ canvasContext: ctx, viewport: renderViewport }).promise;

          if (cancelled) return;

          canvases.push(canvas);
          totalHeightAtBaseWidth += renderViewport.height / dpr;
          widthAtBase = containerWidth;
        }

        if (cancelled) return;
        setPageCanvases(canvases);
        setBaseWidth(widthAtBase);
        setBaseHeight(totalHeightAtBaseWidth + (canvases.length - 1) * 10); // sayfalar arası 10px boşluk
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        setError(`PDF önizlemesi oluşturulamadı: ${msg}`);
        setLoading(false);
      }
    }

    render();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blob]);

  // Canvasları DOM'a bas (React state'inde tutmak yerine doğrudan ekle —
  // her render'da yeniden çizmemesi için).
  useEffect(() => {
    const wrap = pagesWrapRef.current;
    if (!wrap) return;
    wrap.innerHTML = "";
    pageCanvases.forEach((canvas, i) => {
      canvas.style.marginBottom = i < pageCanvases.length - 1 ? "10px" : "0";
      wrap.appendChild(canvas);
    });
  }, [pageCanvases]);

  const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

  const zoomIn = useCallback(() => setZoom((z) => clampZoom(z + ZOOM_STEP)), []);
  const zoomOut = useCallback(() => setZoom((z) => clampZoom(z - ZOOM_STEP)), []);
  const resetZoom = useCallback(() => setZoom(1), []);

  // İki parmak (pinch) ile yakınlaştırma
  const handleTouchStart = (e: ReactTouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchState.current = { startDist: Math.hypot(dx, dy), startZoom: zoom };
    }
  };

  const handleTouchMove = (e: ReactTouchEvent) => {
    if (e.touches.length === 2 && pinchState.current) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const ratio = dist / pinchState.current.startDist;
      setZoom(clampZoom(pinchState.current.startZoom * ratio));
    }
  };

  const handleTouchEnd = () => {
    pinchState.current = null;
  };

  // Masaüstü/trackpad: Ctrl/Cmd + tekerlek ile yakınlaştırma (isteğe bağlı, zararsız)
  const handleWheel = (e: ReactWheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    setZoom((z) => clampZoom(z - e.deltaY * 0.01));
  };

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
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={zoomOut}
            disabled={zoom <= MIN_ZOOM}
            aria-label="Uzaklaştır"
            className="mono"
            style={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.1)",
              color: "#fff",
              fontSize: 16,
              opacity: zoom <= MIN_ZOOM ? 0.3 : 1,
            }}
          >
            −
          </button>
          <button
            onClick={zoomIn}
            disabled={zoom >= MAX_ZOOM}
            aria-label="Yakınlaştır"
            className="mono"
            style={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.1)",
              color: "#fff",
              fontSize: 16,
              opacity: zoom >= MAX_ZOOM ? 0.3 : 1,
            }}
          >
            +
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
        style={{
          flex: 1,
          background: "#1a1a1a",
          overflow: "auto",
          display: "flex",
          justifyContent: "center",
          touchAction: "pan-x pan-y",
        }}
      >
        {loading && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", opacity: 0.7 }}>
            Yükleniyor…
          </div>
        )}
        {error && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "var(--scan)", padding: 24, textAlign: "center" }}>
            {error}
          </div>
        )}
        {!loading && !error && (
          <div
            style={{
              width: baseWidth * zoom,
              height: baseHeight * zoom,
              position: "relative",
              flexShrink: 0,
              margin: "12px 0",
            }}
          >
            <div
              ref={pagesWrapRef}
              style={{
                width: baseWidth,
                position: "absolute",
                top: 0,
                left: 0,
                transform: `scale(${zoom})`,
                transformOrigin: "top left",
              }}
            />
          </div>
        )}
      </div>

      {zoom > 1 && (
        <button
          onClick={resetZoom}
          className="mono"
          style={{
            position: "absolute",
            bottom: 160,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.7)",
            color: "var(--scan)",
            border: "1px solid var(--scan)",
            borderRadius: 20,
            padding: "8px 16px",
            fontSize: 12,
            zIndex: 10,
          }}
        >
          SIĞDIR (%{Math.round(zoom * 100)})
        </button>
      )}

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
