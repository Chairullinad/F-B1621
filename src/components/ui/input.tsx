import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex min-h-11 w-full rounded-xl border border-slate-200/90 bg-slate-50/70 hover:bg-slate-50 focus:bg-white px-3.5 py-2.5 text-sm font-medium text-slate-800 shadow-xs transition-all duration-150 placeholder:text-slate-400 focus-visible:outline-none focus-visible:border-[#0284C7] focus-visible:ring-4 focus-visible:ring-sky-500/10 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = "Input";

