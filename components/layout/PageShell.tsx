import type { ReactNode } from "react";

type PageShellProps = {
  children: ReactNode;
  title?: string;
  subtitle?: string;
};

/** Centered dark layout shell used across pages. */
export function PageShell({ children, title, subtitle }: PageShellProps) {
  return (
    <div className="min-h-screen bg-jam-bg text-jam-text">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-10 sm:px-6">
        {(title || subtitle) && (
          <header className="mb-8 text-center">
            {title && (
              <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                {title}
              </h1>
            )}
            {subtitle && (
              <p className="mt-2 text-sm text-jam-muted">{subtitle}</p>
            )}
          </header>
        )}
        <main className="flex flex-1 flex-col">{children}</main>
      </div>
    </div>
  );
}
