"use client";

import Link from "next/link";
import { LogOut, Search } from "lucide-react";
import { Logo } from "@/components/logo";
import { IconButton } from "@/components/ds/icon-button";
import { useCommandPalette } from "@/components/command-palette";
import { useAuth } from "@/lib/auth-context";

/** Desktop header for light functional screens. No theme toggle (design system). */
export function AppHeader() {
  const { user, logout } = useAuth();
  const { open } = useCommandPalette();

  return (
    <header className="sticky top-0 z-40 border-b border-border-gray bg-off-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-5 lg:max-w-7xl">
        <Logo href="/dashboard" />
        <div className="flex items-center gap-3">
          <button
            onClick={open}
            className="hidden h-10 items-center gap-2 rounded-pill bg-white px-4 text-caption text-muted-gray shadow-card sm:flex"
          >
            <Search className="h-4 w-4" strokeWidth={1.7} />
            Search
            <kbd className="ml-1 rounded-pill bg-light-gray px-2 py-0.5 text-caption text-muted-gray">
              Ctrl K
            </kbd>
          </button>
          <IconButton aria-label="Search" variant="white" className="sm:hidden" onClick={open}>
            <Search className="h-5 w-5" strokeWidth={1.7} />
          </IconButton>
          <div className="hidden items-center gap-2 sm:flex">
            <span className="max-w-[140px] truncate text-caption text-body-gray">
              {user?.name}
            </span>
            <IconButton aria-label="Log out" variant="light" onClick={logout}>
              <LogOut className="h-4 w-4" strokeWidth={1.7} />
            </IconButton>
          </div>
          <Link
            href="/dashboard"
            className="hidden text-caption font-medium text-terracotta md:inline"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </header>
  );
}
