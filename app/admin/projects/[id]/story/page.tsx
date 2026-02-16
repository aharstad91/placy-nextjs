import { redirect, notFound } from "next/navigation";
import { Suspense } from "react";
import { createServerClient } from "@/lib/supabase/client";
import { revalidatePath } from "next/cache";
import { StoryEditorClient } from "./story-editor-client";
import type { DbThemeStory, DbThemeStorySection, DbPoi } from "@/lib/supabase/types";

const adminEnabled = process.env.ADMIN_ENABLED === "true";

// Types for story editor data
export interface ThemeStoryWithSections extends DbThemeStory {
  sections: SectionWithPois[];
}

export interface SectionWithPois extends DbThemeStorySection {
  pois: PoiBasic[];
}

export interface PoiBasic {
  id: string;
  name: string;
  category_id: string | null;
  google_rating: number | null;
}

export interface StoryEditorPayload {
  themeStories: Array<{
    id: string;
    bridgeText: string | null;
  }>;
  sections: Array<{
    id: string;
    description: string | null;
  }>;
  sectionPois: Array<{
    sectionId: string;
    poiIds: string[]; // Ordered list of POI IDs
  }>;
}

// Server Action: Save all story changes in a single transaction-like operation
async function saveStoryChanges(payload: StoryEditorPayload, projectId: string) {
  "use server";

  const supabase = createServerClient();
  if (!supabase) {
    throw new Error("Supabase not configured");
  }

  const errors: string[] = [];

  // 1. Update theme_stories (bridge_text)
  for (const ts of payload.themeStories) {
    const { error } = await supabase
      .from("theme_stories")
      .update({ bridge_text: ts.bridgeText })
      .eq("id", ts.id);

    if (error) {
      errors.push(`Theme story ${ts.id}: ${error.message}`);
    }
  }

  // 2. Update theme_story_sections (description)
  for (const section of payload.sections) {
    const { error } = await supabase
      .from("theme_story_sections")
      .update({ description: section.description })
      .eq("id", section.id);

    if (error) {
      errors.push(`Section ${section.id}: ${error.message}`);
    }
  }

  // 3. Update theme_section_pois (selection + sort_order)
  for (const sp of payload.sectionPois) {
    // Delete existing POI assignments for this section
    const { error: deleteError } = await supabase
      .from("theme_section_pois")
      .delete()
      .eq("section_id", sp.sectionId);

    if (deleteError) {
      errors.push(`Delete POIs for section ${sp.sectionId}: ${deleteError.message}`);
      continue;
    }

    // Insert new POI assignments with sort order
    if (sp.poiIds.length > 0) {
      const inserts = sp.poiIds.map((poiId, index) => ({
        section_id: sp.sectionId,
        poi_id: poiId,
        sort_order: index,
      }));

      const { error: insertError } = await supabase
        .from("theme_section_pois")
        .insert(inserts);

      if (insertError) {
        errors.push(`Insert POIs for section ${sp.sectionId}: ${insertError.message}`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Save failed: ${errors.join("; ")}`);
  }

  revalidatePath(`/admin/projects/${projectId}/story`);
  revalidatePath(`/admin/projects`);
}

export default async function StoryEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!adminEnabled) {
    redirect("/");
  }

  const { id: projectId } = await params;

  const supabase = createServerClient();
  if (!supabase) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <h1 className="text-xl font-bold text-red-600">
            Supabase ikke konfigurert
          </h1>
        </div>
      </div>
    );
  }

  // Fetch project info
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, name, customer_id")
    .eq("id", projectId)
    .single();

  if (projectError || !project) {
    notFound();
  }

  // Fetch theme stories with nested sections and POIs using single query
  const { data: themeStories, error: tsError } = await supabase
    .from("theme_stories")
    .select(`
      *,
      theme_story_sections (
        *,
        theme_section_pois (
          poi_id,
          sort_order
        )
      )
    `)
    .eq("project_id", projectId)
    .order("sort_order");

  if (tsError) {
    console.error("Error fetching theme stories:", tsError);
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <h1 className="text-xl font-bold text-red-600">Database-feil</h1>
          <p className="mt-2 text-gray-600">{tsError.message}</p>
        </div>
      </div>
    );
  }

  // Collect all POI IDs from all sections
  const allPoiIds = new Set<string>();
  for (const ts of themeStories || []) {
    for (const section of ts.theme_story_sections || []) {
      for (const sp of section.theme_section_pois || []) {
        allPoiIds.add(sp.poi_id);
      }
    }
  }

  // Fetch all POI data at once
  const poisMap: Record<string, PoiBasic> = {};
  if (allPoiIds.size > 0) {
    const { data: pois } = await supabase
      .from("pois")
      .select("id, name, category_id, google_rating")
      .in("id", Array.from(allPoiIds));

    if (pois) {
      for (const poi of pois) {
        poisMap[poi.id] = poi;
      }
    }
  }

  // Fetch all project POIs (for adding new POIs to sections)
  const { data: projectPoiLinks } = await supabase
    .from("project_pois")
    .select("poi_id")
    .eq("project_id", projectId);

  const projectPoiIds = projectPoiLinks?.map(p => p.poi_id) || [];

  let allProjectPois: PoiBasic[] = [];
  if (projectPoiIds.length > 0) {
    const { data: pois } = await supabase
      .from("pois")
      .select("id, name, category_id, google_rating")
      .in("id", projectPoiIds)
      .order("name");

    allProjectPois = pois || [];
  }

  // Transform data structure for client
  const themeStoriesWithSections: ThemeStoryWithSections[] = (themeStories || []).map(ts => {
    const sections: SectionWithPois[] = (ts.theme_story_sections || [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(section => {
        const poiRefs = (section.theme_section_pois || [])
          .sort((a, b) => a.sort_order - b.sort_order);

        const pois: PoiBasic[] = poiRefs
          .map(ref => poisMap[ref.poi_id])
          .filter(Boolean);

        return {
          ...section,
          pois,
        };
      });

    return {
      ...ts,
      sections,
    };
  });

  // Bind projectId to server action
  const saveChanges = async (payload: StoryEditorPayload) => {
    "use server";
    return saveStoryChanges(payload, projectId);
  };

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          Laster...
        </div>
      }
    >
      <StoryEditorClient
        project={project}
        themeStories={themeStoriesWithSections}
        allProjectPois={allProjectPois}
        saveChanges={saveChanges}
      />
    </Suspense>
  );
}
