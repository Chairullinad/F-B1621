import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 dark:focus-visible:ring-sky-400 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-zinc-900 text-zinc-50 shadow-sm hover:bg-zinc-800 dark:bg-sky-600 dark:text-white dark:hover:bg-sky-500",
        destructive: "bg-red-600 text-white shadow-sm hover:bg-red-700",
        outline:
          "border border-zinc-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-zinc-900 dark:text-slate-100 shadow-xs hover:bg-zinc-100 dark:hover:bg-slate-800",
        secondary:
          "bg-zinc-100 dark:bg-slate-800 text-zinc-900 dark:text-slate-100 hover:bg-zinc-200 dark:hover:bg-slate-700",
        ghost:
          "hover:bg-zinc-100 dark:hover:bg-slate-800 text-zinc-900 dark:text-slate-100",
        link: "text-zinc-900 dark:text-sky-400 underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-11 px-4 py-2.5",
        sm: "min-h-11 rounded-md px-3 text-xs",
        lg: "min-h-12 rounded-lg px-6 text-base",
        icon: "min-h-11 min-w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { buttonVariants };

