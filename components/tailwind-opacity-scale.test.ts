import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Tailwinds opacity-modifikator godtar bare verdier som finnes i skalaen.
 *
 * `bg-white/97` ser helt riktig ut i koden, men 97 er ikke i skalaen (den går i
 * trinn på 5), og klassen blir DROPPET uten en advarsel noe sted — verken
 * build, lint eller typesjekk sier fra. Elementet står da uten bakgrunn, og med
 * `backdrop-blur` ved siden av blir resultatet en grumsete flekk av kartet
 * under i stedet for et lyst panel.
 *
 * Det skjedde to steder samtidig (reisetid-chipens panel i 3D og på
 * rutemidtpunktet, 2026-08-28), og det var brukeren som fant det i nettleseren.
 * Denne testen er billigere enn neste bug-rapport: den leser kildefilene og
 * krever at hver opacity-modifikator ligger i skalaen — eller er skrevet som en
 * eksplisitt arbitrær verdi (`bg-white/[.97]`), som Tailwind faktisk genererer.
 */

/** Tailwinds default opacity-skala: 0–100 i trinn på 5. */
const SKALA = new Set(
  Array.from({ length: 21 }, (_, i) => String(i * 5)),
);

const ROTMAPPER = ["app", "components", "lib"];
const FIL_ENDELSER = [".ts", ".tsx"];

/**
 * Fargeklasse med opacity-modifikator: `bg-white/97`, `text-stone-900/40`,
 * `ring-black/5`. Fanger IKKE `bg-white/[.97]` — hakeparentesen er den
 * eksplisitte formen Tailwind alltid genererer, og den er lovlig.
 */
const MODIFIKATOR =
  /\b(?:bg|text|border|ring|divide|outline|shadow|decoration|placeholder|accent|caret|fill|stroke|from|via|to)-[a-z]+(?:-\d{2,3})?\/(\d{1,3})\b/g;

/** Denne filen selv: doccen over NEVNER en ulovlig verdi for å forklare den. */
const EGEN_FIL = "tailwind-opacity-scale.test.ts";

function kildefiler(dir: string): string[] {
  const ut: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    if (e.name === EGEN_FIL) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) ut.push(...kildefiler(full));
    else if (FIL_ENDELSER.some((x) => e.name.endsWith(x))) ut.push(full);
  }
  return ut;
}

describe("Tailwind opacity-skala", () => {
  it("bruker ingen opacity-verdi utenfor skalaen — de blir droppet i stillhet", () => {
    const funn: string[] = [];
    for (const rot of ROTMAPPER) {
      for (const fil of kildefiler(join(process.cwd(), rot))) {
        const src = readFileSync(fil, "utf8");
        const linjer = src.split("\n");
        linjer.forEach((linje, i) => {
          for (const m of linje.matchAll(MODIFIKATOR)) {
            if (SKALA.has(m[1])) continue;
            funn.push(
              `${fil.replace(process.cwd() + "/", "")}:${i + 1} → ${m[0]}`,
            );
          }
        });
      }
    }
    expect(funn).toEqual([]);
  });
});
