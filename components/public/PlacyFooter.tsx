import Link from "next/link";

interface PlacyFooterProps {
  locale?: "no" | "en";
}

export default function PlacyFooter({ locale = "no" }: PlacyFooterProps) {
  const isEnglish = locale === "en";

  return (
    <footer className="bg-[#1a1a1a] text-[#a0937d]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <span className="text-lg font-semibold text-white">Placy</span>
            <p className="mt-2 text-sm leading-relaxed">
              {isEnglish
                ? "Discover the best places in Norwegian cities through curated guides and local knowledge."
                : "Oppdag de beste stedene i norske byer gjennom kuraterte guider og lokalkunnskap."}
            </p>
          </div>

          {/* Cities */}
          <div>
            <h3 className="text-xs uppercase tracking-[0.2em] text-[#6a6a6a] mb-3">
              {isEnglish ? "Cities" : "Byer"}
            </h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href={isEnglish ? "/en/trondheim" : "/trondheim"}
                  className="text-sm hover:text-white transition-colors"
                >
                  Trondheim
                </Link>
              </li>
            </ul>
          </div>

          {/* Links */}
          <div>
            <h3 className="text-xs uppercase tracking-[0.2em] text-[#6a6a6a] mb-3">
              Placy
            </h3>
            <ul className="space-y-2">
              <li>
                <span className="text-sm">
                  {isEnglish ? "Contact: " : "Kontakt: "}
                  <a href="mailto:hei@placy.no" className="hover:text-white transition-colors">
                    hei@placy.no
                  </a>
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-[#333] text-xs text-[#6a6a6a]">
          &copy; {new Date().getFullYear()} Placy. {isEnglish ? "All rights reserved." : "Alle rettigheter reservert."}
        </div>
      </div>
    </footer>
  );
}
