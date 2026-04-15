import React from "react";
import {
  ShoppingCart,
  Tag,
  X,
  HandCoins,
  CheckCircle,
  Sparkles,
  Pencil,
  ArrowLeftRight,
  Undo2,
} from "lucide-react";
import type { ActivityType } from "@/types/marketplace";

export interface EventConfigEntry {
  label: string;
  icon: React.ReactNode;
  colorClass: string;
}

/**
 * Returns the label / icon / colorClass for each ActivityType.
 * Pass the desired icon size so each context (NavBar=12, profile=14,
 * activity=16) can control its own rendering without duplicating the map.
 */
export function getEventConfig(
  iconSize: number,
): Record<ActivityType, EventConfigEntry> {
  return {
    sale: {
      label: "Sale",
      icon: <ShoppingCart size={iconSize} />,
      colorClass: "text-primary",
    },
    listing: {
      label: "Listing",
      icon: <Tag size={iconSize} />,
      colorClass: "text-secondary",
    },
    listing_cancelled: {
      label: "Delisted",
      icon: <X size={iconSize} />,
      colorClass: "text-on-surface-variant",
    },
    offer: {
      label: "Offer",
      icon: <HandCoins size={iconSize} />,
      colorClass: "text-tertiary",
    },
    offer_accepted: {
      label: "Offer Accepted",
      icon: <CheckCircle size={iconSize} />,
      colorClass: "text-primary",
    },
    offer_cancelled: {
      label: "Offer Cancelled",
      icon: <X size={iconSize} />,
      colorClass: "text-error",
    },
    offer_expired_refund: {
      label: "Offer Refund",
      icon: <Undo2 size={iconSize} />,
      colorClass: "text-on-surface-variant",
    },
    listing_updated: {
      label: "Listing Updated",
      icon: <Pencil size={iconSize} />,
      colorClass: "text-secondary",
    },
    transfer: {
      label: "Transfer",
      icon: <ArrowLeftRight size={iconSize} />,
      colorClass: "text-on-surface-variant",
    },
    mint: {
      label: "Minted",
      icon: <Sparkles size={iconSize} />,
      colorClass: "text-tertiary",
    },
  };
}

/** All activity types in definition order — useful for filter UIs. */
export const ALL_ACTIVITY_TYPES = Object.keys(
  getEventConfig(0),
) as ActivityType[];
