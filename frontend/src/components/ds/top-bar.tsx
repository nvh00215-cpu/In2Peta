"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { IconButton } from "@/components/ds/icon-button";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/**
 * componentLibrary.navigation.topBar — back chevron left + centered bold
 * title, transparent background; optional action slot on the right.
 */
export function TopBar({
  title,
  backHref,
  action,
  onDark = false,
  className,
}: {
  title: string;
  backHref?: string;
  action?: ReactNode;
  onDark?: boolean;
  className?: string;
}) {
  const router = useRouter();
  return (
    <div className={cn("flex h-16 items-center gap-3 px-4", className)}>
      <IconButton
        aria-label="Go back"
        variant={onDark ? "on-dark" : "white"}
        onClick={() => (backHref ? router.push(backHref) : router.back())}
      >
        <ChevronLeft className="h-5 w-5" strokeWidth={1.7} />
      </IconButton>
      <h1
        className={cn(
          "min-w-0 flex-1 truncate text-center text-card-title font-semibold",
          onDark ? "text-white" : "text-heading"
        )}
      >
        {title}
      </h1>
      <div className="flex w-10 shrink-0 justify-end">{action}</div>
    </div>
  );
}
