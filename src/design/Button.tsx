import type { ButtonHTMLAttributes, ReactNode } from "react";
import "./globalStyles";

export type ButtonVariant = "primary" | "secondary" | "tertiary" | "destructive";
export type ButtonSize = "sm" | "md";

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "size"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  fullWidth?: boolean;
}

// The one button implementation used everywhere — popup, decision strip,
// library panel. Variants map directly to the design brief's hierarchy:
// primary (the one main action per screen), secondary (supporting actions),
// tertiary (text-only, menu rows), destructive (delete confirmations).
export function Button({
  variant = "secondary",
  size = "md",
  icon,
  fullWidth,
  className,
  children,
  ...rest
}: ButtonProps) {
  const classes = [
    "bh-btn",
    `bh-btn--${variant}`,
    `bh-btn--${size}`,
    fullWidth ? "bh-btn--full" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button className={classes} {...rest}>
      {icon && <span className="bh-btn__icon">{icon}</span>}
      {children}
    </button>
  );
}
