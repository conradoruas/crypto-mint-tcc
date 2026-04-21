export function NFTCardSkeleton({ rounded = false }: { rounded?: boolean }) {
  return (
    <div
      className={`aspect-square animate-pulse bg-surface-container-high${rounded ? " rounded-sm" : ""}`}
    />
  );
}
