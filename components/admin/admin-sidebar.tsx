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
  Menu,
  X,
} from "lucide-react";

type NavLink = { href: string; label: string; icon: LucideIcon; exact?: boolean };

const NAV_ITEMS: NavLink[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/customers", label: "Kunder", icon: Users },
  { href: "/admin/projects", label: "Prosjekter", icon: FolderOpen },
  { href: "/admin/pois", label: "POI-er", icon: MapPin },
  { href: "/admin/categories", label: "Kategorier", icon: Tag },
  { href: "/admin/generate", label: "Generator", icon: Sparkles },
];

interface AdminSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function AdminSidebar({ isOpen, onToggle }: AdminSidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Hamburger button - visible on mobile only */}
      <button
        onClick={onToggle}
        className="fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-lg border border-gray-200 hover:bg-gray-50 transition-colors lg:hidden"
        aria-label="Toggle navigation"
      >
        <Menu className="w-5 h-5 text-gray-700" />
      </button>

      {/* Overlay backdrop - mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onToggle}
          aria-hidden="true"
        />
      )}

      {/* Sidebar - Full width with labels on all screen sizes */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 bg-white border-r border-gray-200
          transform transition-transform duration-200 ease-in-out
          w-64
          ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
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

        {/* Header - Logo area */}
        <div className="h-14 flex items-center justify-center border-b border-gray-100">
          <Link
            href="/admin"
            onClick={onToggle}
            className="flex items-center gap-2 text-gray-900 hover:text-gray-700 transition-colors"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
              <MapPin className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold">Placy</span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="p-2 space-y-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={onToggle}
              className={`
                group relative flex items-center gap-3 px-2.5 py-2.5 rounded-lg text-sm transition-colors
                focus:outline-none focus:ring-2 focus:ring-blue-500/50
                ${
                  isActive(item.href, item.exact)
                    ? "bg-gray-100 text-gray-900 font-medium"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }
              `}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </aside>
    </>
  );
}
