import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { requireAdminApi } from "@/lib/admin/require-admin";

const MAX_PATHS = 20;

export async function POST(request: NextRequest) {
  const gate = requireAdminApi();
  if (gate) return gate;

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

  // Tag-purgen for public-ISR-cachen døde med (public)-flaten (cutover
  // 2026-07-06) — path-revalidering er hele jobben nå.
  for (const path of paths as string[]) {
    revalidatePath(path, "layout");
  }

  return NextResponse.json({ revalidated: paths });
}
