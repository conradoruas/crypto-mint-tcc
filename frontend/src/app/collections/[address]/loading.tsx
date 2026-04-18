import { NFTCardSkeleton } from "@/components/ui";

export default function CollectionLoading() {
  return (
    <div className="bg-background min-h-screen text-on-surface">
      {/* Banner */}
      <div className="relative pt-16">
        <div className="h-48 md:h-64 animate-pulse bg-surface-container-low" />

        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row gap-6 -mt-12 relative z-10">
            {/* Avatar */}
            <div className="w-24 h-24 md:w-32 md:h-32 shrink-0 border-4 border-background animate-pulse bg-surface-container-high" />

            {/* Info */}
            <div className="flex-1 pt-2 md:pt-14 space-y-3">
              <div className="h-8 w-56 rounded-sm animate-pulse bg-surface-container-high" />
              <div className="h-4 w-full max-w-md rounded-sm animate-pulse bg-surface-container-high" />
              <div className="h-4 w-2/3 max-w-sm rounded-sm animate-pulse bg-surface-container-high" />
            </div>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="max-w-7xl mx-auto px-4 mt-8">
        <div className="flex gap-6 pb-6 border-b border-outline-variant/10">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-1">
              <div className="h-3 w-16 rounded-sm animate-pulse bg-surface-container-high" />
              <div className="h-5 w-10 rounded-sm animate-pulse bg-surface-container-high" />
            </div>
          ))}
        </div>
      </div>

      {/* Mint form skeleton */}
      <div className="max-w-7xl mx-auto px-4 mt-8 mb-10">
        <div className="bg-surface-container-low border border-outline-variant/10 p-8 space-y-4">
          <div className="h-4 w-32 rounded-sm animate-pulse bg-surface-container-high" />
          <div className="h-28 rounded-sm animate-pulse bg-surface-container-high" />
          <div className="h-10 rounded-sm animate-pulse bg-surface-container-high" />
        </div>
      </div>

      {/* NFT grid */}
      <div className="max-w-7xl mx-auto px-4 pb-16">
        <div className="h-6 w-40 rounded-sm animate-pulse bg-surface-container-high mb-6" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="bg-surface-container-low rounded-sm overflow-hidden border border-outline-variant/5"
            >
              <NFTCardSkeleton />
              <div className="p-4 space-y-2">
                <div className="h-4 w-3/4 rounded-sm animate-pulse bg-surface-container-high" />
                <div className="h-3 w-1/3 rounded-sm animate-pulse bg-surface-container-high" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
