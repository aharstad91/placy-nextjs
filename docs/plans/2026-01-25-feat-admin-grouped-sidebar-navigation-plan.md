---
title: "feat: Admin Grouped Sidebar Navigation"
type: feat
date: 2026-01-25
---

# Admin Grouped Sidebar Navigation

## Overview

Implementere en sidebar-navigasjon for admin-dashboardet som grupperer funksjonalitet etter bruksområde: Oversikt, Admin, Data, og Innhold.

## Problem Statement / Motivation

**Problem:** Admin-verktøyene er fragmenterte. For å fullføre én oppgave må brukeren navigere mellom 5+ ulike sider uten klar sammenheng. Ingen felles navigasjon eksisterer - hver side har bare en "tilbake til dashboard"-lenke.

**Løsning:** En persistent sidebar med grupperte navigasjonslenker som alltid viser hvor brukeren er og gir rask tilgang til alle admin-funksjoner.

## Proposed Solution

Opprette `app/admin/layout.tsx` med en `AdminSidebar`-komponent som:
- Viser grupperte navigasjonslenker
- Markerer aktiv side
- Kollapser automatisk på fullskjerm-sider (Generator, POI-er)
- Støtter mobil overlay-modus

### Navigasjonsstruktur

```
PLACY ADMIN
├── Oversikt
│   └── Dashboard        /admin
│
├── Admin
│   ├── Kunder           /admin/customers
│   └── Prosjekter       /admin/projects
│
├── Data
│   ├── POI-er           /admin/pois
│   ├── Kategorier       /admin/categories
│   ├── Generator        /admin/generate
│   └── Import           /admin/import (placeholder)
│
└── Innhold
    ├── Stories          /admin/stories (placeholder)
    └── Editorial        /admin/editorial (placeholder)
```

## Technical Considerations

### Arkitektur

**Nye filer:**
- `app/admin/layout.tsx` - Server Component med ADMIN_ENABLED sjekk
- `components/admin/admin-sidebar.tsx` - Client Component med navigasjon
- `app/admin/import/page.tsx` - Placeholder
- `app/admin/stories/page.tsx` - Placeholder
- `app/admin/editorial/page.tsx` - Placeholder

**Modifiserte filer:**
- Fjern ArrowLeft back-navigasjon fra alle admin client-komponenter
- Juster padding/margin for å ta høyde for sidebar

### Fullskjerm-sider

Generator (`/admin/generate`) og POI-admin (`/admin/pois`) er fullskjerm kart. Håndtering:

1. **Auto-kollaps:** Sidebar kollapser til skjult tilstand når disse sidene lastes
2. **Toggle-knapp:** Floating hamburger-ikon (øverst venstre) åpner sidebar som overlay
3. **Overlay:** Sidebar vises over kartet med backdrop, lukkes ved klikk utenfor

```tsx
// Identifiser fullskjerm-sider
const FULLSCREEN_PAGES = ['/admin/generate', '/admin/pois'];
const isFullscreen = FULLSCREEN_PAGES.some(p => pathname.startsWith(p));
```

### Aktiv-tilstand logikk

Bruk `startsWith` for hierarkisk matching:

```tsx
const isActive = (href: string) => {
  if (href === '/admin') return pathname === '/admin';
  return pathname.startsWith(href);
};

// Eksempler:
// /admin/projects/abc/story → "Prosjekter" er aktiv
// /admin/categories → "Kategorier" er aktiv
```

### Responsivt design

| Breakpoint | Oppførsel |
|------------|-----------|
| Desktop (≥1024px) | Fast sidebar, 256px bredde |
| Tablet (768-1023px) | Fast sidebar, 256px bredde |
| Mobil (<768px) | Skjult sidebar, hamburger-meny, overlay |

### Performance

- Sidebar er Client Component (krever `usePathname`)
- Layout er Server Component (sjekker ADMIN_ENABLED én gang)
- Ingen ekstra API-kall for navigasjon

## Acceptance Criteria

### Funksjonelle krav

- [x] Sidebar vises på alle admin-sider (unntatt fullskjerm-sider hvor den er kollapset)
- [x] Navigasjonsgrupper (Oversikt, Admin, Data, Innhold) vises med labels
- [x] Klikk på navigasjonselement navigerer til riktig side
- [x] Aktiv side er visuelt markert (bakgrunnsfarge + font weight)
- [ ] ~~Grupper kan kollapses/ekspanderes ved klikk på header~~ (forenklet: flat liste med dividers)
- [ ] ~~Grupper med aktiv element auto-ekspanderes ved sidelast~~ (ikke nødvendig med flat liste)
- [x] Fullskjerm-sider (Generator, POI-er) har kollapset sidebar med hamburger-toggle
- [x] Hamburger åpner sidebar som overlay på fullskjerm-sider
- [x] Mobil (<768px) viser hamburger-meny i stedet for fast sidebar
- [x] ArrowLeft back-navigasjon fjernet fra alle admin-sider

### Tekniske krav

- [ ] ~~`app/admin/layout.tsx` sjekker ADMIN_ENABLED og redirecter hvis false~~ (beholdt i individuelle pages for server-side sikkerhet)
- [x] Sidebar bruker Tailwind-klasser konsistent med eksisterende design
- [x] usePathname() brukes for aktiv-tilstand
- [x] Placeholder-sider opprettet for Import, Stories, Editorial
- [x] Ingen breaking changes til eksisterende admin-funksjonalitet

## Success Metrics

- Brukere kan navigere mellom alle admin-sider uten å gå via dashboard
- Redusert antall klikk for å nå en spesifikk admin-side
- Konsistent navigasjonsopplevelse på tvers av admin-seksjonen

## Dependencies & Risks

**Avhengigheter:**
- Lucide React ikoner (allerede installert)
- Tailwind CSS (allerede konfigurert)
- next/navigation (`usePathname`)

**Risiko:**
- Fullskjerm-sider kan trenge justering av z-index for overlay
- Eksisterende siders layout må kanskje justeres for sidebar-bredde

## MVP Implementation

### app/admin/layout.tsx

```tsx
import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/admin/admin-sidebar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const adminEnabled = process.env.ADMIN_ENABLED === "true";
  if (!adminEnabled) redirect("/");

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminSidebar />
      <main className="lg:pl-64">{children}</main>
    </div>
  );
}
```

### components/admin/admin-sidebar.tsx

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  FolderOpen,
  MapPin,
  Tag,
  Sparkles,
  Upload,
  BookOpen,
  FileText,
  ChevronDown,
  Menu,
  X,
} from "lucide-react";
import { useState, useEffect } from "react";

const NAV_GROUPS = [
  {
    title: "Oversikt",
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    title: "Admin",
    items: [
      { href: "/admin/customers", label: "Kunder", icon: Users },
      { href: "/admin/projects", label: "Prosjekter", icon: FolderOpen },
    ],
  },
  {
    title: "Data",
    items: [
      { href: "/admin/pois", label: "POI-er", icon: MapPin },
      { href: "/admin/categories", label: "Kategorier", icon: Tag },
      { href: "/admin/generate", label: "Generator", icon: Sparkles },
      { href: "/admin/import", label: "Import", icon: Upload },
    ],
  },
  {
    title: "Innhold",
    items: [
      { href: "/admin/stories", label: "Stories", icon: BookOpen },
      { href: "/admin/editorial", label: "Editorial", icon: FileText },
    ],
  },
];

const FULLSCREEN_PAGES = ["/admin/generate", "/admin/pois"];

export function AdminSidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const isFullscreen = FULLSCREEN_PAGES.some((p) => pathname.startsWith(p));
  const isMobile = typeof window !== "undefined" && window.innerWidth < 1024;

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  };

  const toggleGroup = (title: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
      }
      return next;
    });
  };

  // Auto-expand group containing active item
  useEffect(() => {
    NAV_GROUPS.forEach((group) => {
      if (group.items.some((item) => isActive(item.href))) {
        setCollapsedGroups((prev) => {
          const next = new Set(prev);
          next.delete(group.title);
          return next;
        });
      }
    });
  }, [pathname]);

  const sidebarContent = (
    <nav className="p-4 space-y-6">
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="text-lg font-bold text-gray-900">Placy Admin</span>
      </div>

      {NAV_GROUPS.map((group) => (
        <div key={group.title}>
          <button
            onClick={() => toggleGroup(group.title)}
            className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700"
          >
            {group.title}
            <ChevronDown
              className={`w-4 h-4 transition-transform ${
                collapsedGroups.has(group.title) ? "-rotate-90" : ""
              }`}
            />
          </button>

          {!collapsedGroups.has(group.title) && (
            <div className="mt-1 space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${
                      active
                        ? "bg-gray-100 text-gray-900 font-medium"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </nav>
  );

  // Fullscreen pages: show hamburger + overlay
  if (isFullscreen) {
    return (
      <>
        <button
          onClick={() => setIsOpen(true)}
          className="fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-lg border border-gray-200 hover:bg-gray-50"
        >
          <Menu className="w-5 h-5 text-gray-700" />
        </button>

        {isOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/20 z-40"
              onClick={() => setIsOpen(false)}
            />
            <aside className="fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200 z-50">
              <button
                onClick={() => setIsOpen(false)}
                className="absolute top-4 right-4 p-2 text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
              {sidebarContent}
            </aside>
          </>
        )}
      </>
    );
  }

  // Desktop: fixed sidebar
  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setIsOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-lg border border-gray-200"
      >
        <Menu className="w-5 h-5 text-gray-700" />
      </button>

      {/* Mobile overlay */}
      {isOpen && (
        <div className="lg:hidden">
          <div
            className="fixed inset-0 bg-black/20 z-40"
            onClick={() => setIsOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200 z-50">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 p-2 text-gray-500 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200">
        {sidebarContent}
      </aside>
    </>
  );
}
```

### app/admin/import/page.tsx (placeholder)

```tsx
import Link from "next/link";
import { Upload, ArrowLeft } from "lucide-react";

export default function ImportPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Import</h1>
        <p className="text-gray-500">Kommer snart</p>
      </div>
    </div>
  );
}
```

### app/admin/stories/page.tsx (placeholder)

```tsx
import { BookOpen } from "lucide-react";

export default function StoriesPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Stories</h1>
        <p className="text-gray-500">Kommer snart</p>
      </div>
    </div>
  );
}
```

### app/admin/editorial/page.tsx (placeholder)

```tsx
import { FileText } from "lucide-react";

export default function EditorialPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Editorial</h1>
        <p className="text-gray-500">Kommer snart</p>
      </div>
    </div>
  );
}
```

## Endringer i eksisterende filer

Fjern ArrowLeft back-navigasjon fra:
- `app/admin/customers/customers-admin-client.tsx`
- `app/admin/projects/projects-admin-client.tsx`
- `app/admin/pois/poi-admin-client.tsx`
- `app/admin/categories/categories-admin-client.tsx`
- `app/admin/generate/generate-client.tsx`
- `app/admin/projects/[id]/story/story-editor-client.tsx`

## References

### Internal References
- Eksisterende sidebar mønster: `components/layout/sidebar.tsx`
- Admin komponentbibliotek: `components/admin/`
- Designsystem patterns: `app/admin/customers/customers-admin-client.tsx`

### Brainstorm
- `docs/brainstorms/2026-01-25-admin-navigation-structure-brainstorm.md`
