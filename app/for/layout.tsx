/**
 * B2B layout — includes Mapbox CSS for interactive maps.
 * Public pages don't load this CSS (PageSpeed optimization).
 */
export default function B2BLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        href="https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css"
        rel="stylesheet"
      />
      {children}
    </>
  );
}
