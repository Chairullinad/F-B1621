import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-zinc-900 dark:bg-sky-600 text-zinc-50 dark:text-white",
        secondary:
          "border-transparent bg-zinc-100 dark:bg-slate-800 text-zinc-900 dark:text-slate-200",
        success:
          "border-transparent bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300",
        warning:
          "border-transparent bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300",
        destructive:
          "border-transparent bg-red-100 dark:bg-rose-950/70 text-red-800 dark:text-rose-300",
        outline:
          "border-zinc-300 dark:border-slate-700 text-zinc-800 dark:text-slate-200",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

