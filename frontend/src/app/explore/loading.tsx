import { NFTCardSkeleton } from "@/components/ui";

export default function ExploreLoading() {
  return (
    <main className="min-h-screen bg-background text-on-surface">
      <div className="pt-24 min-h-screen flex max-w-[1920px] mx-auto">
        {/* Sidebar skeleton */}
        <aside className="w-72 fixed h-[calc(100vh-6rem)] px-8 hidden xl:block top-24">
          <div className="space-y-6 pt-8">
            <div className="flex items-center justify-between">
              <div className="h-3 w-20 rounded-sm animate-pulse bg-surface-container-high" />
              <div className="h-3 w-16 rounded-sm animate-pulse bg-surface-container-high" />
            </div>
            {/* Collection filter pills */}
            <div className="space-y-2">
              <div className="h-3 w-24 rounded-sm animate-pulse bg-surface-container-high" />
              <div className="flex flex-wrap gap-2 pt-1">
                {[80, 100, 70, 90].map((w, i) => (
                  <div
                    key={i}
                    className={`h-8 rounded-full animate-pulse bg-surface-container-high`}
                    style={{ width: `${w}px` }}
                  />
                ))}
              </div>
            </div>
            {/* Sort filter */}
            <div className="space-y-2">
              <div className="h-3 w-16 rounded-sm animate-pulse bg-surface-container-high" />
              <div className="space-y-1">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className="h-8 rounded-sm animate-pulse bg-surface-container-high"
                  />
                ))}
              </div>
            </div>
            {/* Toggles */}
            <div className="space-y-3 pt-2">
              {[1, 2].map((i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="h-3 w-24 rounded-sm animate-pulse bg-surface-container-high" />
                  <div className="h-5 w-9 rounded-full animate-pulse bg-surface-container-high" />
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Main content */}
        <section className="flex-1 px-8 xl:ml-72 pb-20">
          {/* Header */}
          <div className="pt-8 pb-6 flex items-center justify-between">
            <div className="h-8 w-48 rounded-sm animate-pulse bg-surface-container-high" />
            <div className="h-8 w-32 rounded-sm animate-pulse bg-surface-container-high" />
          </div>

          {/* Search bar */}
          <div className="mb-6 h-10 rounded-sm animate-pulse bg-surface-container-high w-full max-w-sm" />

          {/* NFT grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="bg-surface-container-low rounded-sm overflow-hidden border border-outline-variant/5"
              >
                <NFTCardSkeleton />
                <div className="p-4 space-y-2">
                  <div className="h-3 w-1/2 rounded-sm animate-pulse bg-surface-container-high" />
                  <div className="h-4 w-3/4 rounded-sm animate-pulse bg-surface-container-high" />
                  <div className="h-3 w-1/3 rounded-sm animate-pulse bg-surface-container-high" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
