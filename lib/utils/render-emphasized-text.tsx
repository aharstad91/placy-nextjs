import React from "react";

/**
 * Apple-style two-tone emphasis: **phrase** in source text → darker/weighted span.
 * Surrounding text inherits parent color (usually softer), creating the
 * "confident claim + supporting detail" rhythm used on Apple product pages.
 *
 * Usage in content: "**Short claim.** Supporting detail here."
 */
export function renderEmphasizedText(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <span key={i} className="text-[#1a1a1a] font-medium">
          {part.slice(2, -2)}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
