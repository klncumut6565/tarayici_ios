"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { listDocuments, deleteDocument } from "@/lib/db";
import type { ScanDocument } from "@/lib/types";

export default function HomePage() {
  const [docs, setDocs] = useState<ScanDocument[] | null>(null);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const router = useRouter();

  useEffect(() => {
    listDocuments().then((d) => {
      setDocs(d);
      const urls: Record<string, string> = {};
      d.forEach((doc) => {
        if (doc.coverThumb) urls[doc.id] = URL.createObjectURL(doc.coverThumb);
      });
      setThumbs(urls);
    });
  }, []);

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Bu belgeyi silmek istediğine emin misin?")) return;
    await deleteDocument(id);
    setDocs((prev) => prev?.filter((d) => d.id !== id) ?? null);
  }

  return (
    <main style={{ padding: "calc(20px + var(--safe-top)) 20px 24px" }}>
      <header style={{ marginBottom: 24 }}>
        <div className="eyebrow">Cihaz No. 001 — Yerel Depo</div>
        <h1 style={{ fontSize: 28, margin: "4px 0 0", fontWeight: 700 }}>Belgelerim</h1>
      </header>

      {docs === null && <p style={{ color: "var(--ink-dim)" }}>Yükleniyor…</p>}

      {docs !== null && docs.length === 0 && (
        <div
          style={{
            border: "1px dashed var(--line)",
            borderRadius: "var(--radius-lg)",
            padding: "40px 20px",
            textAlign: "center",
            color: "var(--ink-dim)",
          }}
        >
          <p style={{ margin: "0 0 16px" }}>Henüz taranmış belge yok.</p>
          <button
            onClick={() => router.push("/tara")}
            className="mono"
            style={{
              background: "var(--scan)",
              color: "#1a0a05",
              padding: "10px 20px",
              borderRadius: "var(--radius-sm)",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            İLK BELGEYİ TARA
          </button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {docs?.map((doc) => (
          <a
            key={doc.id}
            href={`/belge/${doc.id}`}
            onClick={(e) => {
              e.preventDefault();
              router.push(`/belge/${doc.id}`);
            }}
            style={{ display: "block" }}
          >
            <div
              style={{
                position: "relative",
                aspectRatio: "3/4",
                borderRadius: "var(--radius-md)",
                overflow: "hidden",
                background: "var(--surface)",
                border: "1px solid var(--line)",
              }}
            >
              {thumbs[doc.id] ? (
                <img
                  src={thumbs[doc.id]}
                  alt={doc.title}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--ink-dim)",
                    fontSize: 12,
                  }}
                >
                  boş
                </div>
              )}
              <button
                onClick={(e) => handleDelete(doc.id, e)}
                aria-label="Belgeyi sil"
                style={{
                  position: "absolute",
                  top: 6,
                  right: 6,
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  background: "rgba(10,12,14,0.7)",
                  color: "var(--ink)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ×
              </button>
              <div
                className="mono"
                style={{
                  position: "absolute",
                  bottom: 6,
                  left: 6,
                  fontSize: 10,
                  background: "rgba(10,12,14,0.7)",
                  padding: "2px 6px",
                  borderRadius: 4,
                }}
              >
                {doc.pageCount} SF
              </div>
            </div>
            <div style={{ marginTop: 6, fontSize: 13 }}>{doc.title}</div>
            <div className="eyebrow" style={{ fontSize: 10 }}>
              {new Date(doc.updatedAt).toLocaleDateString("tr-TR")}
            </div>
          </a>
        ))}
      </div>
    </main>
  );
}
