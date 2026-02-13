import Link from "next/link";

interface PlacyHeaderProps {
  locale?: "no" | "en";
  currentPath?: string;
}

export default function PlacyHeader({ locale = "no", currentPath }: PlacyHeaderProps) {
  const isEnglish = locale === "en";

  // Build alternate language URL
  const alternatePath = currentPath
    ? isEnglish
      ? currentPath.replace(/^\/en/, "") || "/"
      : `/en${currentPath}`
    : isEnglish ? "/" : "/en";

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-[#eae6e1]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link href={isEnglish ? "/en" : "/"} className="flex items-center gap-2">
            <span className="text-xl font-semibold text-[#1a1a1a] tracking-tight">
              Placy
            </span>
          </Link>

          {/* Navigation */}
          <nav className="hidden sm:flex items-center gap-6">
            <Link
              href={isEnglish ? "/en/trondheim" : "/trondheim"}
              className="text-sm text-[#6a6a6a] hover:text-[#1a1a1a] transition-colors"
            >
              Trondheim
            </Link>
          </nav>

          {/* Language toggle */}
          <Link
            href={alternatePath}
            className="text-xs font-medium text-[#7a7062] hover:text-[#1a1a1a] transition-colors px-2 py-1 rounded border border-[#eae6e1] hover:border-[#d4cfc8]"
          >
            {isEnglish ? "NO" : "EN"}
          </Link>
        </div>
      </div>
    </header>
  );
}
