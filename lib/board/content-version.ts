import { createHash } from "node:crypto";
import type { Project } from "@/lib/types";

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([key, child]) => key !== "contentVersion" && child !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

/** One version over every serializable field delivered to map and conversation. */
export function projectContentVersion(project: Project): string {
  return createHash("sha256").update(stableJson(project)).digest("hex");
}
