/**
 * Midtbyen-layout — laster Mapbox-CSS.
 *
 * Speiler `app/event/layout.tsx` og `app/eiendom/layout.tsx`. Uten denne
 * stilarket rendres kartet uten kontroller og markørposisjonering, og feilen
 * ser ut som en kart-bug i stedet for en manglende stilfil.
 */
export default function MidtbyenLayout({
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
