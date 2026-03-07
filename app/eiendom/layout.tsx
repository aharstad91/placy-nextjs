import Script from "next/script";

/**
 * Eiendom layout — includes Mapbox CSS for interactive maps
 * and Plausible analytics for tracking.
 */
export default function EiendomLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <link
        href="https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css"
        rel="stylesheet"
      />
      {children}
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
