interface SummaryHeadlineProps {
  text: string;
}

export default function SummaryHeadline({ text }: SummaryHeadlineProps) {
  return (
    <h2 className="text-2xl md:text-3xl font-semibold text-foreground leading-snug max-w-prose">
      {text}
    </h2>
  );
}
