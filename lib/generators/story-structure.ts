/**
 * Story Structure Module
 * Automatisk strukturering av POI-er i themes og seksjoner
 */

import {
  Story,
  StorySection,
  ThemeStory,
  ThemeStorySection,
  POI,
  Category,
} from "../types";
import { DiscoveredPOI } from "./poi-discovery";

// === Types ===

export interface ThemeConfig {
  id: string;
  title: string;
  categories?: string[]; // category IDs to include
  bridgeText?: string; // Override auto-generated text
}

export interface StoryGeneratorConfig {
  projectName: string;
  themes: ThemeConfig[];
  language?: "no" | "en";
  maxPOIsPerSection?: number;
  featuredPOIsInMainStory?: number;
}

// === Theme Templates ===

interface ThemeTemplate {
  id: string;
  title: string;
  categories: string[];
  bridgeTextTemplate: string;
  sections: {
    id: string;
    title: string;
    categories: string[];
    descriptionTemplate?: string;
  }[];
}

const DEFAULT_THEMES: ThemeTemplate[] = [
  {
    id: "mat-drikke",
    title: "Mat & Drikke",
    categories: ["restaurant", "cafe", "bar", "bakery"],
    bridgeTextTemplate: "Fra verdensmesterkaffe til lokale favoritter – her er spisestedene i nabolaget.",
    sections: [
      {
        id: "kaffe-bakeri",
        title: "Kaffe & Bakeri",
        categories: ["cafe", "bakery"],
        descriptionTemplate: "Start dagen med god kaffe og ferske bakervarer.",
      },
      {
        id: "spisesteder",
        title: "Spisesteder",
        categories: ["restaurant", "bar"],
        descriptionTemplate: "Fra casual lunsj til fine dining – her er alternativene.",
      },
    ],
  },
  {
    id: "transport",
    title: "Transport & Mobilitet",
    categories: ["bus", "bike", "train", "tram", "parking", "carshare"],
    bridgeTextTemplate: "Enkel tilgang med buss, sykkel eller bil – alle transportalternativer i nærheten.",
    sections: [
      {
        id: "kollektiv",
        title: "Kollektivtransport",
        categories: ["bus", "train", "tram"],
        descriptionTemplate: "Buss, tog og trikk i gangavstand.",
      },
      {
        id: "sykkel",
        title: "Sykkel",
        categories: ["bike"],
        descriptionTemplate: "Bysykkelstasjoner for korte turer.",
      },
      {
        id: "parkering",
        title: "Parkering",
        categories: ["parking", "carshare"],
        descriptionTemplate: "Parkeringsmuligheter og bildeling.",
      },
    ],
  },
  {
    id: "trening-helse",
    title: "Trening & Helse",
    categories: ["gym", "spa", "outdoor", "doctor", "dentist", "pharmacy"],
    bridgeTextTemplate: "Hold deg i form med treningssentre og utendørsaktiviteter rett utenfor døra.",
    sections: [
      {
        id: "treningssentre",
        title: "Treningssentre",
        categories: ["gym", "spa"],
        descriptionTemplate: "Treningssentre i gangavstand.",
      },
      {
        id: "utendors",
        title: "Utendørs aktiviteter",
        categories: ["outdoor", "bike"],
        descriptionTemplate: "Parker og stier for løping, sykling og turgåing.",
      },
      {
        id: "helse",
        title: "Helsetjenester",
        categories: ["doctor", "dentist", "pharmacy"],
        descriptionTemplate: "Legesenter, tannlege og apotek i nærheten.",
      },
    ],
  },
  {
    id: "daglig-liv",
    title: "Daglige Ærender",
    categories: ["supermarket", "pharmacy", "bank", "post", "haircare"],
    bridgeTextTemplate: "Alt du trenger for hverdagen – matbutikker, apotek og andre tjenester.",
    sections: [
      {
        id: "dagligvare",
        title: "Dagligvare",
        categories: ["supermarket"],
        descriptionTemplate: "Matbutikker i nærområdet.",
      },
      {
        id: "tjenester",
        title: "Tjenester",
        categories: ["bank", "post", "haircare", "pharmacy"],
        descriptionTemplate: "Bank, post og andre hverdagstjenester.",
      },
    ],
  },
  {
    id: "kultur-fritid",
    title: "Kultur & Fritid",
    categories: ["museum", "library", "cinema", "park", "shopping"],
    bridgeTextTemplate: "Opplevelser og aktiviteter for fritiden.",
    sections: [
      {
        id: "kultur",
        title: "Kultur",
        categories: ["museum", "library", "cinema"],
        descriptionTemplate: "Museer, bibliotek og kino.",
      },
      {
        id: "shopping-fritid",
        title: "Shopping & Parker",
        categories: ["shopping", "park"],
        descriptionTemplate: "Shoppingmuligheter og grøntområder.",
      },
    ],
  },
];

// === Story Generation ===

export function generateStoryStructure(
  pois: DiscoveredPOI[],
  config: StoryGeneratorConfig
): {
  story: Story;
  allCategories: Category[];
  missingEditorialHooks: string[];
} {
  console.log(`\n🏗️ Generating story structure...`);

  // Collect all unique categories from POIs
  const categoryMap = new Map<string, Category>();
  for (const poi of pois) {
    categoryMap.set(poi.category.id, poi.category);
  }
  const allCategories = Array.from(categoryMap.values());

  // Group POIs by category
  const poisByCategory = new Map<string, DiscoveredPOI[]>();
  for (const poi of pois) {
    const existing = poisByCategory.get(poi.category.id) || [];
    existing.push(poi);
    poisByCategory.set(poi.category.id, existing);
  }

  // Generate theme stories
  const themeStories: ThemeStory[] = [];
  const mainStorySections: StorySection[] = [];

  for (const themeConfig of config.themes) {
    // Find matching template or create basic one
    const template = DEFAULT_THEMES.find((t) => t.id === themeConfig.id) || {
      id: themeConfig.id,
      title: themeConfig.title,
      categories: themeConfig.categories || [],
      bridgeTextTemplate: themeConfig.bridgeText || `Utforsk ${themeConfig.title.toLowerCase()} i nabolaget.`,
      sections: [
        {
          id: `${themeConfig.id}-all`,
          title: themeConfig.title,
          categories: themeConfig.categories || [],
        },
      ],
    };

    // Collect POIs for this theme
    const themePOIs: DiscoveredPOI[] = [];
    const categoriesToUse = themeConfig.categories || template.categories;

    for (const catId of categoriesToUse) {
      const categoryPOIs = poisByCategory.get(catId) || [];
      themePOIs.push(...categoryPOIs);
    }

    if (themePOIs.length === 0) {
      console.log(`   → Skipper ${themeConfig.title} (ingen POI-er)`);
      continue;
    }

    // Sort by rating (if available) then by travel time
    themePOIs.sort((a, b) => {
      const ratingA = a.googleRating || 0;
      const ratingB = b.googleRating || 0;
      if (ratingB !== ratingA) return ratingB - ratingA;

      // @ts-expect-error - travelTime might be added dynamically
      const walkA = a.travelTime?.walk || 999;
      // @ts-expect-error - travelTime might be added dynamically
      const walkB = b.travelTime?.walk || 999;
      return walkA - walkB;
    });

    // Generate theme story sections
    const themeStorySections: ThemeStorySection[] = [];

    for (const sectionTemplate of template.sections) {
      const sectionCategories = sectionTemplate.categories;
      const sectionPOIs = themePOIs.filter((p) =>
        sectionCategories.includes(p.category.id)
      );

      if (sectionPOIs.length === 0) continue;

      const maxPOIs = config.maxPOIsPerSection || 10;

      themeStorySections.push({
        id: sectionTemplate.id,
        title: sectionTemplate.title,
        description: sectionTemplate.descriptionTemplate,
        pois: sectionPOIs.slice(0, maxPOIs).map((p) => p.id),
      });
    }

    if (themeStorySections.length === 0) continue;

    // Create theme story
    const themeStory: ThemeStory = {
      id: themeConfig.id,
      slug: themeConfig.id,
      title: themeConfig.title,
      bridgeText:
        themeConfig.bridgeText ||
        `${themePOIs.length} steder funnet. ${countWithinWalk(themePOIs, 10)} innen 10 minutters gange.`,
      sections: themeStorySections,
    };

    themeStories.push(themeStory);

    // Create main story section (preview with featured POIs)
    const featuredCount = config.featuredPOIsInMainStory || 3;
    const featuredPOIs = themePOIs.slice(0, featuredCount);

    mainStorySections.push({
      id: `${themeConfig.id}-section`,
      type: "poi_list",
      categoryLabel: getCategoryLabel(themeConfig.id),
      title: themeConfig.title,
      bridgeText:
        themeConfig.bridgeText || template.bridgeTextTemplate,
      pois: featuredPOIs.map((p) => p.id),
      themeStoryId: themeConfig.id,
    });

    console.log(
      `   → ${themeConfig.title}: ${themePOIs.length} POIs, ${themeStorySections.length} seksjoner`
    );
  }

  // Check for missing editorial hooks
  const missingEditorialHooks = pois
    .filter((p) => !p.editorialHook && p.source === "google")
    .map((p) => p.id);

  // Build final story
  const story: Story = {
    id: slugify(config.projectName) + "-story",
    title: `Velkommen til ${config.projectName}`,
    introText: generateIntroText(config.projectName, pois.length),
    sections: mainStorySections,
    themeStories,
  };

  console.log(
    `\n✅ Story generert: ${mainStorySections.length} seksjoner, ${themeStories.length} theme stories`
  );

  if (missingEditorialHooks.length > 0) {
    console.log(
      `⚠️  ${missingEditorialHooks.length} POI-er mangler editorial hooks`
    );
  }

  return {
    story,
    allCategories,
    missingEditorialHooks,
  };
}

// === Convert DiscoveredPOI to POI ===

export function convertToPOI(
  discovered: DiscoveredPOI & { travelTime?: { walk?: number; bike?: number; car?: number }; editorialHook?: string; localInsight?: string }
): POI {
  return {
    id: discovered.id,
    name: discovered.name,
    coordinates: discovered.coordinates,
    address: discovered.address,
    category: discovered.category,
    googlePlaceId: discovered.googlePlaceId,
    googleRating: discovered.googleRating,
    googleReviewCount: discovered.googleReviewCount,
    enturStopplaceId: discovered.enturStopplaceId,
    bysykkelStationId: discovered.bysykkelStationId,
    editorialHook: discovered.editorialHook,
    localInsight: discovered.localInsight,
    travelTime: discovered.travelTime,
  };
}

// === Helper Functions ===

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function countWithinWalk(
  pois: DiscoveredPOI[],
  minutes: number
): number {
  return pois.filter((p) => {
    // @ts-expect-error - travelTime might be added dynamically
    const walkTime = p.travelTime?.walk;
    return walkTime !== undefined && walkTime <= minutes;
  }).length;
}

function getCategoryLabel(themeId: string): string {
  const labels: Record<string, string> = {
    "mat-drikke": "MAT & DRIKKE",
    transport: "TRANSPORT",
    "trening-helse": "TRENING & HELSE",
    "daglig-liv": "HVERDAGSLIV",
    "kultur-fritid": "KULTUR & FRITID",
  };
  return labels[themeId] || themeId.toUpperCase().replace(/-/g, " ");
}

function generateIntroText(projectName: string, poiCount: number): string {
  return `Oppdag nabolaget rundt ${projectName}. Med ${poiCount} steder innen gangavstand har du alt du trenger for hverdagen – og mer til.`;
}

// Export default themes for reference
export { DEFAULT_THEMES };
