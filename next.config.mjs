/** @type {import('next').NextConfig} */
const nextConfig = {
  // Aktiver eksperimentelle funksjoner for bedre ytelse
  experimental: {
    // Optimaliser pakker for raskere lasting
    optimizePackageImports: ["lucide-react"],
    // Server-actions origin-policy (sikkerhets-audit 2026-07-06): BEVISST ingen
    // `serverActions.allowedOrigins`. Next.js håndhever da den restriktive
    // same-origin-sjekken (Origin === Host) på alle server-actions — dette er
    // CSRF-vernet for admin-actionene (deleteProject m.fl.) OG for logEvent-
    // ingesten. Boards embeddes i kunde-iframes, MEN iframen laster en Placy-URL,
    // så server-actions fyrer fra Placy-origin (same-origin) også når de er
    // embedded — de fungerer uten allowlist. Å legge kunde-domener i allowlisten
    // ville SVEKKE vernet (en kompromittert kunde-side kunne drive actionene), og
    // å pinne kun prod-domener ville brutt server-actions på Vercel preview-URLer
    // (*.vercel.app). Default = mest sikker OG fungerer på tvers av prod/preview/
    // embed. Ikke legg til allowedOrigins uten en konkret cross-origin-invoke-behov.
  },
  // Tillat bilder fra eksterne kilder
  images: {
    minimumCacheTTL: 604800, // 7 days — tighter feedback loop for lh3 URL freshness
    remotePatterns: [
      {
        protocol: "https",
        hostname: "maps.googleapis.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "api.mapbox.com",
      },
      {
        protocol: "https",
        hostname: "preview.sdl.no",
      },
    ],
  },
  // Trygge security-headers (audit-sveip 2026-07-06). BEVISST ingen
  // X-Frame-Options/frame-ancestors: boards embeddes i kunde-iframes
  // (embed-modus er en produktflate). CSP deferred til cutover-herding.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
  // Redirects for gamle demo-URL-er som nå lever under /eiendom/
  async redirects() {
    return [
      {
        source: "/demo/wesselslokka",
        // /rapport (gammel scroll-rapport) ble slettet i cutoveren 2026-07-06 →
        // pekte på 404. Board-flaten er nå /rapport-board.
        destination: "/eiendom/broset-utvikling-as/wesselslokka/rapport-board",
        permanent: true, // 301
      },
    ];
  },
};

export default nextConfig;
