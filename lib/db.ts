import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { ScanDocument, ScanPage } from "./types";

interface TarayiciDB extends DBSchema {
  documents: {
    key: string;
    value: ScanDocument;
    indexes: { "by-updatedAt": number };
  };
  pages: {
    key: string;
    value: ScanPage;
    indexes: { "by-docId": string };
  };
}

let dbPromise: Promise<IDBPDatabase<TarayiciDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<TarayiciDB>("tarayici-db", 1, {
      upgrade(db) {
        const docs = db.createObjectStore("documents", { keyPath: "id" });
        docs.createIndex("by-updatedAt", "updatedAt");

        const pages = db.createObjectStore("pages", { keyPath: "id" });
        pages.createIndex("by-docId", "docId");
      },
    });
  }
  return dbPromise;
}

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function createDocument(title = "Yeni Belge"): Promise<ScanDocument> {
  const db = await getDB();
  const now = Date.now();
  const doc: ScanDocument = {
    id: newId(),
    title,
    createdAt: now,
    updatedAt: now,
    pageCount: 0,
    uploadStatus: "pending",
  };
  await db.put("documents", doc);
  return doc;
}

/** Belgeyi "dış sisteme gönderildi" olarak işaretler (ScannerModule teslimatı sonrası çağrılır). */
export async function markDocumentUploaded(
  id: string,
  via: NonNullable<ScanDocument["uploadedVia"]> = "manual"
): Promise<void> {
  const db = await getDB();
  const doc = await db.get("documents", id);
  if (!doc) return;
  doc.uploadStatus = "uploaded";
  doc.uploadedAt = Date.now();
  doc.uploadedVia = via;
  doc.updatedAt = Date.now();
  await db.put("documents", doc);
}

/** Belgeyi tekrar "bekliyor" durumuna alır (kullanıcı yanlışlıkla işaretlediyse geri alabilsin diye). */
export async function markDocumentPending(id: string): Promise<void> {
  const db = await getDB();
  const doc = await db.get("documents", id);
  if (!doc) return;
  doc.uploadStatus = "pending";
  doc.uploadedAt = undefined;
  doc.uploadedVia = undefined;
  doc.updatedAt = Date.now();
  await db.put("documents", doc);
}

/** Belgeye TMGD klasörleme için tür etiketi atar (SDS/ADR/Fatura/...). */
export async function setDocumentType(id: string, docType: string): Promise<void> {
  const db = await getDB();
  const doc = await db.get("documents", id);
  if (!doc) return;
  doc.docType = docType;
  doc.updatedAt = Date.now();
  await db.put("documents", doc);
}

export async function listDocuments(): Promise<ScanDocument[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex("documents", "by-updatedAt");
  return all.reverse();
}

export async function getDocument(id: string): Promise<ScanDocument | undefined> {
  const db = await getDB();
  return db.get("documents", id);
}

export async function deleteDocument(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["documents", "pages"], "readwrite");
  await tx.objectStore("documents").delete(id);
  const pageIndex = tx.objectStore("pages").index("by-docId");
  let cursor = await pageIndex.openCursor(IDBKeyRange.only(id));
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}

export async function addPage(
  docId: string,
  imageData: Blob,
  extra: Partial<Pick<ScanPage, "filter" | "brightness" | "contrast">> = {}
): Promise<ScanPage> {
  const db = await getDB();
  const existing = await getPagesForDoc(docId);
  const page: ScanPage = {
    id: newId(),
    docId,
    order: existing.length,
    imageData,
    filter: extra.filter ?? "orijinal",
    brightness: extra.brightness ?? 0,
    contrast: extra.contrast ?? 0,
    createdAt: Date.now(),
  };
  const tx = db.transaction(["pages", "documents"], "readwrite");
  await tx.objectStore("pages").put(page);
  const doc = await tx.objectStore("documents").get(docId);
  if (doc) {
    doc.pageCount = existing.length + 1;
    doc.updatedAt = Date.now();
    if (!doc.coverThumb) doc.coverThumb = imageData;
    await tx.objectStore("documents").put(doc);
  }
  await tx.done;
  return page;
}

export async function updatePage(page: ScanPage): Promise<void> {
  const db = await getDB();
  await db.put("pages", page);
}

export async function deletePage(page: ScanPage): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["pages", "documents"], "readwrite");
  await tx.objectStore("pages").delete(page.id);
  const doc = await tx.objectStore("documents").get(page.docId);
  if (doc) {
    doc.pageCount = Math.max(0, doc.pageCount - 1);
    doc.updatedAt = Date.now();
    await tx.objectStore("documents").put(doc);
  }
  await tx.done;
}

export async function getPagesForDoc(docId: string): Promise<ScanPage[]> {
  const db = await getDB();
  const pages = await db.getAllFromIndex("pages", "by-docId", docId);
  return pages.sort((a, b) => a.order - b.order);
}

export async function reorderPages(pages: ScanPage[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction("pages", "readwrite");
  await Promise.all(
    pages.map((p, i) => tx.objectStore("pages").put({ ...p, order: i }))
  );
  await tx.done;
}
