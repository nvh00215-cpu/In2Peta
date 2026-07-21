"use client";

import { Suspense } from "react";
import { CommandPaletteProvider } from "@/components/command-palette";
import { AppHeader } from "@/components/app-header";
import { BottomTabBar } from "@/components/ds/bottom-tab-bar";
import { UploadProvider } from "@/lib/upload-context";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <CommandPaletteProvider>
      <UploadProvider>
        <div className="flex min-h-screen flex-col bg-off-white">
          <AppHeader />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-4 sm:px-5 md:pb-8 md:pt-5 lg:max-w-7xl">
            <Suspense fallback={null}>{children}</Suspense>
          </main>
          <BottomTabBar />
        </div>
      </UploadProvider>
    </CommandPaletteProvider>
  );
}
