"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { AdminSidebar } from "@/components/admin/admin-sidebar";

// Pages that are fullscreen (maps) - content should not have sidebar padding
const FULLSCREEN_PAGES = ["/admin/generate", "/admin/pois"];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isFullscreen = FULLSCREEN_PAGES.some((p) => pathname.startsWith(p));

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminSidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />
      <main className={isFullscreen ? "" : "lg:pl-64"}>{children}</main>
    </div>
  );
}
