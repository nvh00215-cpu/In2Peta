import { cn } from "@/lib/utils";

/**
 * Deterministic warm-toned cover art generated from the course title.
 * Uses ONLY palette colors (terracotta shades + charcoal/near-black +
 * off-white) and varies pattern/direction, never hue.
 */
function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

const GRADIENTS = [
  "linear-gradient(135deg, #B8754A 0%, #A6633A 55%, #1E1E1E 130%)",
  "linear-gradient(160deg, #A6633A 0%, #B8754A 60%, #EDEBE8 160%)",
  "linear-gradient(200deg, #1E1E1E -30%, #B8754A 55%, #A6633A 100%)",
  "linear-gradient(120deg, #B8754A -10%, #1E1E1E 120%)",
  "linear-gradient(340deg, #A6633A 0%, #B8754A 45%, #141414 150%)",
];

const PATTERNS = [
  "radial-gradient(circle at 80% 15%, rgba(247,245,243,0.28) 0%, transparent 34%)",
  "radial-gradient(circle at 20% 85%, rgba(247,245,243,0.22) 0%, transparent 40%)",
  "radial-gradient(circle at 70% 75%, rgba(20,20,20,0.28) 0%, transparent 45%)",
  "repeating-linear-gradient(45deg, rgba(247,245,243,0.07) 0 10px, transparent 10px 26px)",
  "radial-gradient(circle at 50% -20%, rgba(247,245,243,0.24) 0%, transparent 55%)",
];

export function CoverArt({
  seed,
  className,
  children,
}: {
  seed: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const hash = hashString(seed);
  const gradient = GRADIENTS[hash % GRADIENTS.length];
  const pattern = PATTERNS[(hash >> 3) % PATTERNS.length];
  const initial = (seed.trim()[0] ?? "?").toUpperCase();

  return (
    <div
      className={cn("relative overflow-hidden", className)}
      style={{ backgroundImage: `${pattern}, ${gradient}` }}
      aria-hidden
    >
      <span className="absolute bottom-2 right-4 select-none text-display text-white/25">
        {initial}
      </span>
      {children}
    </div>
  );
}
