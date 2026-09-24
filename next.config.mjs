import { networkInterfaces } from "node:os";

/**
 * Maskinens private IPv4-adresser — brukes som `allowedDevOrigins` slik at
 * `npm run dev:mobile` (binder til 0.0.0.0) kan serve /_next/*-ressurser til
 * iPhone/iPad på samme nett. Next 16 blokkerer cross-origin dev-requests som
 * ikke står i lista. Feltet gjelder KUN dev — ignoreres i prod-bygg.
 *
 * Adressene regnes ut ved OPPSTART, og det holdt ikke: en dev-server som har
 * stått over natta har lista fra i går, så etter en DHCP-fornyelse avvises
 * mobilen med en stille WebSocket-feil (`/_next/webpack-hmr` svarer ikke i
 * det hele tatt, mens HTML-en fortsatt serves — så siden ser levende ut mens
 * hot reload er dødt). Funnet 2026-08-24 på :3003. Derfor legger vi til de
 * private IPv4-områdene som mønstre i tillegg til de målte adressene: da
 * overlever lista at maskinen bytter adresse under en kjørende dev-server.
 */
function localDevOrigins() {
  const measured = Object.values(networkInterfaces())
    .flatMap((nets) => nets ?? [])
    .filter((net) => net.family === "IPv4" && !net.internal)
    .map((net) => net.address);

  // RFC 1918 + link-local. Kun dev, og kun maskiner på samme nett kan nå
  // porten uansett — mønstrene utvider ikke angrepsflaten i praksis.
  // `*` matcher ETT helt segment hos Next (samme matcher som remotePatterns),
  // så «172.2*.*.*» ville ikke truffet noe — 172.16–172.31 må enumereres.
  const privateRanges = [
    "10.*.*.*",
    "192.168.*.*",
    "169.254.*.*",
    ...Array.from({ length: 16 }, (_, i) => `172.${16 + i}.*.*`),
  ];

  return [...new Set([...measured, ...privateRanges])];
}

const voiceContentFiles = [
  './data/demo/nyhavna-lokal/*.json',
  './data/demo/nyhavna-snapshot.json',
  './data/demo/nyhavna-review-ledger.json',
];

// Leangenbukta-lokal-databasen leses med fs ved request-tid (lib/demo/local-board),
// både fra egen demo-side og fra live-rutene som Nyhavna og Leangenbukta deler.
// Uten disse i outputFileTracingIncludes mangler filene i standalone/prod-bundlen.
const leangenbuktaLokalFiles = ['./data/demo/leangenbukta-lokal/*.json'];

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: {
    '/demo/nyhavna-lokal': ['./data/demo/nyhavna-lokal/*.json'],
    '/demo/leangenbukta-lokal': leangenbuktaLokalFiles,
    '/\\[slug\\]': voiceContentFiles,
    '/api/prototype/live': [...voiceContentFiles, ...leangenbuktaLokalFiles],
    '/api/prototype/live/map': leangenbuktaLokalFiles,
    '/api/prototype/live/context': leangenbuktaLokalFiles,
    '/api/demo/leangenbukta-chat': leangenbuktaLokalFiles,
    '/api/live/control': voiceContentFiles,
    // Leangenbukta-nettside-fragmenter leses med fs per slug (app/demo/leangenbukta-nettside).
    '/demo/leangenbukta-nettside/\\[...slug\\]': ['./data/demo/leangenbukta-nettside/**/*'],
  },
  allowedDevOrigins: ["localhost", "127.0.0.1", ...localDevOrigins(), "*.ngrok-free.app", "*.ngrok.app"],
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
    // AVIF først (20-30 % mindre enn webp på foto/akvarell), webp-fallback
    formats: ["image/avif", "image/webp"],
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
  // X-Frame-Options/frame-ancestors på global source: boards embeddes i
  // kunde-iframes (embed-modus er en produktflate). CSP deferred til
  // cutover-herding.
  // /admin er aldri en embed-flate — DENY + frame-ancestors 'none' som
  // defense-in-depth mot clickjacking på admin-handlinger.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Hosted aliases also expose legacy pages. None should be indexed.
          ...(process.env.PLACY_HOSTED_VOICE === "true"
            ? [{ key: "X-Robots-Tag", value: "noindex, nofollow" }]
            : []),
        ],
      },
      {
        source: "/demo/nyhavna-lokal/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/:slug",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/p/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/admin/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
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
