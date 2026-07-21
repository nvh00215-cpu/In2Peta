"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "white" | "terracotta" | "light" | "on-dark";
type Shape = "circle" | "square";

/**
 * componentLibrary.buttons.iconButton — 40px circle (default) or rounded-12
 * square; white or terracotta fill depending on context.
 */
export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: Variant;
    shape?: Shape;
    size?: number;
  }
>(function IconButton(
  { className, children, variant = "white", shape = "circle", size = 40, ...props },
  ref
) {
  const fills: Record<Variant, string> = {
    white: "bg-white text-heading shadow-card enabled:hover:bg-light-gray",
    terracotta: "bg-terracotta text-white enabled:hover:bg-terracotta-dark",
    light: "bg-light-gray text-heading enabled:hover:bg-border-gray",
    "on-dark": "bg-white/10 text-white enabled:hover:bg-white/20",
  };
  return (
    <button
      ref={ref}
      style={{ width: size, height: size }}
      className={cn(
        "flex shrink-0 items-center justify-center transition-colors disabled:opacity-60",
        shape === "circle" ? "rounded-pill" : "rounded-icon",
        fills[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
});
