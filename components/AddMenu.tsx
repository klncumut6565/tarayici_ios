"use client";

interface Props {
  open: boolean;
  onClose: () => void;
  onCamera: () => void;
  onGallery: () => void;
  onFiles: () => void;
  onKimlik: () => void;
}

export default function AddMenu({ open, onClose, onCamera, onGallery, onFiles, onKimlik }: Props) {
  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        zIndex: 40,
        display: "flex",
        alignItems: "flex-end",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 560,
          margin: "0 auto",
          background: "var(--surface)",
          borderTopLeftRadius: "var(--radius-lg)",
          borderTopRightRadius: "var(--radius-lg)",
          border: "1px solid var(--line)",
          borderBottom: "none",
          padding: "10px 16px calc(20px + var(--safe-bottom))",
        }}
      >
        <div
          style={{
            width: 36,
            height: 4,
            borderRadius: 2,
            background: "var(--line)",
            margin: "6px auto 14px",
          }}
        />

        <MenuRow icon={<CameraIcon />} label="Kamera" hint="Canlı kamerayla tara" onClick={onCamera} />
        <MenuRow icon={<GalleryIcon />} label="Galeri" hint="Fotoğraflardan seç" onClick={onGallery} />
        <MenuRow icon={<FilesIcon />} label="Dosyalardan Yükle" hint="Dosyalar uygulamasından seç" onClick={onFiles} />

        <div style={{ height: 1, background: "var(--line)", margin: "10px 0" }} />

        <MenuRow
          icon={<IdCardIcon />}
          label="Kimlik Tara"
          hint="Kart oranlı çerçeve ile ön/arka yüz"
          onClick={onKimlik}
          accent
        />
      </div>
    </div>
  );
}

function MenuRow({
  icon,
  label,
  hint,
  onClick,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "12px 6px",
        textAlign: "left",
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: "var(--radius-sm)",
          background: accent ? "var(--scan-dim)" : "var(--surface-raised)",
          color: accent ? "var(--scan)" : "var(--ink)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{label}</div>
        <div className="eyebrow" style={{ fontSize: 10, marginTop: 2 }}>
          {hint}
        </div>
      </div>
    </button>
  );
}

function CameraIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M4 8a2 2 0 0 1 2-2h1.5l1-1.6A1 1 0 0 1 9.35 4h5.3a1 1 0 0 1 .85.5L16.5 6H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="13" r="3.2" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function GalleryIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="9" cy="9.5" r="1.6" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5 17l4.5-5 3.5 4 2.5-3L20 17" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function FilesIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M4 6a1.5 1.5 0 0 1 1.5-1.5H10l2 2h6.5A1.5 1.5 0 0 1 20 8v10a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18Z" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function IdCardIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="8.5" cy="11" r="1.6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M6 15.2c0-1.2 1.1-2 2.5-2s2.5.8 2.5 2" stroke="currentColor" strokeWidth="1.4" />
      <line x1="13.5" y1="10" x2="18" y2="10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="13.5" y1="13" x2="18" y2="13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
