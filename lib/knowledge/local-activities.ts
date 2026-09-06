import { z } from "zod";

/** One reusable relationship: an organizer offers an activity at a venue.
 * Address-specific travel times and final FAQ prose do not belong here. */
export const LocalActivitySchema = z.object({
  id: z.string().min(1),
  area_id: z.string().min(1),
  confidence: z.literal("verified"),
  display_ready: z.literal(true),
  source_name: z.string().min(1),
  source_url: z.url().refine((url) => url.startsWith("https://")),
  verified_at: z.iso.datetime({ offset: true }),
  structured_data: z.object({
    kind: z.literal("local_activity"),
    version: z.literal(1),
    organizer: z.string().min(1),
    activity: z.string().min(1),
    domain: z.enum(["sport", "culture"]),
    audience: z.literal("children"),
    venue: z.string().min(1),
    validUntil: z.iso.datetime({ offset: true }),
  }),
});

export type LocalActivity = z.infer<typeof LocalActivitySchema>;
export interface KnowledgeSource {
  id: string;
  name: string;
  url: string;
  verifiedAt: string;
}

/** Invalid, unreviewed and expired rows remain gaps, never plausible prose. */
export function activeLocalActivities(rows: readonly unknown[], now = Date.now()): LocalActivity[] {
  return rows.flatMap((row) => {
    const parsed = LocalActivitySchema.safeParse(row);
    if (!parsed.success) return [];
    const fact = parsed.data;
    return Date.parse(fact.verified_at) <= now && Date.parse(fact.structured_data.validUntil) > now
      ? [fact]
      : [];
  });
}

export function activityAnswer(questionId: string, rows: readonly unknown[], now = Date.now()):
  { answer: string; knowledgeSources: KnowledgeSource[] } | undefined {
  if (questionId !== "oppvekst-fritid" && questionId !== "idrettslag") return undefined;
  const facts = activeLocalActivities(rows, now)
    .filter((fact) => questionId !== "idrettslag" || fact.structured_data.domain === "sport")
    .slice(0, 2);
  if (facts.length === 0) return undefined;
  return {
    answer: facts.map(({ structured_data: f }) => questionId === "idrettslag"
      ? `${f.organizer} har et lokalt tilbud med ${f.activity} for barn ${f.venue}.`
      : `${f.organizer} tilbyr ${f.activity} for barn, med oppmøte ${f.venue}.`
    ).join(" ") + " Se arrangørens informasjon om alder, påmelding og ledige plasser.",
    knowledgeSources: facts.map((f) => ({
      id: f.id, name: f.source_name, url: f.source_url, verifiedAt: f.verified_at,
    })),
  };
}
