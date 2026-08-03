"use client";

import { useEffect, useRef, useState } from "react";
import { applyFilter } from "@/lib/imageProcessing";
import type { FilterType } from "@/lib/types";

interface Props {
  source: HTMLCanvasElement;
  onSave: (canvas: HTMLCanvasElement, filter: FilterType, brightness: number, contrast: number) => void;
  onRetake: () => void;
  saving?: boolean;
}

const filters: { key: FilterType; label: string }[] = [
  { key: "orijinal", label: "Orijinal" },
  { key: "gri", label: "Gri" },
  { key: "siyahbeyaz", label: "S/B" },
  { key: "canlı", label: "Canlı" },
];

export default function AdjustPanel({ source, onSave, onRetake, saving }: Props) {
  const [filter, setFilter] = useState<FilterType>("orijinal");
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const previewRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const preview = previewRef.current;
    if (!preview) return;
    preview.width = source.width;
    preview.height = source.height;
    const ctx = preview.getContext("2d")!;
    ctx.drawImage(source, 0, 0);
    applyFilter(preview, filter, brightness, contrast);
  }, [source, filter, brightness, contrast]);

  function save() {
    const out = document.createElement("canvas");
    out.width = source.width;
    out.height = source.height;
    const ctx = out.getContext("2d")!;
    ctx.drawImage(source, 0, 0);
    applyFilter(out, filter, brightness, contrast);
    onSave(out, filter, brightness, contrast);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, minHeight: 0 }}>
        <canvas ref={previewRef} style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 6, boxShadow: "0 12px 30px var(--paper-shadow)" }} />
      </div>

      <div style={{ padding: "0 20px" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className="mono"
              style={{
                flex: 1,
                padding: "10px 0",
                borderRadius: "var(--radius-sm)",
                fontSize: 11,
                background: filter === f.key ? "var(--scan)" : "var(--surface)",
                color: filter === f.key ? "#1a0a05" : "var(--ink)",
                border: "1px solid " + (filter === f.key ? "var(--scan)" : "var(--line)"),
              }}
            >
              {f.label.toUpperCase()}
            </button>
          ))}
        </div>

        <label style={{ display: "block", marginBottom: 10 }}>
          <span className="eyebrow">Parlaklık</span>
          <input
            type="range"
            min={-50}
            max={50}
            value={brightness}
            onChange={(e) => setBrightness(Number(e.target.value))}
            style={{ width: "100%" }}
          />
        </label>
        <label style={{ display: "block", marginBottom: 18 }}>
          <span className="eyebrow">Kontrast</span>
          <input
            type="range"
            min={-50}
            max={50}
            value={contrast}
            onChange={(e) => setContrast(Number(e.target.value))}
            style={{ width: "100%" }}
          />
        </label>
      </div>

      <div style={{ display: "flex", gap: 10, padding: "0 20px calc(20px + var(--safe-bottom))" }}>
        <button
          onClick={() => {
            if (confirm("Bu fotoğrafı silip yeniden mi çekmek istiyorsun? Bu sayfa kaydedilmeyecek.")) onRetake();
          }}
          className="mono"
          style={{
            flex: 1,
            padding: 14,
            borderRadius: "var(--radius-sm)",
            background: "var(--surface)",
            border: "1px solid var(--line)",
            fontSize: 13,
          }}
        >
          TEKRAR ÇEK
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="mono"
          style={{
            flex: 2,
            padding: 14,
            borderRadius: "var(--radius-sm)",
            background: "var(--scan)",
            color: "#1a0a05",
            fontWeight: 700,
            fontSize: 13,
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? "KAYDEDİLİYOR…" : "SAYFAYI KAYDET"}
        </button>
      </div>
    </div>
  );
}
