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
      <link
        href="https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css"
        rel="stylesheet"
      />
      {children}
    </>
  );
}
