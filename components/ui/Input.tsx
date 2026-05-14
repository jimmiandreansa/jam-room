import type { InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

export function Input({ label, id, className = "", ...rest }: InputProps) {
  const inputId = id ?? rest.name;
  return (
    <label className="flex w-full flex-col gap-1.5 text-left text-sm text-jam-muted">
      <span className="font-medium text-jam-text">{label}</span>
      <input
        id={inputId}
        className={`w-full rounded-xl border border-white/10 bg-jam-surface px-4 py-2.5 text-white placeholder:text-white/30 outline-none ring-0 transition focus:border-jam-accent focus:ring-1 focus:ring-jam-accent ${className}`}
        {...rest}
      />
    </label>
  );
}
