"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, LogOut, Search, Upload } from "lucide-react";
import { useCommandPalette } from "@/components/command-palette";
import { useAuth } from "@/lib/auth-context";
import { useUpload } from "@/lib/upload-context";
import { cn } from "@/lib/utils";

/**
 * componentLibrary.navigation.bottomTabBar — mobile only.
 * Upload opens the shared file picker from this click (user gesture).
 */
export function BottomTabBar() {
  const pathname = usePathname();
  const { open } = useCommandPalette();
  const { logout } = useAuth();
  const { openPicker, phase } = useUpload();

  const isHome = pathname === "/dashboard" || pathname.startsWith("/dashboard?");

  const itemClass = (active: boolean) =>
    cn(
      "flex h-11 w-11 items-center justify-center rounded-pill transition-colors",
      active ? "bg-terracotta text-white" : "text-muted-gray hover:text-heading"
    );

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border-gray bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
      <div className="flex h-16 items-center justify-around px-4">
        <Link href="/dashboard" aria-label="Home" className={itemClass(isHome)}>
          <House className="h-5 w-5" strokeWidth={1.7} />
        </Link>
        <button
          type="button"
          aria-label="Search"
          className={itemClass(false)}
          onClick={open}
        >
          <Search className="h-5 w-5" strokeWidth={1.7} />
        </button>
        <button
          type="button"
          aria-label="Upload a PDF"
          className={itemClass(phase === "uploading")}
          disabled={phase === "uploading"}
          onClick={() => openPicker()}
        >
          <Upload className="h-5 w-5" strokeWidth={1.7} />
        </button>
        <button
          type="button"
          aria-label="Log out"
          className={itemClass(false)}
          onClick={logout}
        >
          <LogOut className="h-5 w-5" strokeWidth={1.7} />
        </button>
      </div>
    </nav>
  );
}
