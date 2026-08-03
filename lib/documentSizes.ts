/**
 * Standart belge/kart fiziksel boyutları (mm). Kenar algılama ve PDF
 * oluşturma bu değerlerden türetilen en/boy oranlarını kullanır — sabit
 * yuvarlanmış sayılar (örn. "1.586") yerine tek doğru kaynak burası.
 */

// ISO 216 A4 (dikey kullanım varsayımı: genişlik < yükseklik)
export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;
export const A4_ASPECT = A4_WIDTH_MM / A4_HEIGHT_MM; // ≈ 0.7071 (genişlik/yükseklik)

// ISO/IEC 7810 ID-1 — kimlik kartı, banka/kredi kartı ile birebir aynı
// fiziksel boyut (85,60 mm x 53,98 mm).
export const ID_CARD_WIDTH_MM = 85.6;
export const ID_CARD_HEIGHT_MM = 53.98;
export const ID_CARD_ASPECT = ID_CARD_WIDTH_MM / ID_CARD_HEIGHT_MM; // ≈ 1.5858 (genişlik/yükseklik, yatay kart)
