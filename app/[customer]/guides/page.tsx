import { notFound } from "next/navigation";
import { getGuidesByCustomer } from "@/lib/data-server";
import { GUIDE_CATEGORIES, GUIDE_CATEGORY_LABELS } from "@/lib/types";
import type { Project, GuideCategory } from "@/lib/types";
import GuideLibraryClient from "./GuideLibraryClient";

interface PageProps {
  params: Promise<{
    customer: string;
  }>;
}

// Group guides by category
function groupGuidesByCategory(guides: Project[]): Record<GuideCategory, Project[]> {
  const grouped: Record<GuideCategory, Project[]> = {
    'food': [],
    'culture': [],
    'nature': [],
    'family': [],
    'active': [],
    'hidden-gems': [],
  };

  for (const guide of guides) {
    const category = guide.guideConfig?.category;
    if (category && category in grouped) {
      grouped[category].push(guide);
    } else {
      // Default to hidden-gems if no category
      grouped['hidden-gems'].push(guide);
    }
  }

  return grouped;
}

export default async function GuidesPage({ params }: PageProps) {
  const { customer } = await params;
  const guides = await getGuidesByCustomer(customer);

  // If no guides exist, show empty state
  if (guides.length === 0) {
    return (
      <main className="min-h-screen bg-[#FAF8F5] flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="font-serif text-2xl text-[#1A1A1A] mb-2">
            Ingen guides tilgjengelig
          </h1>
          <p className="text-[#6B6560]">
            Det finnes ingen guides for dette området enn&aacute;.
          </p>
        </div>
      </main>
    );
  }

  const groupedGuides = groupGuidesByCategory(guides);

  // Get categories that have guides (in defined order)
  const categoriesWithGuides = GUIDE_CATEGORIES.filter(
    (cat) => groupedGuides[cat].length > 0
  );

  return (
    <GuideLibraryClient
      customer={customer}
      guides={guides}
      groupedGuides={groupedGuides}
      categoriesWithGuides={categoriesWithGuides}
      categoryLabels={GUIDE_CATEGORY_LABELS}
    />
  );
}

export async function generateMetadata({ params }: PageProps) {
  const { customer } = await params;

  return {
    title: `Guides | ${customer}`,
    description: `Utforsk alle guides for ${customer}`,
  };
}
