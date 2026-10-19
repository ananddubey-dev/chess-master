import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva("button", {
  variants: {
    variant: {
      default: "button-primary",
      outline: "button-secondary",
      ghost: "button-quiet",
      destructive: "button-danger",
    },
    size: {
      default: "",
      sm: "button-small",
    },
    fullWidth: {
      true: "button-wide",
      false: "",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
    fullWidth: false,
  },
});

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export function Button({
  className,
  variant,
  size,
  fullWidth,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size, fullWidth }), className)}
      {...props}
    />
  );
}
