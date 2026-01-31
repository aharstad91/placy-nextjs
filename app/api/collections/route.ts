import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { Resend } from "resend";
import { createCollection } from "@/lib/supabase/mutations";

interface CreateCollectionBody {
  projectId: string;
  poiIds: string[];
  email?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateCollectionBody = await request.json();

    // Validate input
    if (!body.projectId) {
      return NextResponse.json(
        { message: "projectId er påkrevd" },
        { status: 400 }
      );
    }

    if (!body.poiIds || body.poiIds.length === 0) {
      return NextResponse.json(
        { message: "Minst én POI må være valgt" },
        { status: 400 }
      );
    }

    // Validate email format if provided
    if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
      return NextResponse.json(
        { message: "Ugyldig e-postadresse" },
        { status: 400 }
      );
    }

    // Generate slug
    const slug = nanoid(8);

    // Create collection in Supabase
    const collection = await createCollection({
      slug,
      projectId: body.projectId,
      poiIds: body.poiIds,
      email: body.email,
    });

    // Build collection URL
    const baseUrl = request.nextUrl.origin;
    const url = `${baseUrl}?c=${collection.slug}`;

    // Send email via Brevo if email provided
    let emailSent = false;
    if (body.email) {
      try {
        emailSent = await sendCollectionEmail(body.email, url, body.poiIds.length);
      } catch (emailError) {
        console.error("[Collections] Email sending failed:", emailError);
        // Don't fail the request if email fails
      }
    }

    return NextResponse.json({
      slug: collection.slug,
      url,
      emailSent,
    });
  } catch (error) {
    console.error("[Collections] Error:", error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Kunne ikke opprette samling" },
      { status: 500 }
    );
  }
}

async function sendCollectionEmail(
  email: string,
  collectionUrl: string,
  poiCount: number
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[Collections] RESEND_API_KEY not set, skipping email");
    return false;
  }

  const resend = new Resend(apiKey);

  const { error } = await resend.emails.send({
    from: "Placy <andreas@aharstad.no>",
    to: [email],
    subject: `Din samling — ${poiCount} steder`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 16px;">
        <h2 style="font-size: 20px; margin-bottom: 8px;">Din samling er klar!</h2>
        <p style="color: #6b7280; font-size: 15px; line-height: 1.6;">
          Du lagret ${poiCount} steder. Åpne samlingen din her:
        </p>
        <a href="${collectionUrl}" style="display: inline-block; margin: 16px 0; padding: 12px 24px; background: #0ea5e9; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">
          Åpne samlingen
        </a>
        <p style="color: #9ca3af; font-size: 13px; margin-top: 24px;">
          God tur!<br>— Placy
        </p>
      </div>
    `,
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }

  return true;
}
