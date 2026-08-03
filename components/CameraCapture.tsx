"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  onCapture: (canvas: HTMLCanvasElement) => void;
  /** Kılavuz çerçevenin en/boy oranı (genişlik/yükseklik). Varsayılan A4. */
  guideAspect?: number;
  /** Kılavuz çerçevenin altındaki açıklama metni. */
  guideLabel?: string;
  /** Kapatma (geri) tuşuna basılınca çağrılır. Verilmezse tuş gösterilmez. */
  onCancel?: () => void;
}

export default function CameraCapture({
  onCapture,
  guideAspect = 1 / 1.4142,
  guideLabel = "BELGEYİ ÇERÇEVE İÇİNE YERLEŞTİR",
  onCancel,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 1706 } },
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

  function capture() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(video, 0, 0);
    onCapture(canvas);
  }

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

      <video
        ref={videoRef}
        playsInline
        muted
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />

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
        {guideLabel}
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
            border: "4px solid rgba(255,255,255,0.35)",
            opacity: ready ? 1 : 0.4,
          }}
        />
      </div>

    </div>
  );
}
