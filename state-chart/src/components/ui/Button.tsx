"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "secondary" | "ghost" | "outline" | "danger" | "accent";
type Size = "sm" | "md";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

const base =
  "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400";

const variants: Record<Variant, string> = {
  default: "bg-zinc-100 text-zinc-900 hover:bg-white",
  secondary: "bg-zinc-800 text-zinc-100 hover:bg-zinc-700 border border-zinc-700",
  ghost: "bg-transparent text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100",
  outline: "bg-transparent text-zinc-300 border border-zinc-700 hover:bg-zinc-900",
  danger: "bg-red-950/40 text-red-300 border border-red-900/60 hover:bg-red-950/70",
  accent:
    "bg-gradient-to-b from-amber-500 to-amber-600 text-zinc-900 hover:from-amber-400 hover:to-amber-500 shadow-[0_0_20px_-4px_rgba(245,158,11,0.6)]",
};

const sizes: Record<Size, string> = {
  sm: "h-7 px-2.5 text-xs",
  md: "h-9 px-3.5 text-sm",
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { className, variant = "secondary", size = "md", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(base, variants[variant], sizes[size], className)}
      {...rest}
    />
  );
});
