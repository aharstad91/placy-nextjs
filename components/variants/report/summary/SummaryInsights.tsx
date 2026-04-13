import { Sparkles } from "lucide-react";

interface SummaryInsightsProps {
  items: string[];
}

export default function SummaryInsights({ items }: SummaryInsightsProps) {
  if (process.env.NODE_ENV !== "production") {
    if (items.length < 3 || items.length > 5) {
       
      console.warn(
        `SummaryInsights: expected 3–5 items, got ${items.length}. Consider curating the list for readability.`
      );
    }
  }

  if (items.length === 0) return null;

  return (
    <ul className="flex flex-col gap-3 max-w-prose">
      {items.map((item, idx) => (
        <li key={idx} className="flex items-start gap-3 text-base text-foreground">
          <Sparkles
            className="w-4 h-4 mt-1 shrink-0 text-primary"
            aria-hidden="true"
          />
          <span className="leading-relaxed">{item}</span>
        </li>
      ))}
    </ul>
  );
}
