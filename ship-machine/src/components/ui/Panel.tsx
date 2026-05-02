import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Panel({
  title,
  children,
  className,
  action,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <section
      className={cn(
        "flex min-h-0 flex-col rounded-lg border border-zinc-200/80 bg-white/60 backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-950/40",
        className,
      )}
    >
      {title && (
        <header className="flex items-center justify-between border-b border-zinc-200/80 px-3 py-2 dark:border-zinc-800/80">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
            {title}
          </h2>
          {action}
        </header>
      )}
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </section>
  );
}

export function Field({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-zinc-200/60 px-3 py-1.5 last:border-0 dark:border-zinc-900/80">
      <span className="text-[11px] uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <span className="font-mono text-xs text-zinc-700 dark:text-zinc-200">{value}</span>
    </div>
  );
}
