import { pagesToPDF } from "./pdf";
import { getPagesForDoc, markDocumentUploaded } from "./db";
import type { ScanDocument } from "./types";

/**
 * ScannerModule — bu tarayıcı uygulamasının dış sistemlere (TMGD yönetim
 * sistemi gibi) açtığı entegrasyon sözleşmesi.
 *
 * ÖNEMLİ: tarayici_ios ayrı bir deploy edilen PWA olduğu için TMGD
 * tarafında bunu bir npm paketi gibi `import` edip `openScanner()`
 * çağıramazsın — iki ayrı Next.js uygulaması, iki ayrı origin. Modülerlik
 * burada iki şekilde sağlanıyor:
 *
 *  1) IFRAME GÖMME: TMGD, tarayıcıyı bir <iframe> içinde açarsa (aynı
 *     sekme, farklı origin), tarama bitince bu modül otomatik olarak
 *     `window.parent.postMessage(...)` ile PDF'i (base64) ve meta bilgiyi
 *     gönderir. TMGD tarafında sadece bir "message" listener yeterli —
 *     kullanıcı hiç indirme/yükleme yapmaz.
 *
 *  2) DEEP LINK + CALLBACK URL: TMGD, tarayıcıyı yeni sekmede/pencerede
 *     `?callbackUrl=...&returnTo=...&field_firmaId=42` gibi parametrelerle
 *     açarsa, tarama bitince PDF otomatik olarak `callbackUrl`'e
 *     multipart/form-data POST edilir, başarılı olursa `returnTo`'ya
 *     yönlendirilir.
 *
 * Her iki yol da başarılı olursa belge otomatik "uploaded" (yüklendi)
 * olarak işaretlenir; hiçbiri yoksa/başarısız olursa normal
 * paylaş/indir akışına düşülür (mevcut davranış korunur).
 */

export interface ScannerIntegrationOptions {
  /** PDF hazır olunca otomatik POST edilecek adres ("file" alanıyla multipart/form-data). */
  callbackUrl: string | null;
  /** callbackUrl'e eklenecek ekstra form alanları (URL'de field_<ad>=<değer> olarak verilir). */
  callbackFields: Record<string, string>;
  /** callback başarılı olduktan sonra yönlendirilecek adres. */
  returnTo: string | null;
}

export interface DeliveryResult {
  delivered: boolean;
  method: "postMessage" | "callback" | "manual";
  error?: string;
}

/** URL search params'tan entegrasyon seçeneklerini okur (örn. /tara?callbackUrl=...&field_firmaId=42). */
export function readIntegrationOptions(searchParams: URLSearchParams): ScannerIntegrationOptions {
  const callbackFields: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    if (key.startsWith("field_")) callbackFields[key.slice("field_".length)] = value;
  });
  return {
    callbackUrl: searchParams.get("callbackUrl"),
    callbackFields,
    returnTo: searchParams.get("returnTo"),
  };
}

/** Bu sayfa, entegrasyon parametrelerini koruyarak devam edecek bir URL kuyruğu üretir. */
export function appendIntegrationParams(path: string, options: ScannerIntegrationOptions): string {
  const params = new URLSearchParams();
  if (options.callbackUrl) params.set("callbackUrl", options.callbackUrl);
  if (options.returnTo) params.set("returnTo", options.returnTo);
  Object.entries(options.callbackFields).forEach(([k, v]) => params.set(`field_${k}`, v));
  const qs = params.toString();
  if (!qs) return path;
  return path.includes("?") ? `${path}&${qs}` : `${path}?${qs}`;
}

/** Uygulama bir iframe içinde mi açılmış? (TMGD gibi bir host tarafından gömülmüş olabilir) */
export function isEmbedded(): boolean {
  try {
    return typeof window !== "undefined" && window.self !== window.top;
  } catch {
    return true; // cross-origin erişim engellenmişse muhtemelen embedded'dir
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Belgeyi PDF'e çevirip bağlama göre en uygun teslim yöntemiyle dış
 * sisteme iletmeyi dener. Hiçbir entegrasyon aktif değilse (veya
 * teslimat başarısız olursa) `{ delivered: false, method: "manual" }`
 * döner ve çağıran taraf normal paylaş/indir akışına düşer.
 */
export async function deliverDocument(
  doc: ScanDocument,
  integration: ScannerIntegrationOptions
): Promise<DeliveryResult> {
  const pages = await getPagesForDoc(doc.id);
  const pdfBlob = await pagesToPDF(pages, doc.title);
  const filename = `${doc.title.replace(/[^\p{L}\p{N}\s-]/gu, "").trim() || "belge"}.pdf`;

  if (isEmbedded()) {
    try {
      const base64 = await blobToBase64(pdfBlob);
      window.parent.postMessage(
        {
          type: "tarayici-ios:scan-complete",
          documentId: doc.id,
          title: doc.title,
          pageCount: pages.length,
          filename,
          docType: doc.docType ?? null,
          pdfBase64: base64,
        },
        "*"
      );
      await markDocumentUploaded(doc.id, "postMessage");
      return { delivered: true, method: "postMessage" };
    } catch (err) {
      console.error("[tarayici:scanner-module] postMessage teslimatı başarısız:", err);
      // devam et, callbackUrl varsa onu dene
    }
  }

  if (integration.callbackUrl) {
    try {
      const form = new FormData();
      form.append("file", pdfBlob, filename);
      form.append("documentId", doc.id);
      form.append("title", doc.title);
      form.append("pageCount", String(pages.length));
      if (doc.docType) form.append("docType", doc.docType);
      Object.entries(integration.callbackFields).forEach(([k, v]) => form.append(k, v));

      const res = await fetch(integration.callbackUrl, { method: "POST", body: form });
      if (!res.ok) throw new Error(`Sunucu HTTP ${res.status} döndürdü`);
      await markDocumentUploaded(doc.id, "callback");
      return { delivered: true, method: "callback" };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[tarayici:scanner-module] callback teslimatı başarısız:", msg);
      return { delivered: false, method: "callback", error: msg };
    }
  }

  return { delivered: false, method: "manual" };
}

export function hasActiveIntegration(integration: ScannerIntegrationOptions): boolean {
  return isEmbedded() || !!integration.callbackUrl;
}
