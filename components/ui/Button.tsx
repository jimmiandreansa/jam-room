import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: "primary" | "ghost";
};

export function Button({
  children,
  className = "",
  variant = "primary",
  disabled,
  ...rest
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
  const styles =
    variant === "primary"
      ? "bg-jam-accent text-black hover:bg-jam-accent-hover focus-visible:outline-jam-accent"
      : "border border-white/10 bg-white/5 text-white hover:bg-white/10 focus-visible:outline-white/40";

  return (
    <button
      type="button"
      className={`${base} ${styles} ${className}`}
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  );
}
