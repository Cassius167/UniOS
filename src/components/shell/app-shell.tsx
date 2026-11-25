"use client";

import { useEffect, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { useStore } from "@/lib/store";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { SearchPalette } from "./search";
import { ThemeSync } from "./theme";
import { ReminderService } from "./reminders";
import { ConfirmProvider, Toaster } from "@/components/ui/overlay";
import { FormHost } from "@/components/forms/form-host";
import { Button, Spinner } from "@/components/ui/primitives";

export function AppShell({ children }: { children: ReactNode }) {
  const status = useStore((s) => s.status);
  const error = useStore((s) => s.error);
  const hydrate = useStore((s) => s.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return (
    <ConfirmProvider>
      <ThemeSync />
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main id="main" className="mx-auto w-full max-w-[1320px] flex-1 px-4 pb-16 pt-8 md:px-8 lg:px-10">
            {status === "ready" ? (
              children
            ) : status === "error" ? (
              <div className="mx-auto mt-20 max-w-md rounded-[4px] border border-terra/40 bg-terra-soft p-6 text-sm">
                <div className="mb-2 flex items-center gap-2 font-medium text-terra">
                  <AlertTriangle className="size-4" /> Your data could not be loaded
                </div>
                <p className="text-ink-2">{error}</p>
                <Button className="mt-4" onClick={() => location.reload()}>
                  Reload
                </Button>
              </div>
            ) : (
              <div className="flex h-[60vh] items-center justify-center gap-3 text-sm text-muted">
                <Spinner /> Loading your workspace…
              </div>
            )}
          </main>
        </div>
      </div>
      {status === "ready" && (
        <>
          <SearchPalette />
          <FormHost />
          <ReminderService />
        </>
      )}
      {status === "ready" && error && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-[4px] border border-terra/50 bg-terra-soft px-4 py-2 text-xs text-terra">{error}</div>
      )}
      <Toaster />
    </ConfirmProvider>
  );
}
