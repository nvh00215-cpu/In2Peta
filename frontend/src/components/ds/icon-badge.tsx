import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "on-terracotta" | "on-dark" | "terracotta" | "light";

/**
 * componentLibrary.badges.iconBadge — circular icon container. Thin-line icon,
 * translucent white on terracotta backgrounds, white on dark backgrounds.
 */
export function IconBadge({
  children,
  variant = "light",
  size = 40,
  className,
}: {
  children: ReactNode;
  variant?: Variant;
  size?: number;
  className?: string;
}) {
  const fills: Record<Variant, string> = {
    "on-terracotta": "bg-white/20 text-white",
    "on-dark": "bg-white text-heading",
    terracotta: "bg-terracotta/10 text-terracotta",
    light: "bg-light-gray text-heading",
  };
  return (
    <span
      style={{ width: size, height: size }}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-pill",
        fills[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
