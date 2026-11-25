"use client";

import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/* ───────── Button ───────── */
type Variant = "primary" | "secondary" | "ghost" | "danger" | "accent";
type Size = "sm" | "md" | "icon";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-bg hover:bg-ink-2 border border-ink",
  accent: "bg-accent text-on-accent hover:opacity-90 border border-accent",
  secondary: "bg-surface text-ink border border-line-strong hover:border-ink/40 hover:bg-surface-2",
  ghost: "text-muted hover:text-ink hover:bg-surface-2 border border-transparent",
  danger: "bg-terra text-[#faf9f6] border border-terra hover:opacity-90",
};
const sizes: Record<Size, string> = {
  sm: "h-7 px-2.5 text-xs gap-1.5",
  md: "h-9 px-3.5 text-sm gap-2",
  icon: "h-8 w-8 justify-center",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", className, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex shrink-0 items-center rounded-[3px] font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-4",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
});

/* ───────── Form controls ───────── */
const control =
  "w-full rounded-[3px] border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-faint transition-colors focus:border-ink/60 focus:outline-none focus-visible:outline-none aria-[invalid=true]:border-terra";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} className={cn(control, "h-9", className)} {...p} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...p }, ref) {
  return <textarea ref={ref} className={cn(control, "min-h-20 py-2 leading-relaxed", className)} {...p} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...p }, ref) {
  return (
    <select ref={ref} className={cn(control, "h-9 appearance-none bg-[length:10px] bg-[right_0.75rem_center] bg-no-repeat pr-8", className)} style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%238c9393' stroke-width='1.4'/%3E%3C/svg%3E")` }} {...p}>
      {children}
    </select>
  );
});

export function Field({ label, error, hint, children, className, htmlFor }: { label: string; error?: string; hint?: string; children: ReactNode; className?: string; htmlFor?: string }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-xs font-medium text-muted">
        {label}
      </label>
      {children}
      {error ? <p className="text-xs text-terra">{error}</p> : hint ? <p className="text-xs text-faint">{hint}</p> : null}
    </div>
  );
}

export function Checkbox({ checked, onChange, label, className, size = "md" }: { checked: boolean; onChange: (v: boolean) => void; label: string; className?: string; size?: "sm" | "md" }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={cn(
        "grid shrink-0 place-items-center rounded-[3px] border transition-colors",
        size === "sm" ? "size-3.5" : "size-[18px]",
        checked ? "border-accent bg-accent text-on-accent" : "border-line-strong bg-surface hover:border-ink/50",
        className,
      )}
    >
      {checked && <Check className={size === "sm" ? "size-2.5" : "size-3"} strokeWidth={3} />}
    </button>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn("relative h-5 w-9 shrink-0 rounded-full border transition-colors", checked ? "border-accent bg-accent" : "border-line-strong bg-surface-2")}
    >
      <span className={cn("absolute top-0.5 size-3.5 rounded-full bg-surface shadow-sm transition-transform", checked ? "translate-x-[18px]" : "translate-x-0.5")} />
    </button>
  );
}

/* ───────── Surfaces ───────── */
export function Card({ children, className, ...p }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-[4px] border border-line bg-surface", className)} {...p}>
      {children}
    </div>
  );
}

export function CardHeader({ title, eyebrow, action, className }: { title: ReactNode; eyebrow?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-3 border-b border-line px-5 py-3.5", className)}>
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-0.5">{eyebrow}</div>}
        <h2 className="truncate text-sm font-semibold tracking-tight text-ink">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "sage" | "terra" | "ochre" | "ink" | "outline"; className?: string }) {
  const tones = {
    neutral: "bg-surface-2 text-muted",
    sage: "bg-sage-soft text-accent-ink",
    terra: "bg-terra-soft text-terra",
    ochre: "bg-ochre-soft text-ochre",
    ink: "bg-ink text-bg",
    outline: "border border-line-strong text-muted",
  } as const;
  return <span className={cn("inline-flex h-5 items-center gap-1 whitespace-nowrap rounded-[3px] px-1.5 text-[11px] font-medium", tones[tone], className)}>{children}</span>;
}

export function DemoBadge() {
  return (
    <span title="Demonstration data — edit or remove it any time (Settings → Data)" className="num inline-flex h-4 items-center rounded-[2px] border border-dashed border-line-strong px-1 text-[9px] uppercase tracking-wider text-faint">
      demo
    </span>
  );
}

export function Progress({ value, className, tone = "accent" }: { value: number; className?: string; tone?: "accent" | "ink" | "terra" }) {
  const c = tone === "ink" ? "bg-ink" : tone === "terra" ? "bg-terra" : "bg-accent";
  return (
    <div className={cn("h-1 w-full overflow-hidden rounded-full bg-line", className)} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full rounded-full transition-[width] duration-300", c)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function EmptyState({ icon, title, body, action, className }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 px-6 py-10 text-center", className)}>
      {icon && <div className="mb-1 text-faint [&_svg]:size-6">{icon}</div>}
      <p className="text-sm font-medium text-ink">{title}</p>
      {body && <p className="max-w-xs text-xs leading-relaxed text-muted">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options, className, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; className?: string; label: string }) {
  return (
    <div role="tablist" aria-label={label} className={cn("inline-flex rounded-[3px] border border-line-strong bg-surface p-0.5", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn("h-7 rounded-[2px] px-3 text-xs font-medium transition-colors", value === o.value ? "bg-ink text-bg" : "text-muted hover:text-ink")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: T) => void; tabs: { value: T; label: string; count?: number }[] }) {
  return (
    <div role="tablist" className="flex gap-6 overflow-x-auto border-b border-line">
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          type="button"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={cn(
            "-mb-px flex shrink-0 items-center gap-1.5 border-b-2 pb-2.5 text-sm transition-colors",
            value === t.value ? "border-ink font-medium text-ink" : "border-transparent text-muted hover:text-ink",
          )}
        >
          {t.label}
          {t.count !== undefined && <span className="num text-[11px] text-faint">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Stat({ label, value, sub, className }: { label: string; value: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="eyebrow">{label}</span>
      <span className="num text-2xl font-normal leading-none text-ink">{value}</span>
      {sub && <span className="text-xs text-muted">{sub}</span>}
    </div>
  );
}

export function PageHeader({ index, title, subtitle, actions }: { index: string; title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-col gap-4 border-b border-line pb-6 md:flex-row md:items-end md:justify-between">
      <div>
        <div className="eyebrow mb-2">{index}</div>
        <h1 className="font-serif text-4xl leading-none tracking-tight text-ink md:text-5xl">{title}</h1>
        {subtitle && <div className="mt-3 text-sm text-muted">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <span className={cn("inline-block size-4 animate-spin rounded-full border-2 border-line-strong border-t-ink", className)} aria-label="Loading" />;
}

export function ToneDot({ color, className }: { color: string; className?: string }) {
  return <span className={cn("inline-block size-2 shrink-0 rounded-full", className)} style={{ background: color }} />;
}
