import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

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

  for (const path of paths as string[]) {
    revalidatePath(path, "layout");
  }

  return NextResponse.json({ revalidated: paths });
}
