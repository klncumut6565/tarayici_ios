// Galeri veya "Dosyalardan Yükle" ile seçilen bir görüntüyü, sayfa
// yönlendirmesi sırasında (Ana Sayfa → /tara) taşımak için basit bir
// modül-seviyesi bellek deposu. Next.js App Router istemci taraflı
// yönlendirmede sayfa yeniden yüklenmediği için bu modülün durumu
// korunur; sunucu tarafında hiçbir şey saklanmaz.
export interface PendingImport {
  file: Blob;
  mode: "standart" | "kimlik";
}

let pending: PendingImport | null = null;

export function setPendingImport(file: Blob, mode: PendingImport["mode"] = "standart") {
  pending = { file, mode };
}

export function takePendingImport(): PendingImport | null {
  const p = pending;
  pending = null;
  return p;
}
