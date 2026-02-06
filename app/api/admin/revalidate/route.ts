import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  if (process.env.ADMIN_ENABLED !== "true") {
    return NextResponse.json({ error: "Admin ikke aktivert" }, { status: 403 });
  }

  const { paths } = await request.json();

  if (
    !Array.isArray(paths) ||
    paths.length === 0 ||
    paths.some(
      (p: unknown) => typeof p !== "string" || !String(p).startsWith("/")
    )
  ) {
    return NextResponse.json(
      { error: "paths must be non-empty array of absolute paths" },
      { status: 400 }
    );
  }

  for (const path of paths) {
    revalidatePath(path, "layout");
  }

  return NextResponse.json({ revalidated: paths });
}
