/**
 * Kart layout — includes Mapbox CSS for interactive maps.
 */
export default function KartLayout({
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
