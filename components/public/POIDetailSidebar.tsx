import Image from "next/image";
import { MapPin, ExternalLink, Clock } from "lucide-react";
import { isSafeUrl } from "@/lib/utils/url";

interface POIDetailSidebarProps {
  poi: {
    name: string;
    googleMapsUrl?: string;
    googleWebsite?: string;
    coordinates: { lat: number; lng: number };
    openingHoursJson?: { weekday_text?: string[] };
    localInsight?: string;
  };
  staticMapUrl: string | null;
  locale: "no" | "en";
}

export default function POIDetailSidebar({
  poi,
  staticMapUrl,
  locale,
}: POIDetailSidebarProps) {
  const labels =
    locale === "en"
      ? {
          maps: "View on Google Maps",
          website: "Website",
          hours: "Opening Hours",
          localTip: "Local Tip",
          mapAlt: `Map of ${poi.name}`,
        }
      : {
          maps: "Vis i Google Maps",
          website: "Nettside",
          hours: "Åpningstider",
          localTip: "Lokaltips",
          mapAlt: `Kart over ${poi.name}`,
        };

  const mapsHref =
    poi.googleMapsUrl ??
    `https://www.google.com/maps/search/?api=1&query=${poi.coordinates.lat},${poi.coordinates.lng}`;

  return (
    <div className="space-y-4 lg:sticky lg:top-20">
      {/* Action buttons */}
      <div className="space-y-2">
        {poi.googleMapsUrl && isSafeUrl(poi.googleMapsUrl) && (
          <a
            href={poi.googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-[#1a1a1a] text-white text-[15px] font-medium rounded-lg hover:bg-[#333] transition-colors"
          >
            <MapPin className="w-4 h-4" />
            {labels.maps}
          </a>
        )}
        {poi.googleWebsite && isSafeUrl(poi.googleWebsite) && (
          <a
            href={poi.googleWebsite}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-white text-[#1a1a1a] text-[15px] font-medium rounded-lg border border-[#eae6e1] hover:border-[#d4cfc8] transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            {labels.website}
          </a>
        )}
      </div>

      {/* Static map */}
      {staticMapUrl ? (
        <a
          href={mapsHref}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-lg overflow-hidden border border-[#eae6e1] hover:border-[#d4cfc8] transition-all"
        >
          <Image
            src={staticMapUrl}
            alt={labels.mapAlt}
            width={400}
            height={300}
            className="w-full h-auto"
            loading="lazy"
          />
        </a>
      ) : (
        <div className="aspect-[4/3] rounded-lg bg-[#f0ece7] flex items-center justify-center">
          <MapPin className="w-8 h-8 text-[#c0b9ad]" />
        </div>
      )}

      {/* Opening hours */}
      {poi.openingHoursJson?.weekday_text &&
        poi.openingHoursJson.weekday_text.length > 0 && (
          <div className="bg-[#faf8f5] rounded-lg p-4">
            <h3 className="text-[15px] font-semibold text-[#1a1a1a] mb-2 flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              {labels.hours}
            </h3>
            <ul className="space-y-1">
              {poi.openingHoursJson.weekday_text.map((line, i) => (
                <li key={i} className="text-[15px] text-[#4a4a4a]">
                  {line}
                </li>
              ))}
            </ul>
          </div>
        )}

      {/* Local tip */}
      {poi.localInsight && (
        <div className="bg-[#faf8f5] rounded-lg p-4">
          <h3 className="text-[15px] font-semibold text-[#1a1a1a] mb-2">
            {labels.localTip}
          </h3>
          <p className="text-base text-[#4a4a4a] leading-relaxed">
            {poi.localInsight}
          </p>
        </div>
      )}
    </div>
  );
}
