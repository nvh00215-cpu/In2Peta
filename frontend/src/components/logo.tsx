import Link from "next/link";
import { BookOpenText } from "lucide-react";
import { cn } from "@/lib/utils";

/** In2Peta logo badge + wordmark. */
export function Logo({
  href = "/",
  onDark = false,
  className,
}: {
  href?: string;
  onDark?: boolean;
  className?: string;
}) {
  return (
    <Link href={href} className={cn("flex items-center gap-2", className)}>
      <span
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-pill",
          onDark ? "bg-white/15 text-white" : "bg-terracotta text-white"
        )}
      >
        <BookOpenText className="h-5 w-5" strokeWidth={1.7} />
      </span>
      <span
        className={cn(
          "text-card-title font-semibold tracking-tight",
          onDark ? "text-white" : "text-heading"
        )}
      >
        In2Peta
      </span>
    </Link>
  );
}
