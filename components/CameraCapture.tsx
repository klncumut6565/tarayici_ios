"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  onCapture: (canvas: HTMLCanvasElement) => void;
}

export default function CameraCapture({ onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1920 } },
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

      {ready && (
        <div
          aria-hidden
          style={
            {
              position: "absolute",
              left: "50%",
              top: "50%",
              // A4 oranı = 1 : 1.4142 (dikey). Önce genişliği viewport'a göre
              // sınırla, sonra yüksekliği oradan hesapla ki taşma olmasın.
              "--guide-w": "min(84vw, 63vh)",
              width: "var(--guide-w)",
              height: "calc(var(--guide-w) * 1.4142)",
              transform: "translate(-50%, -50%)",
              border: "1.5px solid var(--scan)",
              borderRadius: 10,
              overflow: "hidden",
              boxShadow: "0 0 0 999px rgba(0,0,0,0.35)",
            } as React.CSSProperties
          }
        >
          <div className="scanline" />
          {[
            { top: -1, left: -1 },
            { top: -1, right: -1 },
            { bottom: -1, left: -1 },
            { bottom: -1, right: -1 },
          ].map((pos, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                width: 18,
                height: 18,
                borderColor: "var(--scan)",
                borderStyle: "solid",
                borderWidth: 0,
                ...(pos.top !== undefined ? { top: pos.top, borderTopWidth: 3 } : { bottom: pos.bottom, borderBottomWidth: 3 }),
                ...(pos.left !== undefined ? { left: pos.left, borderLeftWidth: 3 } : { right: pos.right, borderRightWidth: 3 }),
              }}
            />
          ))}
        </div>
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
        BELGEYİ ÇERÇEVE İÇİNE YERLEŞTİR
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

      <style jsx>{`
        .scanline {
          position: absolute;
          left: 0;
          right: 0;
          height: 2px;
          background: var(--scan);
          box-shadow: 0 0 8px 1px var(--scan);
          animation: sweep 2.2s ease-in-out infinite;
        }
        @keyframes sweep {
          0% {
            top: 0%;
          }
          50% {
            top: 100%;
          }
          100% {
            top: 0%;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .scanline {
            animation: none;
            top: 50%;
          }
        }
      `}</style>
    </div>
  );
}
