"use client";

import { useReducer } from "react";
import type { CreateCollectionErrors } from "@/lib/schemas";
import type { NftAttribute, TraitSchema } from "@/types/traits";

export interface NFTDraft {
  id: number;
  name: string;
  description: string;
  file: File | null;
  previewUrl: string;
  attributes?: NftAttribute[];
}

export interface CollectionFormState {
  // Collection metadata
  coverFile: File | null;
  coverPreview: string;
  name: string;
  symbol: string;
  description: string;
  mintPrice: string;
  // Trait schema (optional — v2 factory only)
  traitSchema?: TraitSchema;
  // NFT drafts
  nfts: NFTDraft[];
  currentPage: number;
  // Upload / processing flags
  isUploadingCover: boolean;
  isUploadingNFTs: boolean;
  isBulkProcessing: boolean;
  uploadProgress: number;
  // Bulk import helpers
  bulkMetadataFile: File | null;
  bulkImageFiles: File[];
  bulkMetadataName: string;
  bulkImageNames: string[];
  // Error state
  error: string | null;
  bulkParsingError: string | null;
  fieldErrors: CreateCollectionErrors;
  // Hydration guard
  hasMounted: boolean;
}

export type CollectionFormAction =
  | { type: "SET_COVER"; file: File | null; preview: string }
  | { type: "SET_NAME"; value: string }
  | { type: "SET_SYMBOL"; value: string }
  | { type: "SET_DESCRIPTION"; value: string }
  | { type: "SET_MINT_PRICE"; value: string }
  | { type: "SET_TRAIT_SCHEMA"; schema: TraitSchema | undefined }
  | { type: "SET_NFTS"; nfts: NFTDraft[] }
  | { type: "ADD_NFT" }
  | { type: "REMOVE_NFT"; id: number }
  | { type: "UPDATE_NFT"; id: number; field: keyof Omit<NFTDraft, "previewUrl">; value: string | File | null }
  | { type: "SET_NFT_FILE"; id: number; file: File | null; previewUrl: string }
  | { type: "SET_NFT_ATTRIBUTES"; id: number; attributes: NftAttribute[] }
  | { type: "SET_PAGE"; page: number }
  | { type: "SET_UPLOADING_COVER"; value: boolean }
  | { type: "SET_UPLOADING_NFTS"; value: boolean }
  | { type: "SET_BULK_PROCESSING"; value: boolean }
  | { type: "SET_UPLOAD_PROGRESS"; value: number }
  | { type: "SET_BULK_METADATA_FILE"; file: File | null; name: string }
  | { type: "SET_BULK_IMAGE_FILES"; files: File[]; names: string[] }
  | { type: "SET_ERROR"; error: string | null }
  | { type: "SET_BULK_PARSING_ERROR"; error: string | null }
  | { type: "SET_FIELD_ERRORS"; errors: CreateCollectionErrors }
  | { type: "CLEAR_FIELD_ERROR"; field: keyof CreateCollectionErrors }
  | { type: "MOUNTED" };

export const initialFormState: CollectionFormState = {
  coverFile: null,
  coverPreview: "",
  name: "",
  symbol: "",
  description: "",
  mintPrice: "0.0001",
  traitSchema: undefined,
  nfts: [],
  currentPage: 1,
  isUploadingCover: false,
  isUploadingNFTs: false,
  isBulkProcessing: false,
  uploadProgress: 0,
  bulkMetadataFile: null,
  bulkImageFiles: [],
  bulkMetadataName: "",
  bulkImageNames: [],
  error: null,
  bulkParsingError: null,
  fieldErrors: {},
  hasMounted: false,
};

export function collectionFormReducer(
  state: CollectionFormState,
  action: CollectionFormAction,
): CollectionFormState {
  switch (action.type) {
    case "SET_COVER":
      return { ...state, coverFile: action.file, coverPreview: action.preview };
    case "SET_NAME":
      return { ...state, name: action.value };
    case "SET_SYMBOL":
      return { ...state, symbol: action.value };
    case "SET_DESCRIPTION":
      return { ...state, description: action.value };
    case "SET_MINT_PRICE":
      return { ...state, mintPrice: action.value };
    case "SET_TRAIT_SCHEMA":
      return { ...state, traitSchema: action.schema };
    case "SET_NFTS":
      return { ...state, nfts: action.nfts };
    case "ADD_NFT":
      return {
        ...state,
        nfts: [
          ...state.nfts,
          { id: Date.now(), name: "", description: "", file: null, previewUrl: "" },
        ],
      };
    case "REMOVE_NFT":
      return { ...state, nfts: state.nfts.filter((n) => n.id !== action.id) };
    case "UPDATE_NFT":
      return {
        ...state,
        nfts: state.nfts.map((n) => {
          if (n.id !== action.id) return n;
          return { ...n, [action.field]: action.value };
        }),
      };
    case "SET_NFT_FILE":
      return {
        ...state,
        nfts: state.nfts.map((n) =>
          n.id === action.id
            ? { ...n, file: action.file, previewUrl: action.previewUrl }
            : n,
        ),
      };
    case "SET_NFT_ATTRIBUTES":
      return {
        ...state,
        nfts: state.nfts.map((n) =>
          n.id === action.id ? { ...n, attributes: action.attributes } : n,
        ),
      };
    case "SET_PAGE":
      return { ...state, currentPage: action.page };
    case "SET_UPLOADING_COVER":
      return { ...state, isUploadingCover: action.value };
    case "SET_UPLOADING_NFTS":
      return { ...state, isUploadingNFTs: action.value };
    case "SET_BULK_PROCESSING":
      return { ...state, isBulkProcessing: action.value };
    case "SET_UPLOAD_PROGRESS":
      return { ...state, uploadProgress: action.value };
    case "SET_BULK_METADATA_FILE":
      return { ...state, bulkMetadataFile: action.file, bulkMetadataName: action.name };
    case "SET_BULK_IMAGE_FILES":
      return { ...state, bulkImageFiles: action.files, bulkImageNames: action.names };
    case "SET_ERROR":
      return { ...state, error: action.error };
    case "SET_BULK_PARSING_ERROR":
      return { ...state, bulkParsingError: action.error };
    case "SET_FIELD_ERRORS":
      return { ...state, fieldErrors: action.errors };
    case "CLEAR_FIELD_ERROR":
      return { ...state, fieldErrors: { ...state.fieldErrors, [action.field]: undefined } };
    case "MOUNTED":
      return { ...state, hasMounted: true };
    default:
      return state;
  }
}

export function useCollectionForm() {
  return useReducer(collectionFormReducer, initialFormState);
}
