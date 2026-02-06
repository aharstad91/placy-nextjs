/**
 * StoryWriter API Route
 *
 * Generates story structure from existing POIs in Supabase.
 * Can create new projects or regenerate stories for existing projects.
 */

import { NextRequest, NextResponse } from "next/server";
import { getPOIsWithinRadius } from "@/lib/supabase/queries";
import {
  createProject,
  getProjectBySlug,
  writeStoryStructure,
  updateProjectStoryMetadata,
} from "@/lib/supabase/mutations";
import {
  generateStoryForProject,
  generateIntroText,
  STORY_WRITER_DEFAULT_THEMES,
} from "@/lib/generators/story-writer";
import type { ThemeConfig } from "@/lib/generators/story-structure";
import { slugify } from "@/lib/utils/slugify";

interface StoryWriterRequest {
  // For new project
  name?: string;
  customerId?: string;
  center?: { lat: number; lng: number };
  radius?: number;
  categoryIds?: string[];
  themes?: ThemeConfig[];

  // For existing project (regenerate)
  projectId?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Check admin access
    if (process.env.ADMIN_ENABLED !== "true") {
      return NextResponse.json(
        { message: "Admin ikke aktivert" },
        { status: 403 }
      );
    }

    const body: StoryWriterRequest = await request.json();

    let projectId: string;
    let projectName: string;
    let center: { lat: number; lng: number };
    let radius: number;
    let customerId: string;
    let urlSlug: string;

    // Determine if we're creating new or regenerating
    if (body.projectId) {
      // Regenerating existing project - would need to fetch project details
      // For now, this mode requires all params
      return NextResponse.json(
        { message: "Regenerering av eksisterende prosjekt er ikke implementert ennå" },
        { status: 400 }
      );
    } else {
      // Creating new project
      if (!body.name || !body.customerId || !body.center) {
        return NextResponse.json(
          { message: "Mangler påkrevde felt: name, customerId, center" },
          { status: 400 }
        );
      }

      projectName = body.name;
      customerId = body.customerId;
      center = body.center;
      radius = body.radius || 1000;
      urlSlug = slugify(projectName);

      // Check if project already exists
      const existingProject = await getProjectBySlug(customerId, urlSlug);
      if (existingProject) {
        return NextResponse.json(
          {
            message: `Prosjekt med slug "${urlSlug}" finnes allerede for denne kunden`,
            existingProjectId: existingProject.id,
          },
          { status: 409 }
        );
      }
    }

    // Step 1: Fetch POIs within radius
    console.log(`[StoryWriter] Fetching POIs within ${radius}m of (${center.lat}, ${center.lng})`);

    const poisWithCategories = await getPOIsWithinRadius(
      center,
      radius,
      body.categoryIds
    );

    if (poisWithCategories.length === 0) {
      return NextResponse.json(
        {
          message: "Ingen POI-er funnet innen angitt radius. Prøv større radius eller importer POI-er først.",
          suggestion: "Kjør POI Importer for å fylle databasen med steder i dette området.",
        },
        { status: 400 }
      );
    }

    console.log(`[StoryWriter] Found ${poisWithCategories.length} POIs`);

    // Step 2: Create project in Supabase
    console.log(`[StoryWriter] Creating project: ${projectName}`);

    const introText = generateIntroText(projectName, poisWithCategories.length);

    projectId = await createProject({
      name: projectName,
      customerId,
      urlSlug,
      centerLat: center.lat,
      centerLng: center.lng,
      storyTitle: `Velkommen til ${projectName}`,
      storyIntroText: introText,
    });

    console.log(`[StoryWriter] Project created with ID: ${projectId}`);

    // Step 3: Generate story structure
    console.log(`[StoryWriter] Generating story structure`);

    const { structure, stats } = generateStoryForProject({
      projectId,
      projectName,
      pois: poisWithCategories,
      themes: body.themes || STORY_WRITER_DEFAULT_THEMES,
    });

    console.log(`[StoryWriter] Generated ${stats.themeCount} themes with ${stats.totalPois} POIs`);

    // Step 4: Write story structure to Supabase
    console.log(`[StoryWriter] Writing story structure to Supabase`);

    await writeStoryStructure(projectId, structure);

    console.log(`[StoryWriter] Story structure written successfully`);

    // Build project URL
    const projectUrl = `/${customerId}/${urlSlug}`;

    return NextResponse.json({
      success: true,
      projectId,
      projectUrl,
      slug: urlSlug,
      poiCount: stats.totalPois,
      themeCount: stats.themeCount,
      sectionCount: stats.sectionCount,
    });
  } catch (error) {
    console.error("[StoryWriter] Error:", error);
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Ukjent feil under generering",
      },
      { status: 500 }
    );
  }
}
