export function StatePanel({
  title,
  message,
  tone = "neutral",
}: {
  title: string;
  message: string;
  tone?: "neutral" | "loading" | "error";
}) {
  return (
    <div className={`state-panel state-panel--${tone}`}>
      <strong>{title}</strong>
      <p>{message}</p>
    </div>
  );
}
