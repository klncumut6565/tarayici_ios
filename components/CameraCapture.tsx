"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { detectDocumentCorners } from "@/lib/edgeDetection";
import type { Point } from "@/lib/imageProcessing";
import { roundedQuadPath, suggestedCornerRadius } from "@/lib/roundedQuadPath";

interface Props {
  onCapture: (canvas: HTMLCanvasElement) => void;
  /** Kılavuz çerçevenin en/boy oranı (genişlik/yükseklik). Varsayılan A4. */
  guideAspect?: number;
  /** Kılavuz çerçevenin altındaki açıklama metni. */
  guideLabel?: string;
  /** Kapatma (geri) tuşuna basılınca çağrılır. Verilmezse tuş gösterilmez. */
  onCancel?: () => void;
}

type Quad = [Point, Point, Point, Point];

const LIVE_SAMPLE_WIDTH = 240;
const LIVE_INTERVAL_MS = 160; // Takip kareleri ucuz+öngörülebilir olduğu için sıkılaştırıldı
const SMOOTHING = 0.45;
const MISS_GRACE = 3; // art arda kaç başarısız denemeden sonra overlay kaybolsun
const TRACK_REFRESH_EVERY = 6; // her N karede bir, takip iyi gitse de tam taramayla drift'i düzelt

export default function CameraCapture({
  onCapture,
  guideAspect = 1 / 1.4142,
  guideLabel = "BELGEYİ ÇERÇEVE İÇİNE YERLEŞTİR",
  onCancel,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sampleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [liveQuad, setLiveQuad] = useState<Quad | null>(null);
  const smoothedRef = useRef<Quad | null>(null);
  const missCountRef = useRef(0);
  const busyRef = useRef(false);
  const lastSampleCornersRef = useRef<Quad | null>(null); // örnekleme (sample canvas) uzayında — takip için anchor
  const ticksSinceFullRef = useRef(0);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setReady(true);
        }
      } catch {
        setError("Kameraya erişilemedi. Tarayıcı izinlerini kontrol et.");
      }
    }
    start();

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Belge takibi: native uygulamaların yaptığı gibi "anchor + takip et".
  // İlk kare (ya da her TRACK_REFRESH_EVERY karede bir, ya da takip
  // kaybolduğunda) TAM tarama yapılır (maske+bağlı bileşen+hull). Aradaki
  // karelerde önceki köşelerin etrafında hafif bir kenar-oturtma
  // güncellemesi yapılır — sahne karmaşıklığından bağımsız, sabit ve
  // düşük maliyetli, kare-kareye zıplama olmadan çok daha akıcı.
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    const timer = setInterval(async () => {
      if (cancelled || busyRef.current) return;
      const video = videoRef.current;
      const container = containerRef.current;
      if (!video || !container || video.videoWidth === 0) return;

      busyRef.current = true;
      try {
        if (!sampleCanvasRef.current) sampleCanvasRef.current = document.createElement("canvas");
        const sample = sampleCanvasRef.current;
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        const sw = LIVE_SAMPLE_WIDTH;
        const sh = Math.round((vh / vw) * sw);
        sample.width = sw;
        sample.height = sh;
        const sctx = sample.getContext("2d", { willReadFrequently: true });
        if (!sctx) return;
        sctx.drawImage(video, 0, 0, sw, sh);

        const canTrack = lastSampleCornersRef.current !== null && ticksSinceFullRef.current < TRACK_REFRESH_EVERY;

        let result = canTrack
          ? await detectDocumentCorners(sample, "track", guideAspect, lastSampleCornersRef.current!)
          : await detectDocumentCorners(sample, "live", guideAspect);

        if (canTrack) {
          if (result.corners) {
            ticksSinceFullRef.current++;
          } else {
            // Takip kaybedildi — aynı karede hemen tam taramaya düş, bir
            // sonraki interval'ı beklemeyelim (görünür boşluk olmasın).
            result = await detectDocumentCorners(sample, "live", guideAspect);
            ticksSinceFullRef.current = 0;
          }
        } else {
          ticksSinceFullRef.current = 0;
        }

        if (cancelled) return;
        const { corners } = result;

        if (!corners) {
          lastSampleCornersRef.current = null;
          missCountRef.current++;
          if (missCountRef.current >= MISS_GRACE) {
            smoothedRef.current = null;
            setLiveQuad(null);
          }
          return;
        }
        missCountRef.current = 0;
        lastSampleCornersRef.current = corners;

        // Örnekleme uzayı -> video intrinsic piksel uzayı
        const toVideoSpace = (p: Point): Point => ({ x: (p.x / sw) * vw, y: (p.y / sh) * vh });

        // object-fit: contain haritalaması: video intrinsic -> ekran (container CSS px).
        // ÖNEMLİ: "cover" değil "contain" kullanıyoruz — kameranın gördüğü
        // hiçbir piksel kırpılmıyor/zoom edilmiyor, gerekirse üstte/altta
        // veya yanlarda siyah boşluk (letterbox) kalır.
        const cw = container.clientWidth;
        const ch = container.clientHeight;
        const containScale = Math.min(cw / vw, ch / vh);
        const offsetX = (cw - vw * containScale) / 2;
        const offsetY = (ch - vh * containScale) / 2;
        const toScreen = (p: Point): Point => ({
          x: p.x * containScale + offsetX,
          y: p.y * containScale + offsetY,
        });

        const screenQuad = corners.map((c) => toScreen(toVideoSpace(c))) as Quad;

        const prev = smoothedRef.current;
        const next: Quad = prev
          ? (screenQuad.map((p, i) => ({
              x: prev[i].x + (p.x - prev[i].x) * SMOOTHING,
              y: prev[i].y + (p.y - prev[i].y) * SMOOTHING,
            })) as Quad)
          : screenQuad;

        smoothedRef.current = next;
        setLiveQuad(next);
      } finally {
        busyRef.current = false;
      }
    }, LIVE_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [ready, guideAspect]);

  const capture = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(video, 0, 0);
    onCapture(canvas);
  }, [onCapture]);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000" }}>
      {error && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 32,
            textAlign: "center",
            color: "var(--ink-dim)",
          }}
        >
          {error}
        </div>
      )}

      <div ref={containerRef} style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
        <video
          ref={videoRef}
          playsInline
          muted
          style={{ width: "100%", height: "100%", objectFit: "contain", background: "#000" }}
        />

        {liveQuad && (
          <svg
            width="100%"
            height="100%"
            style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
          >
            <path
              d={roundedQuadPath(liveQuad, suggestedCornerRadius(liveQuad))}
              fill="rgba(255,90,54,0.12)"
              stroke="var(--scan)"
              strokeWidth={3}
              strokeLinejoin="round"
              style={{ transition: "opacity 150ms" }}
            />
            {liveQuad.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={5} fill="var(--scan)" />
            ))}
          </svg>
        )}
      </div>

      {onCancel && (
        <button
          onClick={onCancel}
          aria-label="Kapat"
          style={{
            position: "absolute",
            top: "calc(16px + var(--safe-top))",
            left: 16,
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "rgba(0,0,0,0.5)",
            color: "#fff",
            fontSize: 18,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 6,
          }}
        >
          ×
        </button>
      )}

      <div
        className="eyebrow"
        style={{
          position: "absolute",
          top: "calc(16px + var(--safe-top))",
          left: 20,
          right: 20,
          textAlign: "center",
          color: "#fff",
          opacity: 0.75,
        }}
      >
        {liveQuad ? "BELGE ALGILANDI — ÇEK" : guideLabel}
      </div>

      <div
        style={{
          position: "absolute",
          bottom: "calc(28px + var(--safe-bottom))",
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <button
          onClick={capture}
          disabled={!ready}
          aria-label="Fotoğraf çek"
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: "#fff",
            border: `4px solid ${liveQuad ? "var(--scan)" : "rgba(255,255,255,0.35)"}`,
            opacity: ready ? 1 : 0.4,
            transition: "border-color 150ms",
          }}
        />
      </div>
    </div>
  );
}
