import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";

// Admin skal aldri indekseres. Pre-launch dekker robots.txt-totalblokken alt;
// denne meta-taggen er for post-launch — da skal /admin IKKE robots-blokkeres
// (en blokkert crawler ser aldri noindex og kan URL-only-indeksere), men
// crawles og noindexes. I prod redirecter requireAdmin uansett all admin-HTML.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShell>{children}</AdminShell>;
}
