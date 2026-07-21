import { cn } from "@/lib/utils";

/** Terracotta progress fill on a light-gray pill track. */
export function ProgressBar({
  value,
  className,
  onDark = false,
}: {
  value: number;
  className?: string;
  onDark?: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn(
        "h-2 w-full overflow-hidden rounded-pill",
        onDark ? "bg-white/15" : "bg-light-gray",
        className
      )}
    >
      <div
        className="h-full rounded-pill bg-terracotta transition-[width] duration-500"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
