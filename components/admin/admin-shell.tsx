"use client";

import { useState } from "react";
import { AdminSidebar } from "@/components/admin/admin-sidebar";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Ingen ekstern Mapbox-CSS (PRD 12 Unit 1 AC1): admin-skallet drar ikke
  // Mapbox-2D inn — 3D-motoren er Google gmp-map-3d, og radius-kartet i
  // Generator erstattes i Unit 4.
  return (
    <div className="min-h-screen bg-gray-50">
      <AdminSidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />
      {/* Main content - offset by primary sidebar width (256px = 16rem = pl-64) */}
      <main className="lg:pl-64">{children}</main>
    </div>
  );
}
