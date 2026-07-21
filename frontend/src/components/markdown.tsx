"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

export function Markdown({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "text-body leading-relaxed text-body-gray [&>*+*]:mt-3",
        "[&_h1]:text-section [&_h1]:font-semibold [&_h1]:text-heading",
        "[&_h2]:text-card-title [&_h2]:font-semibold [&_h2]:text-heading",
        "[&_h3]:text-card-title [&_h3]:font-semibold [&_h3]:text-heading",
        "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li+li]:mt-1",
        "[&_a]:text-terracotta [&_a]:underline [&_a]:underline-offset-2",
        "[&_code]:rounded-icon [&_code]:bg-light-gray [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-caption [&_code]:text-heading",
        "[&_pre]:overflow-x-auto [&_pre]:rounded-card-sm [&_pre]:bg-light-gray [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0",
        "[&_blockquote]:border-l-2 [&_blockquote]:border-terracotta [&_blockquote]:pl-3 [&_blockquote]:text-muted-gray",
        "[&_table]:w-full [&_table]:border-collapse",
        "[&_th]:border [&_th]:border-border-gray [&_th]:bg-light-gray [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:text-caption [&_th]:text-heading",
        "[&_td]:border [&_td]:border-border-gray [&_td]:px-2 [&_td]:py-1",
        className
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
