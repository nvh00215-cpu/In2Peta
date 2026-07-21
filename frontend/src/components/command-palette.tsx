"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  FileText,
  GraduationCap,
  Layers,
  Loader2,
  Quote,
  Search,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { SegmentedControl } from "@/components/ds/segmented-control";
import { search } from "@/lib/api";
import type { SearchResult, SearchResultType } from "@/lib/api";
import { cn } from "@/lib/utils";

interface CommandPaletteContextValue {
  open: () => void;
}

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

export function useCommandPalette(): CommandPaletteContextValue {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx) throw new Error("useCommandPalette must be used within CommandPaletteProvider");
  return ctx;
}

const TYPE_LABEL: Record<SearchResultType, string> = {
  course: "Courses",
  chapter: "Chapters",
  topic: "Topics",
  lesson: "Lessons",
  passage: "Passages",
};

const TYPE_ORDER: SearchResultType[] = ["course", "chapter", "topic", "lesson", "passage"];

function resultIcon(type: SearchResultType) {
  const cls = "h-4 w-4 text-terracotta";
  switch (type) {
    case "course":
      return <GraduationCap className={cls} strokeWidth={1.7} />;
    case "chapter":
      return <Layers className={cls} strokeWidth={1.7} />;
    case "topic":
      return <BookOpen className={cls} strokeWidth={1.7} />;
    case "lesson":
      return <FileText className={cls} strokeWidth={1.7} />;
    case "passage":
      return <Quote className={cls} strokeWidth={1.7} />;
  }
}

function resultHref(result: SearchResult): string {
  if (result.type === "lesson") return `/courses/${result.course_id}/lessons/${result.id}`;
  if (result.type === "topic" && result.lesson_id)
    return `/courses/${result.course_id}/lessons/${result.lesson_id}`;
  return `/courses/${result.course_id}`;
}

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"keyword" | "semantic">("keyword");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    abortRef.current?.abort();
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      setSearched(false);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;
    const timer = window.setTimeout(() => {
      search(q, { mode }, controller.signal)
        .then((res) => {
          setResults(res.results);
          setSearched(true);
          setLoading(false);
        })
        .catch((err: unknown) => {
          if ((err as Error).name === "AbortError") return;
          setResults([]);
          setSearched(true);
          setLoading(false);
        });
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, mode]);

  const grouped = useMemo(() => {
    const groups = new Map<SearchResultType, SearchResult[]>();
    for (const type of TYPE_ORDER) groups.set(type, []);
    for (const result of results) groups.get(result.type)?.push(result);
    return TYPE_ORDER.filter((type) => (groups.get(type) ?? []).length > 0).map((type) => ({
      type,
      items: groups.get(type) ?? [],
    }));
  }, [results]);

  const openPalette = useCallback(() => setOpen(true), []);
  const contextValue = useMemo(() => ({ open: openPalette }), [openPalette]);

  function handleSelect(result: SearchResult) {
    setOpen(false);
    setQuery("");
    router.push(resultHref(result));
  }

  return (
    <CommandPaletteContext.Provider value={contextValue}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg overflow-hidden rounded-card-lg border-border-gray bg-white p-0 shadow-card">
          <DialogTitle className="sr-only">Search</DialogTitle>
          <div className="flex items-center gap-3 border-b border-border-gray px-4 py-3">
            <Search className="h-5 w-5 text-muted-gray" strokeWidth={1.7} />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search courses, lessons, concepts…"
              className="h-10 flex-1 bg-transparent text-body text-heading outline-none placeholder:text-muted-gray"
            />
          </div>
          <div className="px-4 py-3">
            <SegmentedControl
              options={[
                { value: "keyword", label: "Keyword" },
                { value: "semantic", label: "Semantic" },
              ]}
              value={mode}
              onChange={setMode}
            />
          </div>
          <div className="max-h-[360px] overflow-y-auto px-2 pb-3">
            {loading && (
              <div className="flex items-center justify-center gap-2 py-8 text-body text-muted-gray">
                <Loader2 className="h-4 w-4 animate-spin text-terracotta" />
                Searching…
              </div>
            )}
            {!loading && query.trim().length < 2 && (
              <p className="py-8 text-center text-body text-muted-gray">
                Type at least 2 characters to search.
              </p>
            )}
            {!loading && searched && results.length === 0 && (
              <p className="py-8 text-center text-body text-muted-gray">No results found.</p>
            )}
            {!loading &&
              grouped.map((group) => (
                <div key={group.type} className="mb-2">
                  <p className="px-3 py-2 text-caption font-medium text-muted-gray">
                    {TYPE_LABEL[group.type]}
                  </p>
                  {group.items.map((result) => (
                    <button
                      key={`${result.type}-${result.id}`}
                      onClick={() => handleSelect(result)}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-card-sm px-3 py-3 text-left transition-colors hover:bg-light-gray"
                      )}
                    >
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-pill bg-terracotta/10">
                        {resultIcon(result.type)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-card-title text-heading">
                          {result.title}
                        </span>
                        <span className="mt-0.5 block truncate text-caption text-muted-gray">
                          {result.course_title}
                          {result.snippet ? ` — ${result.snippet}` : ""}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              ))}
          </div>
        </DialogContent>
      </Dialog>
    </CommandPaletteContext.Provider>
  );
}
