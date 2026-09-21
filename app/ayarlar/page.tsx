"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CAMERA_PRESETS, getCameraPresetId, setCameraPresetId } from "@/lib/cameraSettings";

export default function AyarlarPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<string>("auto");

  useEffect(() => {
    setSelected(getCameraPresetId());
  }, []);

  function choose(id: string) {
    setSelected(id);
    setCameraPresetId(id);
  }

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        padding: "calc(20px + var(--safe-top)) 20px calc(24px + var(--safe-bottom))",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button
          onClick={() => router.back()}
          aria-label="Geri"
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            border: "1px solid var(--line)",
            color: "var(--ink)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
          }}
        >
          ‹
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Ayarlar</h1>
      </div>

      <div className="eyebrow" style={{ marginBottom: 8 }}>
        KAMERA ÇÖZÜNÜRLÜĞÜ
      </div>
      <p style={{ fontSize: 13, color: "var(--ink-dim)", margin: "0 0 16px", lineHeight: 1.5 }}>
        Bazı cihaz/tarayıcı kombinasyonlarında kamera akışı otomatik dikey
        oranı doğru vermeyebilir. Sorun yaşıyorsan aşağıdan sabit bir
        çözünürlük seç — bir sonraki kamera açılışında uygulanır.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {CAMERA_PRESETS.map((preset) => {
          const active = selected === preset.id;
          return (
            <button
              key={preset.id}
              onClick={() => choose(preset.id)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 16px",
                borderRadius: "var(--radius-sm)",
                border: `1px solid ${active ? "var(--scan)" : "var(--line)"}`,
                background: active ? "rgba(255,143,0,0.1)" : "transparent",
                textAlign: "left",
              }}
            >
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>{preset.label}</div>
                <div className="mono" style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 2 }}>
                  {preset.sublabel}
                </div>
              </div>
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  border: `2px solid ${active ? "var(--scan)" : "var(--line)"}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {active && <div style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--scan)" }} />}
              </div>
            </button>
          );
        })}
      </div>
    </main>
  );
}
