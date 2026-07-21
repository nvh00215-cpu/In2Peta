"use client";

import { cn } from "@/lib/utils";

/**
 * componentLibrary.navigation.categoryPills — horizontally scrollable pill
 * row; active = filled terracotta + white text, inactive = light-gray fill +
 * dark text.
 */
export function CategoryPills<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "scrollbar-none flex gap-2 overflow-x-auto",
        className
      )}
      role="tablist"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "shrink-0 rounded-pill px-4 py-2 text-caption font-medium transition-colors",
              active
                ? "bg-terracotta text-white"
                : "bg-light-gray text-heading hover:bg-border-gray"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
