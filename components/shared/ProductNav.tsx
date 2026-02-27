"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Share2, Check, Pencil, ChevronLeft } from "lucide-react";

export interface ProductLink {
  label: string;
  href: string;
}

interface ProductNavProps {
  projectName: string;
  products: ProductLink[];
  adminEditUrl?: string | null;
  homeHref?: string;
}

export default function ProductNav({ projectName, products, adminEditUrl, homeHref }: ProductNavProps) {
  const pathname = usePathname();
  const [copied, setCopied] = useState(false);

  // On trip detail pages, show a back link to the trips collection
  // URL: /customer/project/trips/tripSlug → /customer/project/trips
  const segments = pathname.split("/").filter(Boolean);
  const tripsIdx = segments.indexOf("trips");
  const isTripDetailPage = tripsIdx >= 0 && tripsIdx < segments.length - 1;
  const tripsHref = isTripDetailPage
    ? `/${segments.slice(0, tripsIdx + 1).join("/")}`
    : null;

  const handleShare = useCallback(async () => {
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({ title: projectName, url });
        return;
      } catch {
        // User cancelled or share failed — fall through to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard not available
    }
  }, [projectName]);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200">
      <div className="px-8 h-14 flex items-center justify-between">
        {/* Left: Back link on trip pages, otherwise project name */}
        {tripsHref ? (
          <Link
            href={tripsHref}
            className="flex items-center gap-0.5 text-sm font-medium text-[#7a7062] hover:text-[#1a1a1a] transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Alle turer</span>
            <span className="sm:hidden">Tilbake</span>
          </Link>
        ) : homeHref ? (
          <span className="flex items-center gap-1.5 truncate max-w-[250px] sm:max-w-none">
            <Link
              href={homeHref}
              className="text-sm font-medium text-[#1a1a1a] hover:text-[#7a7062] transition-colors truncate"
            >
              {projectName}
            </Link>
            {adminEditUrl && (
              <Link
                href={adminEditUrl}
                target="_blank"
                title="Rediger i admin"
                className="shrink-0 text-[#1a1a1a] hover:text-[#7a7062] transition-colors"
              >
                <Pencil className="w-3 h-3 opacity-40" />
              </Link>
            )}
          </span>
        ) : adminEditUrl ? (
          <Link
            href={adminEditUrl}
            target="_blank"
            className="flex items-center gap-1.5 text-sm font-medium text-[#1a1a1a] hover:text-[#7a7062] transition-colors truncate max-w-[250px] sm:max-w-none"
            title="Rediger i admin"
          >
            {projectName}
            <Pencil className="w-3 h-3 shrink-0 opacity-40" />
          </Link>
        ) : (
          <span className="text-sm font-medium text-[#1a1a1a] truncate max-w-[180px] sm:max-w-none">
            {projectName}
          </span>
        )}

        {/* Center: Product pill toggle */}
        {products.length > 1 && (
          <nav className="flex items-center bg-[#f0ece7] rounded-full p-0.5">
            {products.map((product) => (
              <Link
                key={product.href}
                href={product.href}
                className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all ${
                  pathname === product.href || pathname.startsWith(product.href + "/")
                    ? "bg-white text-[#1a1a1a] shadow-sm"
                    : "text-[#7a7062] hover:text-[#1a1a1a]"
                }`}
              >
                {product.label}
              </Link>
            ))}
          </nav>
        )}

        {/* Right: Share button */}
        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 text-xs text-[#7a7062] hover:text-[#1a1a1a] transition-colors"
          title="Del lenke"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Kopiert</span>
            </>
          ) : (
            <>
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Del</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
}
