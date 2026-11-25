"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { create } from "zustand";
import { Button } from "./primitives";
import { cn } from "@/lib/utils";

/* ───────────────────────── Modal ───────────────────────── */

export function Modal({
  open,
  onClose,
  title,
  eyebrow,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const panel = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
      if (e.key === "Tab" && panel.current) {
        // Simple focus trap
        const f = panel.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const t = setTimeout(() => {
      const target = panel.current?.querySelector<HTMLElement>("[data-autofocus], input, textarea, select");
      (target ?? panel.current)?.focus();
    }, 20);
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prevFocus?.focus?.();
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;
  const width = size === "sm" ? "max-w-md" : size === "lg" ? "max-w-3xl" : "max-w-xl";
  return createPortal(
    <div className="overlay-in fixed inset-0 z-50 flex items-end justify-center bg-[#18242b]/25 p-0 backdrop-blur-sm sm:items-start sm:p-6 sm:pt-[8vh]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={panel} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} className={cn("pop-in flex max-h-[92vh] w-full flex-col rounded-t-3xl border border-line/70 bg-surface shadow-lift sm:rounded-3xl", width)}>
        <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-5">
          <div>
            {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
            <h2 className="font-serif text-2xl leading-tight text-ink">{title}</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X />
          </Button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-line/70 px-6 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/* ───────────────────────── Confirm ───────────────────────── */

interface ConfirmOptions {
  title: string;
  body?: string;
  confirmLabel?: string;
  destructive?: boolean;
}
type ConfirmFn = (o: ConfirmOptions) => Promise<boolean>;
const ConfirmCtx = createContext<ConfirmFn>(async () => false);
export const useConfirm = () => useContext(ConfirmCtx);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const confirm = useCallback<ConfirmFn>((o) => new Promise((resolve) => setState({ ...o, resolve })), []);
  const close = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Modal
        open={!!state}
        onClose={() => close(false)}
        title={state?.title ?? ""}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button variant={state?.destructive ? "danger" : "primary"} onClick={() => close(true)} data-autofocus>
              {state?.confirmLabel ?? "Confirm"}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-muted">{state?.body ?? "Are you sure?"}</p>
      </Modal>
    </ConfirmCtx.Provider>
  );
}

/* ───────────────────────── Toasts ───────────────────────── */

type ToastKind = "success" | "error" | "info";
interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
  action?: { label: string; run: () => void };
}
const useToasts = create<{ items: ToastItem[]; push(t: Omit<ToastItem, "id">): void; dismiss(id: number): void }>()((set) => ({
  items: [],
  push: (t) => {
    const id = Date.now() + Math.random();
    set((s) => ({ items: [...s.items.slice(-3), { ...t, id }] }));
    setTimeout(() => set((s) => ({ items: s.items.filter((i) => i.id !== id) })), t.action ? 6000 : 3500);
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
}));

export const toast = {
  success: (message: string, action?: ToastItem["action"]) => useToasts.getState().push({ kind: "success", message, action }),
  error: (message: string) => useToasts.getState().push({ kind: "error", message }),
  info: (message: string) => useToasts.getState().push({ kind: "info", message }),
};

export function Toaster() {
  const { items, dismiss } = useToasts();
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
      {items.map((t) => {
        const Icon = t.kind === "success" ? CheckCircle2 : t.kind === "error" ? AlertTriangle : Info;
        return (
          <div key={t.id} className="pop-in pointer-events-auto flex items-center gap-3 rounded-2xl border border-line/70 bg-surface px-4 py-3 text-sm text-ink shadow-lift">
            <Icon className={cn("size-4 shrink-0", t.kind === "error" ? "text-terra" : "text-accent")} />
            <span className="flex-1">{t.message}</span>
            {t.action && (
              <button
                className="text-xs font-semibold underline underline-offset-2"
                onClick={() => {
                  t.action!.run();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
