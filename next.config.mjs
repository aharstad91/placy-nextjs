/** @type {import('next').NextConfig} */
const nextConfig = {
  // Aktiver eksperimentelle funksjoner for bedre ytelse
  experimental: {
    // Optimaliser pakker for raskere lasting
    optimizePackageImports: ["lucide-react"],
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
  // Redirects for gamle demo-URL-er som nå lever under /eiendom/
  async redirects() {
    return [
      {
        source: "/demo/wesselslokka",
        destination: "/eiendom/broset-utvikling-as/wesselslokka/rapport",
        permanent: true, // 301
      },
    ];
  },
};

export default nextConfig;
