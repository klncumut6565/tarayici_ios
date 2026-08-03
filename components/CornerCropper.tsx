"use client";

import { useEffect, useRef, useState } from "react";
import type { Point } from "@/lib/imageProcessing";
import { detectDocumentCorners } from "@/lib/edgeDetection";

interface Props {
  image: HTMLCanvasElement;
  onConfirm: (corners: [Point, Point, Point, Point]) => void;
  /** İptal/geri tuşuna basılınca çağrılır. Verilmezse tuş gösterilmez. */
  onCancel?: () => void;
}

type CornerKey = "tl" | "tr" | "br" | "bl";

export default function CornerCropper({ image, onConfirm, onCancel }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });
  const [corners, setCorners] = useState<Record<CornerKey, Point> | null>(null);
  const [detecting, setDetecting] = useState(true);
  const [autoDetected, setAutoDetected] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);
  const [draggingKey, setDraggingKey] = useState<CornerKey | null>(null);
  const dragging = useRef<CornerKey | null>(null);
  const userAdjusted = useRef(false);

  function fallbackCorners(w: number, h: number): Record<CornerKey, Point> {
    const margin = 0.08;
    return {
      tl: { x: w * margin, y: h * margin },
      tr: { x: w * (1 - margin), y: h * margin },
      br: { x: w * (1 - margin), y: h * (1 - margin) },
      bl: { x: w * margin, y: h * (1 - margin) },
    };
  }

  useEffect(() => {
    let cancelled = false;

    function measure() {
      const el = containerRef.current;
      if (!el) return;
      const s = Math.min(el.clientWidth / image.width, el.clientHeight / image.height);
      const w = image.width * s;
      const h = image.height * s;
      setDisplaySize({ width: w, height: h });
      // Otomatik algılama henüz sonuçlanmadıysa veya kullanıcı köşeleri
      // kendi eliyle değiştirmemişse varsayılan köşeleri göster; algılama
      // biterse aşağıdaki blok gerçek köşelerle güncelleyecek.
      if (!userAdjusted.current) setCorners(fallbackCorners(w, h));
    }

    measure();
    window.addEventListener("resize", measure);

    setDetecting(true);
    setAutoDetected(false);
    setDebugInfo(null);
    detectDocumentCorners(image)
      .then(({ corners: found, debug }) => {
        setDebugInfo(debug);
        if (cancelled || !found || userAdjusted.current) return;
        const el = containerRef.current;
        if (!el) return;
        const s = Math.min(el.clientWidth / image.width, el.clientHeight / image.height);
        setCorners({
          tl: { x: found[0].x * s, y: found[0].y * s },
          tr: { x: found[1].x * s, y: found[1].y * s },
          br: { x: found[2].x * s, y: found[2].y * s },
          bl: { x: found[3].x * s, y: found[3].y * s },
        });
        setAutoDetected(true);
      })
      .catch((err) => {
        // Beklenmedik (yakalanmamış) bir hata olursa varsayılan köşelerle
        // devam edilir, ama sebebi ekranda görünür kalsın diye kaydediyoruz.
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[tarayici:edge] beklenmeyen hata:", msg);
        setDebugInfo(`Beklenmeyen hata: ${msg}`);
      })
      .finally(() => {
        if (!cancelled) setDetecting(false);
      });

    return () => {
      cancelled = true;
      window.removeEventListener("resize", measure);
    };
  }, [image]);

  function handlePointerDown(key: CornerKey) {
    dragging.current = key;
    userAdjusted.current = true;
    setDraggingKey(key);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragging.current || !corners) return;
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const offsetX = (rect.width - displaySize.width) / 2;
    const offsetY = (rect.height - displaySize.height) / 2;
    const x = Math.min(Math.max(e.clientX - rect.left - offsetX, 0), displaySize.width);
    const y = Math.min(Math.max(e.clientY - rect.top - offsetY, 0), displaySize.height);
    setCorners({ ...corners, [dragging.current]: { x, y } });
  }

  function handlePointerUp() {
    dragging.current = null;
    setDraggingKey(null);
  }

  function confirm() {
    if (!corners) return;
    const scale = image.width / displaySize.width;
    const toImg = (p: Point): Point => ({ x: p.x * scale, y: p.y * scale });
    onConfirm([toImg(corners.tl), toImg(corners.tr), toImg(corners.br), toImg(corners.bl)]);
  }

  const imgUrl = image.toDataURL("image/jpeg", 0.85);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000", display: "flex", flexDirection: "column" }}>
      {onCancel && (
        <button
          onClick={onCancel}
          aria-label="İptal / geri"
          style={{
            position: "absolute",
            top: "calc(16px + var(--safe-top))",
            left: 16,
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "rgba(0,0,0,0.55)",
            color: "#fff",
            fontSize: 18,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 15,
          }}
        >
          ×
        </button>
      )}
      <div
        ref={containerRef}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{ flex: 1, position: "relative", touchAction: "none" }}
      >
        {displaySize.width > 0 && (
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: displaySize.width,
              height: displaySize.height,
              transform: "translate(-50%, -50%)",
            }}
          >
            <img src={imgUrl} alt="" style={{ width: "100%", height: "100%", display: "block" }} draggable={false} />

            {corners && (
              <svg
                width={displaySize.width}
                height={displaySize.height}
                style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
              >
                <polygon
                  points={`${corners.tl.x},${corners.tl.y} ${corners.tr.x},${corners.tr.y} ${corners.br.x},${corners.br.y} ${corners.bl.x},${corners.bl.y}`}
                  fill="rgba(255,90,54,0.14)"
                  stroke="var(--scan)"
                  strokeWidth={2}
                />
              </svg>
            )}

            {corners &&
              (Object.keys(corners) as CornerKey[]).map((key) => (
                <div
                  key={key}
                  onPointerDown={() => handlePointerDown(key)}
                  style={{
                    position: "absolute",
                    left: corners[key].x,
                    top: corners[key].y,
                    width: 30,
                    height: 30,
                    marginLeft: -15,
                    marginTop: -15,
                    borderRadius: "50%",
                    background: "var(--scan)",
                    border: "3px solid #fff",
                    touchAction: "none",
                  }}
                />
              ))}

            {corners && draggingKey && (
              <Magnifier point={corners[draggingKey]} imgUrl={imgUrl} displaySize={displaySize} />
            )}
          </div>
        )}
      </div>

      <div
        className="eyebrow"
        style={{ textAlign: "center", color: "#fff", opacity: 0.7, padding: "10px 20px 0" }}
      >
        {detecting
          ? "KENARLAR ALGILANIYOR…"
          : autoDetected
          ? "KENARLAR OTOMATİK ALGILANDI — GEREKİRSE SÜRÜKLE"
          : "KÖŞELERİ BELGENİN KENARLARINA SÜRÜKLE"}
      </div>

      {!detecting && debugInfo && (
        <div
          className="mono"
          style={{
            textAlign: "center",
            color: autoDetected ? "var(--ok)" : "var(--scan)",
            opacity: 0.85,
            fontSize: 10,
            lineHeight: 1.4,
            padding: "6px 20px 0",
          }}
        >
          {debugInfo}
        </div>
      )}

      <div style={{ padding: "16px 20px calc(20px + var(--safe-bottom))" }}>
        <button
          onClick={confirm}
          className="mono"
          style={{
            width: "100%",
            background: "var(--scan)",
            color: "#1a0a05",
            padding: "14px",
            borderRadius: "var(--radius-sm)",
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          DÜZELT VE DEVAM ET
        </button>
      </div>
    </div>
  );
}

const LOUPE_SIZE = 108;
const LOUPE_ZOOM = 2.6;

/**
 * Sürüklenen köşenin üstünde açılan büyüteç: parmağın altında kalan
 * bölgeyi büyütülmüş olarak gösterir, tam ortadaki artı işareti gerçek
 * hedef noktayı belirtir. photoscanner-web'deki hassas kırpma hissi.
 */
function Magnifier({
  point,
  imgUrl,
  displaySize,
}: {
  point: Point;
  imgUrl: string;
  displaySize: { width: number; height: number };
}) {
  // Büyüteci parmağın/dokunuşun üstüne, görünür alan dışına taşmayacak
  // şekilde yerleştir.
  const clampedX = Math.min(Math.max(point.x, LOUPE_SIZE / 2), displaySize.width - LOUPE_SIZE / 2);
  const top = point.y > LOUPE_SIZE + 40 ? point.y - LOUPE_SIZE - 24 : point.y + 36;

  return (
    <div
      style={{
        position: "absolute",
        left: clampedX,
        top,
        width: LOUPE_SIZE,
        height: LOUPE_SIZE,
        marginLeft: -LOUPE_SIZE / 2,
        borderRadius: "50%",
        overflow: "hidden",
        border: "3px solid var(--scan)",
        boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
        pointerEvents: "none",
        backgroundImage: `url(${imgUrl})`,
        backgroundRepeat: "no-repeat",
        backgroundSize: `${displaySize.width * LOUPE_ZOOM}px ${displaySize.height * LOUPE_ZOOM}px`,
        backgroundPosition: `${-(point.x * LOUPE_ZOOM - LOUPE_SIZE / 2)}px ${-(point.y * LOUPE_ZOOM - LOUPE_SIZE / 2)}px`,
        zIndex: 10,
      }}
    >
      {/* Merkez artı işareti — tam olarak hangi noktanın seçildiğini gösterir */}
      <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "rgba(255,90,54,0.9)" }} />
      <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 1, background: "rgba(255,90,54,0.9)" }} />
    </div>
  );
}
