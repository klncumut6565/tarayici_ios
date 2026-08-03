// pdfjs-dist'in worker dosyasını public/'e kopyalar. webpack'in
// "new URL(..., import.meta.url)" özel asset işlemesi node_modules
// içindeki bu dosya için güvenilir çalışmadığından, sabit bir genel
// (/pdf.worker.min.js) yoldan servis ediyoruz. npm install sonrası
// (postinstall) otomatik çalışır — Vercel build'inde de tetiklenir.
const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "node_modules", "pdfjs-dist", "build", "pdf.worker.min.js");
const dest = path.join(__dirname, "..", "public", "pdf.worker.min.js");

try {
  fs.copyFileSync(src, dest);
  console.log("[copy-pdf-worker] pdf.worker.min.js -> public/ kopyalandı.");
} catch (err) {
  console.warn("[copy-pdf-worker] Kopyalanamadı (pdfjs-dist kurulu değil olabilir):", err.message);
}
