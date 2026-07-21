import type { LucideIcon } from "lucide-react";
import { IconBadge } from "@/components/ds/icon-badge";
import { cn } from "@/lib/utils";

/**
 * Lesson callout card — cardSmall (16px) radius, light fill, circular icon
 * badge, per the reader blueprint.
 */
export function Callout({
  icon: Icon,
  title,
  items,
  body,
  tone = "light",
  className,
}: {
  icon: LucideIcon;
  title: string;
  items?: string[];
  body?: string;
  tone?: "light" | "terracotta";
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-card-sm p-4",
        tone === "terracotta" ? "bg-terracotta/10" : "bg-light-gray",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <IconBadge variant={tone === "terracotta" ? "terracotta" : "on-dark"} size={40}>
          <Icon className="h-5 w-5" strokeWidth={1.7} />
        </IconBadge>
        <h3 className="text-card-title font-semibold text-heading">{title}</h3>
      </div>
      {items && items.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-2">
          {items.map((item, i) => (
            <li key={i} className="flex gap-2 text-body text-body-gray">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-pill bg-terracotta" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {body ? <p className="mt-3 text-body text-body-gray">{body}</p> : null}
    </section>
  );
}
