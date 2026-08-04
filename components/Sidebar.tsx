"use client";

import { useRouter, usePathname } from "next/navigation";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  function go(path: string) {
    onClose();
    router.push(path);
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          zIndex: 30,
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 220ms ease",
        }}
      />
      <nav
        style={{
          position: "fixed",
          top: 0,
          bottom: 0,
          left: 0,
          width: "min(78%, 300px)",
          background: "var(--surface)",
          borderRight: "1px solid var(--line)",
          zIndex: 31,
          transform: open ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 240ms cubic-bezier(0.22, 1, 0.36, 1)",
          display: "flex",
          flexDirection: "column",
          padding: "calc(24px + var(--safe-top)) 18px 24px",
        }}
      >
        <div style={{ marginBottom: 28 }}>
          <div className="eyebrow">Cihaz No. 001 — Yerel Depo</div>
          <h2 style={{ fontSize: 20, margin: "4px 0 0", fontWeight: 700 }}>Tarayıcı</h2>
        </div>

        <SidebarItem
          icon={<DocsIcon active={pathname === "/belgeler"} />}
          label="Belgelerim"
          active={pathname === "/belgeler"}
          onClick={() => go("/belgeler")}
        />
        <SidebarItem
          icon={<ScanIcon active={pathname.startsWith("/tara")} />}
          label="Tara"
          active={pathname.startsWith("/tara")}
          onClick={() => go("/tara")}
        />
        <SidebarItem
          icon={<HomeIcon active={pathname === "/"} />}
          label="Ana Sayfa"
          active={pathname === "/"}
          onClick={() => go("/")}
        />

        <div style={{ flex: 1 }} />

        <button
          onClick={onClose}
          className="mono"
          style={{
            fontSize: 12,
            color: "var(--ink-dim)",
            padding: 10,
            textAlign: "left",
          }}
        >
          × KAPAT
        </button>
      </nav>
    </>
  );
}

function SidebarItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "13px 10px",
        borderRadius: "var(--radius-sm)",
        background: active ? "rgba(255,143,0,0.12)" : "transparent",
        color: active ? "var(--scan)" : "var(--ink)",
        fontSize: 15,
        fontWeight: active ? 700 : 500,
        marginBottom: 4,
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function DocsIcon({ active }: { active: boolean }) {
  const c = active ? "var(--scan)" : "var(--ink-dim)";
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="5" y="3" width="14" height="18" rx="2" stroke={c} strokeWidth={1.6} />
      <line x1="8" y1="8" x2="16" y2="8" stroke={c} strokeWidth={1.6} />
      <line x1="8" y1="12" x2="16" y2="12" stroke={c} strokeWidth={1.6} />
      <line x1="8" y1="16" x2="13" y2="16" stroke={c} strokeWidth={1.6} />
    </svg>
  );
}

function ScanIcon({ active }: { active: boolean }) {
  const c = active ? "var(--scan)" : "var(--ink-dim)";
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M4 8V5a1 1 0 0 1 1-1h3" stroke={c} strokeWidth={1.6} strokeLinecap="round" />
      <path d="M20 8V5a1 1 0 0 0-1-1h-3" stroke={c} strokeWidth={1.6} strokeLinecap="round" />
      <path d="M4 16v3a1 1 0 0 0 1 1h3" stroke={c} strokeWidth={1.6} strokeLinecap="round" />
      <path d="M20 16v3a1 1 0 0 1-1 1h-3" stroke={c} strokeWidth={1.6} strokeLinecap="round" />
      <line x1="4" y1="12" x2="20" y2="12" stroke={c} strokeWidth={1.6} />
    </svg>
  );
}

function HomeIcon({ active }: { active: boolean }) {
  const c = active ? "var(--scan)" : "var(--ink-dim)";
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M4 11.5 12 4l8 7.5" stroke={c} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9" stroke={c} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
