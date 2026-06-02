export function SubtitleDisplay({
  text,
  variant,
  interim,
}: {
  text: string;
  variant: "ai" | "user" | "status";
  interim?: boolean;
}) {
  if (!text) return null;

  const className =
    variant === "ai"
      ? "subtitle-ai"
      : variant === "user"
        ? "subtitle-user"
        : "subtitle-status";

  return (
    <div className="subtitle-area">
      <p className={className} key={text.slice(0, 40)}>
        {text}
        {interim && <span className="animate-blink ml-0.5">|</span>}
      </p>
    </div>
  );
}
