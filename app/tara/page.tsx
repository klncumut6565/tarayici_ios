"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import CameraCapture from "@/components/CameraCapture";
import CornerCropper from "@/components/CornerCropper";
import AdjustPanel from "@/components/AdjustPanel";
import { warpToRectangle, canvasToBlob, blobToImage, type Point } from "@/lib/imageProcessing";
import { addPage, createDocument } from "@/lib/db";
import { takePendingImport } from "@/lib/pendingImport";
import { readIntegrationOptions, appendIntegrationParams } from "@/lib/scannerModule";
import { A4_ASPECT, ID_CARD_ASPECT } from "@/lib/documentSizes";
import type { FilterType } from "@/lib/types";

type Step = "kamera" | "kirp" | "ayarla";

export default function TaraPage() {
  return (
    <Suspense fallback={null}>
      <TaraFlow />
    </Suspense>
  );
}

function TaraFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const docIdRef = useRef<string | null>(searchParams.get("doc"));
  const isKimlik = searchParams.get("mode") === "kimlik";

  const [step, setStep] = useState<Step>("kamera");
  const [captured, setCaptured] = useState<HTMLCanvasElement | null>(null);
  const [warped, setWarped] = useState<HTMLCanvasElement | null>(null);
  const [saving, setSaving] = useState(false);
  const [pageCount, setPageCount] = useState(0);
  // A4 belge ve kimlik/kart (ISO/IEC 7810 ID-1, kredi kartıyla aynı
  // fiziksel boyut: 85,60mm x 53,98mm) oranları lib/documentSizes.ts'ten.
  const expectedAspect = isKimlik ? ID_CARD_ASPECT : A4_ASPECT;

  // Kimlik modu tam olarak 2 aşamalı: önce ön yüz, sonra arka yüz.
  // pageCount buradan türetilir — kullanıcı ayrıca "kaç sayfa" diye
  // düşünmek zorunda kalmaz, sadece "ön" ve "arka" görür.
  const kimlikStage: "on" | "arka" | "tamam" = pageCount === 0 ? "on" : pageCount === 1 ? "arka" : "tamam";
  const guideLabel = isKimlik
    ? kimlikStage === "on"
      ? "1/2 — KİMLİĞİN ÖN YÜZÜNÜ ÇERÇEVEYE YERLEŞTİR"
      : "2/2 — KİMLİĞİN ARKA YÜZÜNÜ ÇERÇEVEYE YERLEŞTİR"
    : "BELGEYİ ÇERÇEVE İÇİNE YERLEŞTİR";

  // Ana sayfadan "Galeri" veya "Dosyalardan Yükle" ile gelindiyse, bekleyen
  // görüntüyü doğrudan kırpma adımına aktar; kamera adımını atla.
  useEffect(() => {
    const pending = takePendingImport();
    if (!pending) return;
    blobToImage(pending.file).then((img) => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext("2d")!.drawImage(img, 0, 0);
      setCaptured(canvas);
      setStep("kirp");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCapture = useCallback((canvas: HTMLCanvasElement) => {
    setCaptured(canvas);
    setStep("kirp");
  }, []);

  function handleCropConfirm(corners: [Point, Point, Point, Point]) {
    if (!captured) return;
    const outW = 1200;
    const outH = Math.round(
      (outW *
        (dist(corners[3], corners[0]) + dist(corners[2], corners[1]))) /
        (dist(corners[0], corners[1]) + dist(corners[3], corners[2]))
    );
    const result = warpToRectangle(captured, corners, outW, Math.max(outH, 400));
    setWarped(result);
    setStep("ayarla");
  }

  async function handleSave(canvas: HTMLCanvasElement, filter: FilterType, brightness: number, contrast: number) {
    setSaving(true);
    try {
      if (!docIdRef.current) {
        const title = isKimlik
          ? `Kimlik ${new Date().toLocaleDateString("tr-TR")}`
          : `Belge ${new Date().toLocaleDateString("tr-TR")}`;
        const doc = await createDocument(title);
        docIdRef.current = doc.id;
      }
      const blob = await canvasToBlob(canvas);
      await addPage(docIdRef.current, blob, { filter, brightness, contrast });
      const newCount = pageCount + 1;
      setPageCount(newCount);
      setCaptured(null);
      setWarped(null);

      // Kimlik modunda tam 2 sayfa (ön+arka) yeterli — arka yüz
      // kaydedilir kaydedilmez otomatik tamamla, kullanıcı ayrıca
      // BİTİR'e basmak zorunda kalmasın.
      if (isKimlik && newCount >= 2) {
        finish();
      } else {
        setStep("kamera");
      }
    } finally {
      setSaving(false);
    }
  }

  function finish() {
    const integration = readIntegrationOptions(searchParams);
    const path = docIdRef.current ? `/belge/${docIdRef.current}` : "/";
    router.push(appendIntegrationParams(path, integration));
  }

  function cancelToStart() {
    const path = docIdRef.current ? `/belge/${docIdRef.current}` : "/";
    router.push(path);
  }

  return (
    <>
      {step === "kamera" && (
        <>
          <CameraCapture
            onCapture={handleCapture}
            onCancel={cancelToStart}
            guideAspect={expectedAspect}
            guideLabel={guideLabel}
          />

          {isKimlik && (
            <div
              style={{
                position: "fixed",
                top: "calc(52px + var(--safe-top))",
                left: 0,
                right: 0,
                display: "flex",
                justifyContent: "center",
                zIndex: 6,
                pointerEvents: "none",
              }}
            >
              <div
                className="mono"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  background: "rgba(19,22,25,0.85)",
                  padding: "8px 16px",
                  borderRadius: 999,
                  border: "1px solid var(--line)",
                }}
              >
                <StepDot active={kimlikStage === "on"} done={pageCount >= 1} label="ÖN YÜZ" />
                <div style={{ width: 16, height: 1, background: "var(--line)" }} />
                <StepDot active={kimlikStage === "arka"} done={pageCount >= 2} label="ARKA YÜZ" />
              </div>
            </div>
          )}

          {!isKimlik && pageCount > 0 && (
            <button
              onClick={finish}
              className="mono"
              style={{
                position: "fixed",
                bottom: "calc(40px + var(--safe-bottom))",
                right: 20,
                background: "rgba(19,22,25,0.85)",
                color: "var(--ok)",
                padding: "10px 16px",
                borderRadius: "var(--radius-sm)",
                fontSize: 12,
                zIndex: 5,
              }}
            >
              BİTİR ({pageCount})
            </button>
          )}
        </>
      )}

      {step === "kirp" && captured && (
        <CornerCropper
          image={captured}
          onConfirm={handleCropConfirm}
          expectedAspect={expectedAspect}
          onCancel={() => {
            setCaptured(null);
            setStep("kamera");
          }}
        />
      )}

      {step === "ayarla" && warped && (
        <AdjustPanel
          source={warped}
          saving={saving}
          onSave={handleSave}
          onRetake={() => {
            setWarped(null);
            setCaptured(null);
            setStep("kamera");
          }}
        />
      )}
    </>
  );
}

function dist(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function StepDot({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span
        style={{
          width: 18,
          height: 18,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 10,
          fontWeight: 700,
          flexShrink: 0,
          background: done ? "var(--ok)" : active ? "var(--scan)" : "transparent",
          color: done || active ? "#0a0c0e" : "var(--ink-dim)",
          border: done || active ? "none" : "1px solid var(--line)",
        }}
      >
        {done ? "✓" : ""}
      </span>
      <span
        style={{
          fontSize: 10,
          letterSpacing: "0.04em",
          color: active ? "var(--scan)" : done ? "var(--ok)" : "var(--ink-dim)",
          fontWeight: active ? 700 : 500,
        }}
      >
        {label}
      </span>
    </div>
  );
}
