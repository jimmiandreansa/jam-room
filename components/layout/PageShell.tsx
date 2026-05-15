import type { ReactNode } from "react";

type PageShellProps = {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  /** Wider content column (e.g. jam room two-pane layout on desktop). */
  wide?: boolean;
  /** Tighter horizontal padding (e.g. jam room). */
  densePadding?: boolean;
};

/** Centered dark layout shell used across pages. */
export function PageShell({
  children,
  title,
  subtitle,
  wide,
  densePadding,
}: PageShellProps) {
  const padX = densePadding ? "px-2.5 sm:px-3" : "px-4 sm:px-6";
  const padY = densePadding ? "py-6 sm:py-8" : "py-8 sm:py-10";

  return (
    <div className="min-h-screen bg-jam-bg text-jam-text">
      <div
        className={`mx-auto flex min-h-screen w-full flex-col ${padX} ${padY} ${
          wide ? "max-w-6xl" : "max-w-3xl"
        }`}
      >
        {(title || subtitle) && (
          <header className="mb-6 text-center sm:mb-8">
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
