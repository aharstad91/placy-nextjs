import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_CACHE_TAG } from "@/lib/supabase/public-client";

const MAX_PATHS = 20;

export async function POST(request: NextRequest) {
  if (process.env.ADMIN_ENABLED !== "true") {
    return NextResponse.json({ error: "Admin ikke aktivert" }, { status: 403 });
  }

  let body: { paths?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { paths } = body;

  if (
    !Array.isArray(paths) ||
    paths.length === 0 ||
    paths.length > MAX_PATHS ||
    paths.some(
      (p: unknown) => typeof p !== "string" || !p.startsWith("/")
    )
  ) {
    return NextResponse.json(
      { error: `paths must be 1-${MAX_PATHS} absolute paths` },
      { status: 400 }
    );
  }

  // Purge Supabase Data Cache so fresh data is fetched
  revalidateTag(SUPABASE_CACHE_TAG);

  for (const path of paths as string[]) {
    revalidatePath(path, "layout");
  }

  return NextResponse.json({ revalidated: paths });
}
