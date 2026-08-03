import type { Point } from "./imageProcessing";

/**
 * 4 köşe noktasından, köşeleri hafif yuvarlatılmış bir SVG path string'i
 * üretir. Tamamen keskin dikdörtgen yerine (native tarayıcı UI'larında
 * olduğu gibi) her köşeyi küçük bir kuadratik eğriyle "kesiyoruz" —
 * dönme açısından bağımsız çalışır, döndürülmüş dörtgenlerde de düzgün
 * görünür.
 *
 * radius: köşeden ne kadar içeri girip yuvarlanacağı (piksel). Kenar
 * kısaysa otomatik küçültülür (asla kenarın yarısından fazla olmaz).
 */
export function roundedQuadPath(points: [Point, Point, Point, Point], radius: number): string {
  const n = points.length;
  const parts: string[] = [];

  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n];
    const curr = points[i];
    const next = points[(i + 1) % n];

    const toPrev = { x: prev.x - curr.x, y: prev.y - curr.y };
    const toNext = { x: next.x - curr.x, y: next.y - curr.y };
    const lenPrev = Math.hypot(toPrev.x, toPrev.y) || 1;
    const lenNext = Math.hypot(toNext.x, toNext.y) || 1;
    const r = Math.min(radius, lenPrev / 2, lenNext / 2);

    const startPt = { x: curr.x + (toPrev.x / lenPrev) * r, y: curr.y + (toPrev.y / lenPrev) * r };
    const endPt = { x: curr.x + (toNext.x / lenNext) * r, y: curr.y + (toNext.y / lenNext) * r };

    parts.push(i === 0 ? `M ${startPt.x} ${startPt.y}` : `L ${startPt.x} ${startPt.y}`);
    parts.push(`Q ${curr.x} ${curr.y} ${endPt.x} ${endPt.y}`);
  }

  parts.push("Z");
  return parts.join(" ");
}

/** Dörtgenin en kısa kenarına göre makul bir köşe yarıçapı önerir. */
export function suggestedCornerRadius(points: [Point, Point, Point, Point]): number {
  let minEdge = Infinity;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    minEdge = Math.min(minEdge, Math.hypot(b.x - a.x, b.y - a.y));
  }
  return Math.max(6, Math.min(22, minEdge * 0.1));
}
