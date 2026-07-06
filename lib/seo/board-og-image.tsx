import { ImageResponse } from "next/og";

/**
 * Delt OG-bilde-renderer for board-rutene: hero-illustrasjon i full bredde
 * med mørk scrim, tittel + strøk nederst og Placy-wordmark øverst. 1200×630
 * er standardformatet Slack/X/Meta/LinkedIn viser i previews.
 */

export const OG_IMAGE_SIZE = { width: 1200, height: 630 };

interface BoardOgImageInput {
  title: string;
  /** F.eks. "Nabolagsrapport · Ranheim, Trondheim". */
  subtitle?: string;
  /** Absolutt URL til hero-illustrasjonen; undefined gir gradient-fallback. */
  imageUrl?: string;
  /** Prosjektets primærfarge (hex) til gradient-fallbacken. */
  themeColor?: string;
}

// Satori håndterer KUN disse formatene i data-URIer — webp/avif (og
// ikke-standard "image/jpg") kaster TypeError under streaming og gir 500.
const SATORI_IMAGE_TYPES = new Set([
  "image/png",
  "image/apng",
  "image/jpeg",
  "image/gif",
  "image/svg+xml",
]);

const MAX_IMAGE_BYTES = 5_000_000;

// Bildet hentes eksplisitt (ikke via satori sin egen <img>-fetch) slik at
// nettverksfeil, treg host (timeout → AbortError → catch), feil format og
// oversized assets alle gir gradient-fallback i stedet for et knekt OG-bilde.
async function fetchImageAsDataUri(url: string): Promise<string | undefined> {
  try {
    // 5s: romslig nok for kald TLS+redirect mot prod-assets (målt ~2s), men
    // godt under previewbotenes egen tålmodighet (~10s) — en timeout her blir
    // ISR-cachet som gradient i en time, så marginen skal være raus.
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return undefined;
    const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!SATORI_IMAGE_TYPES.has(contentType)) return undefined;
    const declaredLength = Number(res.headers.get("content-length"));
    if (declaredLength > MAX_IMAGE_BYTES) return undefined;
    const buffer = await res.arrayBuffer();
    if (buffer.byteLength > MAX_IMAGE_BYTES) return undefined;
    return `data:${contentType};base64,${Buffer.from(buffer).toString("base64")}`;
  } catch {
    return undefined;
  }
}

export async function renderBoardOgImage({
  title,
  subtitle,
  imageUrl,
  themeColor,
}: BoardOgImageInput): Promise<ImageResponse> {
  const imageDataUri = imageUrl ? await fetchImageAsDataUri(imageUrl) : undefined;
  const fallbackBackground = `linear-gradient(135deg, ${themeColor ?? "#1c1c1c"} 0%, #0a0a0a 100%)`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: fallbackBackground,
        }}
      >
        {imageDataUri ? (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              display: "flex",
              backgroundImage: `url(${imageDataUri})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
        ) : null}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            display: "flex",
            background: "linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.78) 100%)",
          }}
        />
        {/* Chip-bakgrunn: hero-bildene kan ha lys himmel øverst, og hvit tekst
            rett på bildet forsvinner da. */}
        <div
          style={{
            position: "absolute",
            top: 44,
            left: 64,
            display: "flex",
            fontSize: 34,
            fontWeight: 700,
            color: "#ffffff",
            letterSpacing: -1,
            background: "rgba(0,0,0,0.4)",
            padding: "8px 24px",
            borderRadius: 999,
          }}
        >
          Placy
        </div>
        <div
          style={{
            position: "absolute",
            left: 64,
            right: 64,
            bottom: 56,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div style={{ fontSize: 64, fontWeight: 700, color: "#ffffff", lineHeight: 1.1 }}>
            {title}
          </div>
          {subtitle ? (
            <div style={{ fontSize: 30, color: "rgba(255,255,255,0.85)" }}>{subtitle}</div>
          ) : null}
        </div>
      </div>
    ),
    OG_IMAGE_SIZE,
  );
}
