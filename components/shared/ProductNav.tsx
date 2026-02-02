"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Share2, Check } from "lucide-react";

export interface ProductLink {
  label: string;
  href: string;
  active: boolean;
}

interface ProductNavProps {
  projectName: string;
  products: ProductLink[];
}

export default function ProductNav({ projectName, products }: ProductNavProps) {
  const [copied, setCopied] = useState(false);

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
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#faf9f7]/95 backdrop-blur-sm border-b border-[#e8e4df]">
      <div className="max-w-5xl mx-auto px-4 h-12 flex items-center justify-between">
        {/* Left: Project name */}
        <span className="text-sm font-medium text-[#1a1a1a] truncate max-w-[180px] sm:max-w-none">
          {projectName}
        </span>

        {/* Center: Product pill toggle */}
        {products.length > 1 && (
          <nav className="flex items-center bg-[#f0ece7] rounded-full p-0.5">
            {products.map((product) => (
              <Link
                key={product.href}
                href={product.href}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-all ${
                  product.active
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
