"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * componentLibrary.buttons.primary — 52px full-width terracotta pill,
 * white 15/600 label, pressed state = terracottaDark. Exactly one per screen.
 */
export const PrimaryButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement>
>(function PrimaryButton({ className, children, ...props }, ref) {
  return (
    <button
      ref={ref}
      className={cn(
        "flex h-[52px] w-full items-center justify-center gap-2 rounded-btn bg-terracotta px-6 text-btn text-white transition-colors",
        "active:bg-terracotta-dark enabled:hover:bg-terracotta-dark",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
});
