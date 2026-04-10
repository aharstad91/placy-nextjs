import type { BrokerInfo } from "@/lib/types";

interface BrokerInviteProps {
  text?: string;
  fallbackBroker?: BrokerInfo;
  themesCount?: number;
  projectName: string;
}

function buildDefaultText(
  fallbackBroker: BrokerInfo | undefined,
  themesCount: number | undefined,
  projectName: string
): string {
  const who = fallbackBroker?.firstName ?? "Megleren";
  const themePart =
    themesCount && themesCount > 0
      ? `Du har sett ${themesCount} temaer om ${projectName}. `
      : "";
  return `${themePart}${who} kjenner nabolaget og kan svare på det rapporten ikke dekker.`;
}

export default function BrokerInvite({
  text,
  fallbackBroker,
  themesCount,
  projectName,
}: BrokerInviteProps) {
  const resolved = text ?? buildDefaultText(fallbackBroker, themesCount, projectName);

  return (
    <p className="text-base md:text-lg text-foreground leading-relaxed max-w-prose">
      {resolved}
    </p>
  );
}
