"use client";

import { Search, SlidersHorizontal } from "lucide-react";
import { IconButton } from "@/components/ds/icon-button";
import { cn } from "@/lib/utils";

/**
 * componentLibrary.inputs.searchBar — pill, magnifier icon left, muted
 * placeholder, with an adjacent circular filter icon button.
 */
export function SearchBar({
  placeholder = "Search your courses…",
  onActivate,
  onFilter,
  className,
}: {
  placeholder?: string;
  onActivate: () => void;
  onFilter?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <button
        onClick={onActivate}
        className="flex h-[52px] flex-1 items-center gap-3 rounded-pill bg-white px-5 text-left shadow-card transition-shadow hover:shadow-card-hover"
      >
        <Search className="h-5 w-5 shrink-0 text-muted-gray" strokeWidth={1.7} />
        <span className="flex-1 truncate text-body text-muted-gray">
          {placeholder}
        </span>
        <kbd className="hidden rounded-pill bg-light-gray px-3 py-1 text-caption text-muted-gray sm:inline">
          Ctrl K
        </kbd>
      </button>
      {onFilter ? (
        <IconButton aria-label="Filters" variant="terracotta" size={52} onClick={onFilter}>
          <SlidersHorizontal className="h-5 w-5" strokeWidth={1.7} />
        </IconButton>
      ) : null}
    </div>
  );
}
