"use client";

import { useState } from "react";
import { AdminSidebar } from "@/components/admin/admin-sidebar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminSidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />
      {/* Main content - offset by primary sidebar width (56px = 3.5rem = pl-14) */}
      <main className="lg:pl-14">{children}</main>
    </div>
  );
}
