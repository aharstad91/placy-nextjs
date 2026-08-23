import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { requireAdminApi } from "@/lib/admin/require-admin";

const MAX_PATHS = 20;
const MAX_TAGS = 20;

/**
 * Aksepterer både flertallsformen ({paths, tags}) og entallsformen
 * ({path, tag}) som `provision.ts:revalidateProject` sender — den ble avvist
 * med 400 før (funnet 2026-08-23), så provisjoneringens cache-bust falt
 * stille tilbake til advarselen sin.
 */
function asList(plural: unknown, singular: unknown): unknown[] {
  if (Array.isArray(plural)) return plural;
  if (typeof singular === "string") return [singular];
  return [];
}

export async function POST(request: NextRequest) {
  const gate = requireAdminApi();
  if (gate) return gate;

  let body: { paths?: unknown; path?: unknown; tags?: unknown; tag?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const paths = asList(body.paths, body.path);
  const tags = asList(body.tags, body.tag);

  const validPaths =
    paths.length <= MAX_PATHS &&
    paths.every((p): p is string => typeof p === "string" && p.startsWith("/"));
  // Tag-designet er `product:<customer>_<slug>` (cached-board-reads.ts) —
  // formkravet stopper vilkårlige strenger uten å hardkode prefikset.
  const validTags =
    tags.length <= MAX_TAGS &&
    tags.every((t): t is string => typeof t === "string" && /^[\w:-]{1,100}$/.test(t));

  if (!validPaths || !validTags || (paths.length === 0 && tags.length === 0)) {
    return NextResponse.json(
      { error: `body must carry 1-${MAX_PATHS} absolute paths and/or 1-${MAX_TAGS} tags` },
      { status: 400 }
    );
  }

  // BEGGE trengs: `unstable_cache`-lesingene (cached-board-reads.ts) busts kun
  // av taggen sin, mens rutens full-route-cache busts av path-en. Kommentaren
  // som sto her om at «path-revalidering er hele jobben» var utdatert — den
  // gjaldt public-ISR-flaten som døde ved cutover, ikke tag-designet som lever.
  for (const tag of tags as string[]) {
    // Next 16: to-args-form med 'max'-profil — samme som /api/revalidate.
    revalidateTag(tag, "max");
  }
  for (const path of paths as string[]) {
    revalidatePath(path, "layout");
  }

  return NextResponse.json({ revalidated: { paths, tags } });
}
