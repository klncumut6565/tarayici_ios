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
      setPageCount((c) => c + 1);
      setCaptured(null);
      setWarped(null);
      setStep("kamera");
    } finally {
      setSaving(false);
    }
  }

  function finish() {
    const integration = readIntegrationOptions(searchParams);
    const path = docIdRef.current ? `/belge/${docIdRef.current}` : "/";
    router.push(appendIntegrationParams(path, integration));
  }

  return (
    <>
      {step === "kamera" && (
        <>
          <CameraCapture
            onCapture={handleCapture}
            guideAspect={isKimlik ? 1.586 : 1 / 1.4142}
            guideLabel={isKimlik ? "KİMLİĞİ ÇERÇEVEYE YERLEŞTİR (ÖN/ARKA AYRI ÇEK)" : "BELGEYİ ÇERÇEVE İÇİNE YERLEŞTİR"}
          />
          {pageCount > 0 && (
            <button
              onClick={finish}
              className="mono"
              style={{
                position: "fixed",
                top: "calc(16px + var(--safe-top))",
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
        <CornerCropper image={captured} onConfirm={handleCropConfirm} />
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
