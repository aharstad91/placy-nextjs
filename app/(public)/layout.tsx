import Script from "next/script";
import PlacyHeader from "@/components/public/PlacyHeader";
import PlacyFooter from "@/components/public/PlacyFooter";
import CollectionBar from "@/components/public/CollectionBar";
import { PageTransition } from "@/components/transitions";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <PlacyHeader locale="no" />
      <PageTransition>
        <main className="min-h-screen bg-[#faf9f7]">{children}</main>
        <PlacyFooter locale="no" />
      </PageTransition>
      <CollectionBar />
      {/* Plausible analytics — privacy-friendly, no cookies */}
      {process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN && (
        <Script
          defer
          data-domain={process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN}
          src="https://plausible.io/js/script.js"
          strategy="lazyOnload"
        />
      )}
    </>
  );
}
