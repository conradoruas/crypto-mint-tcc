import Image from "next/image";
import Link from "next/link";
import { Image as ImageIcon } from "lucide-react";
import type { CollectionNFTItem } from "@/types/nft";

export function CollectionNFTCard({
  nft,
  collectionName,
}: {
  nft: CollectionNFTItem;
  collectionName: string;
}) {
  return (
    <Link
      href={`/asset/${nft.tokenId}?contract=${nft.nftContract}`}
      className="group bg-surface-container-low border border-outline-variant/20 hover:border-primary/40 overflow-hidden transition-all duration-300"
    >
      <div className="aspect-square relative bg-surface-container-high">
        {nft.image ? (
          <Image
            src={nft.image}
            alt={nft.name || "NFT Image"}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon size={28} className="text-on-surface-variant/30" />
          </div>
        )}
      </div>
      <div className="p-5">
        <p className="text-secondary text-[10px] font-bold uppercase tracking-[0.2em] mb-1 truncate">
          {collectionName}
        </p>
        <h3 className="font-headline font-bold text-lg truncate text-on-surface group-hover:text-primary transition-colors">
          {nft.name}
        </h3>
        <p className="text-on-surface-variant text-xs mt-1">
          #{nft.tokenId.padStart(3, "0")}
        </p>
        {nft.attributes && nft.attributes.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {nft.attributes.slice(0, 3).map((attr) => (
              <span
                key={attr.trait_type}
                className="px-1.5 py-0.5 rounded-sm bg-primary/5 border border-primary/10 text-[9px] font-bold text-primary/70 uppercase tracking-widest truncate max-w-[90px]"
                title={`${attr.trait_type}: ${String(attr.value)}`}
              >
                {String(attr.value)}
              </span>
            ))}
            {nft.attributes.length > 3 && (
              <span className="px-1.5 py-0.5 rounded-sm bg-surface-container border border-outline-variant/10 text-[9px] text-on-surface-variant/60 uppercase tracking-widest">
                +{nft.attributes.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
