"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Belgeler", icon: DocsIcon },
  { href: "/tara", label: "Tara", icon: ScanIcon },
];

export default function BottomNav() {
  const pathname = usePathname();

  // Kamera / köşe düzenleme / filtre ayarı tam ekran akışı (/tara) kendi
  // "×" çıkış tuşunu ve onay butonlarını içeriyor; alt navigasyon (z-index
  // olarak üstte kaldığı için) bu butonların önüne geçip tıklanamaz hale
  // getiriyordu. Bu akışta navigasyonu tamamen gizliyoruz.
  if (pathname.startsWith("/tara")) return null;

  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        background: "var(--surface)",
        borderTop: "1px solid var(--line)",
        paddingBottom: "var(--safe-bottom)",
        zIndex: 20,
      }}
    >
      <div style={{ display: "flex", width: "100%", maxWidth: 560 }}>
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                padding: "10px 0 8px",
                color: active ? "var(--scan)" : "var(--ink-dim)",
              }}
            >
              <Icon active={active} />
              <span className="mono" style={{ fontSize: 10, letterSpacing: "0.08em" }}>
                {label.toUpperCase()}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function DocsIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="5" y="3" width="14" height="18" rx="2" stroke="currentColor" strokeWidth={active ? 2 : 1.5} />
      <line x1="8" y1="8" x2="16" y2="8" stroke="currentColor" strokeWidth={active ? 2 : 1.5} />
      <line x1="8" y1="12" x2="16" y2="12" stroke="currentColor" strokeWidth={active ? 2 : 1.5} />
      <line x1="8" y1="16" x2="13" y2="16" stroke="currentColor" strokeWidth={active ? 2 : 1.5} />
    </svg>
  );
}

function ScanIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M4 8V5a1 1 0 0 1 1-1h3" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" />
      <path d="M20 8V5a1 1 0 0 0-1-1h-3" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" />
      <path d="M4 16v3a1 1 0 0 0 1 1h3" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" />
      <path d="M20 16v3a1 1 0 0 1-1 1h-3" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" />
      <line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth={active ? 2 : 1.5} />
    </svg>
  );
}
