"use client";

import { cn } from "@/lib/utils";

/**
 * componentLibrary.navigation.segmentedControl — pill tabs inside a rounded
 * container; active tab filled terracotta + white text.
 */
export function SegmentedControl<T extends string>({
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
        "flex w-full gap-1 rounded-pill bg-light-gray p-1",
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
              "flex-1 rounded-pill px-4 py-2 text-caption font-medium transition-colors",
              active
                ? "bg-terracotta text-white"
                : "bg-transparent text-body-gray hover:text-heading"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
