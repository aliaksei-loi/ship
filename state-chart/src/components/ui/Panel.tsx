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
        "flex min-h-0 flex-col rounded-lg border border-zinc-800/80 bg-zinc-950/40 backdrop-blur",
        className,
      )}
    >
      {title && (
        <header className="flex items-center justify-between border-b border-zinc-800/80 px-3 py-2">
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

export function Field({ label, value, mono = true }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-zinc-900/80 px-3 py-1.5 last:border-0">
      <span className="text-[11px] uppercase tracking-wider text-zinc-500">{label}</span>
      <span className={cn("text-xs text-zinc-200", mono && "font-mono")}>{value}</span>
    </div>
  );
}

export function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 px-3 py-2">
      <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-zinc-600">
        {title}
      </div>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}
