"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
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
  Menu,
  X,
} from "lucide-react";

type NavDivider = { type: "divider"; label: string };
type NavLink = { href: string; label: string; icon: LucideIcon; exact?: boolean };
type NavItem = NavDivider | NavLink;

const NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { type: "divider", label: "Admin" },
  { href: "/admin/customers", label: "Kunder", icon: Users },
  { href: "/admin/projects", label: "Prosjekter", icon: FolderOpen },
  { type: "divider", label: "Data" },
  { href: "/admin/pois", label: "POI-er", icon: MapPin },
  { href: "/admin/categories", label: "Kategorier", icon: Tag },
  { href: "/admin/generate", label: "Generator", icon: Sparkles },
  { href: "/admin/import", label: "Import", icon: Upload },
  { type: "divider", label: "Innhold" },
  { href: "/admin/stories", label: "Stories", icon: BookOpen },
  { href: "/admin/editorial", label: "Editorial", icon: FileText },
];

// Pages that are fullscreen (maps) - sidebar should be hidden by default
const FULLSCREEN_PAGES = ["/admin/generate", "/admin/pois"];

interface AdminSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function AdminSidebar({ isOpen, onToggle }: AdminSidebarProps) {
  const pathname = usePathname();
  const isFullscreen = FULLSCREEN_PAGES.some((p) => pathname.startsWith(p));

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Hamburger button - visible on mobile and fullscreen pages */}
      <button
        onClick={onToggle}
        className={`fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-lg border border-gray-200 hover:bg-gray-50 transition-colors ${
          isFullscreen ? "block" : "lg:hidden"
        }`}
        aria-label="Toggle navigation"
      >
        <Menu className="w-5 h-5 text-gray-700" />
      </button>

      {/* Overlay backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={onToggle}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200
          transform transition-transform duration-200 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          ${!isFullscreen ? "lg:translate-x-0" : ""}
        `}
      >
        {/* Close button - mobile only */}
        <button
          onClick={onToggle}
          className="absolute top-4 right-4 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors lg:hidden"
          aria-label="Close navigation"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="p-4 pt-6">
          <Link
            href="/admin"
            onClick={onToggle}
            className="text-lg font-bold text-gray-900 hover:text-gray-700 transition-colors"
          >
            Placy Admin
          </Link>
        </div>

        {/* Navigation */}
        <nav className="px-4 pb-4 space-y-1">
          {NAV_ITEMS.map((item, i) => {
            if ("type" in item && item.type === "divider") {
              return (
                <div
                  key={`divider-${i}`}
                  className="pt-4 pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider"
                >
                  {item.label}
                </div>
              );
            }
            const linkItem = item as NavLink;
            return (
              <Link
                key={linkItem.href}
                href={linkItem.href}
                onClick={onToggle}
                className={`
                  flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors
                  focus:outline-none focus:ring-2 focus:ring-blue-500/50
                  ${
                    isActive(linkItem.href, linkItem.exact)
                      ? "bg-gray-100 text-gray-900 font-medium"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }
                `}
              >
                <linkItem.icon className="w-5 h-5" />
                {linkItem.label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
