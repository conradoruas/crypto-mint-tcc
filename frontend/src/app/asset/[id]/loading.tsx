import { NFTCardSkeleton } from "@/components/ui";

export default function AssetLoading() {
  return (
    <div className="pt-32 pb-20 max-w-[1400px] mx-auto px-8 grid grid-cols-1 md:grid-cols-2 gap-12">
      {/* Image */}
      <NFTCardSkeleton rounded />

      {/* Details */}
      <div className="flex flex-col gap-5 pt-4">
        {/* Collection + name */}
        <div className="h-3 w-1/4 rounded-sm animate-pulse bg-surface-container-high" />
        <div className="h-10 w-2/3 rounded-sm animate-pulse bg-surface-container-high" />

        {/* Owner / badge row */}
        <div className="flex items-center gap-3">
          <div className="h-7 w-32 rounded-sm animate-pulse bg-surface-container-high" />
          <div className="h-7 w-24 rounded-sm animate-pulse bg-surface-container-high" />
        </div>

        {/* Description */}
        <div className="space-y-2 pt-2">
          <div className="h-3 w-full rounded-sm animate-pulse bg-surface-container-high" />
          <div className="h-3 w-5/6 rounded-sm animate-pulse bg-surface-container-high" />
          <div className="h-3 w-4/6 rounded-sm animate-pulse bg-surface-container-high" />
        </div>

        {/* Price / action panel */}
        <div className="h-40 rounded-sm animate-pulse bg-surface-container-high mt-2" />

        {/* Offers table */}
        <div className="h-14 rounded-sm animate-pulse bg-surface-container-high" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-10 rounded-sm animate-pulse bg-surface-container-high"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
