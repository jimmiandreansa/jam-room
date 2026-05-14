import { Suspense } from "react";
import { HomePageClient } from "@/components/home/HomePageClient";

function HomeLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-jam-bg text-sm text-jam-muted">
      Memuat…
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<HomeLoading />}>
      <HomePageClient />
    </Suspense>
  );
}
