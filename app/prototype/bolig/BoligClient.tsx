"use client";

import type { BoligFixture } from "@/lib/prototype/bolig/contract";
import { useSimulatedSession } from "@/lib/prototype/bolig/simulated-session";
import { useVoiceSession } from "@/lib/prototype/bolig/use-voice-session";
import BoligShell from "@/components/prototype/bolig/BoligShell";

/** Velger transport én gang ved montering; skallet er det samme. */
export default function BoligClient({ fixture, simulated }: { fixture: BoligFixture; simulated: boolean }) {
  return simulated ? <SimulatedBolig fixture={fixture} /> : <LiveBolig fixture={fixture} />;
}

function SimulatedBolig({ fixture }: { fixture: BoligFixture }) {
  const session = useSimulatedSession(fixture);
  return <BoligShell session={session} fixture={fixture} />;
}

function LiveBolig({ fixture }: { fixture: BoligFixture }) {
  const session = useVoiceSession(fixture);
  return <BoligShell session={session} fixture={fixture} />;
}
