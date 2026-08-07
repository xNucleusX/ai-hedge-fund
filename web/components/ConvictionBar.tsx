export default function ConvictionBar({ value }: { value: number }) {
  const pct = Math.min(1, Math.abs(value)) * 50;
  const bullish = value > 0;
  return (
    <div className="flex items-center gap-2 w-40">
      <div className="relative h-2 flex-1 rounded-full bg-border/70">
        <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
        {value !== 0 && (
          <div
            className={`absolute inset-y-0 rounded-full ${
              bullish ? "bg-bull left-1/2" : "bg-bear right-1/2"
            }`}
            style={{ width: `${pct}%` }}
          />
        )}
      </div>
      <span
        className={`w-12 shrink-0 text-right font-mono text-xs ${
          value > 0 ? "text-bull" : value < 0 ? "text-bear" : "text-gray-500"
        }`}
      >
        {value > 0 ? "+" : ""}
        {value.toFixed(2)}
      </span>
    </div>
  );
}
