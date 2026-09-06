/**
 * Porteføljekartets layout — henter inn Mapbox-CSS-en.
 *
 * Uten WebGL faller kartet til `MapView` (Mapbox 2D), og den komponenten
 * importerer ikke stilarket selv. Uten CSS-en tegner Mapbox et kart med feil
 * plasserte kontroller og markører — samme grunn til at `app/kart/layout.tsx`
 * finnes, og samme CDN-lenke.
 */
export default function PortefoljeLayout({
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
