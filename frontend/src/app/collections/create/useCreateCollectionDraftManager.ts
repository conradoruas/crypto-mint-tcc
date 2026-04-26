"use client";

import { useCallback, useEffect, useMemo, useRef, type ChangeEvent } from "react";
import { createObjectUrl, revokeObjectUrl, revokeRemovedObjectUrls } from "@/lib/objectUrlRegistry";
import {
  MAX_BULK_METADATA_BYTES,
  MAX_BULK_METADATA_ENTRIES,
  validateImageFile,
  validateJsonFile,
} from "@/lib/uploadPolicy";
import type { NftAttribute, TraitSchema } from "@/types/traits";
import { useCollectionForm, type NFTDraft } from "./useCollectionForm";

interface BulkMetadataItem {
  name?: string;
  description?: string;
  image?: string;
  [key: string]: unknown;
}

const NFTS_PER_PAGE = 10;

export function useCreateCollectionDraftManager() {
  const [form, dispatch] = useCollectionForm();
  const previousCoverPreviewRef = useRef("");
  const previousNftPreviewsRef = useRef<string[]>([]);

  const { currentPage, nfts, bulkMetadataFile, bulkImageFiles } = form;

  useEffect(() => {
    dispatch({ type: "MOUNTED" });
  }, [dispatch]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(nfts.length / NFTS_PER_PAGE)),
    [nfts.length],
  );

  const pagedNFTs = useMemo(
    () =>
      nfts.slice(
        (currentPage - 1) * NFTS_PER_PAGE,
        currentPage * NFTS_PER_PAGE,
      ),
    [currentPage, nfts],
  );

  useEffect(() => {
    if (currentPage > totalPages) {
      dispatch({ type: "SET_PAGE", page: totalPages });
    }
  }, [currentPage, dispatch, totalPages]);

  useEffect(() => {
    const previousCoverPreview = previousCoverPreviewRef.current;
    if (
      previousCoverPreview &&
      previousCoverPreview !== form.coverPreview
    ) {
      revokeObjectUrl(previousCoverPreview);
    }
    previousCoverPreviewRef.current = form.coverPreview;
  }, [form.coverPreview]);

  useEffect(() => {
    const nextUrls = form.nfts.map((nft) => nft.previewUrl);
    revokeRemovedObjectUrls(previousNftPreviewsRef.current, nextUrls);
    previousNftPreviewsRef.current = nextUrls;
  }, [form.nfts]);

  useEffect(
    () => () => {
      revokeObjectUrl(previousCoverPreviewRef.current);
      revokeRemovedObjectUrls(previousNftPreviewsRef.current, []);
    },
    [],
  );

  const setCoverFile = useCallback(
    (file: File | null) => {
      if (file) {
        const validationError = validateImageFile(file);
        if (validationError) {
          dispatch({ type: "SET_ERROR", error: validationError });
          return;
        }
      }

      dispatch({ type: "SET_ERROR", error: null });
      dispatch({
        type: "SET_COVER",
        file,
        preview: createObjectUrl(file),
      });
    },
    [dispatch],
  );

  const addNFT = useCallback(() => dispatch({ type: "ADD_NFT" }), [dispatch]);

  const removeNFT = useCallback(
    (id: number) => dispatch({ type: "REMOVE_NFT", id }),
    [dispatch],
  );

  const updateNFTField = useCallback(
    (id: number, field: "name" | "description", value: string) =>
      dispatch({ type: "UPDATE_NFT", id, field, value }),
    [dispatch],
  );

  const setNFTFile = useCallback(
    (id: number, file: File | null) => {
      if (file) {
        const validationError = validateImageFile(file);
        if (validationError) {
          dispatch({ type: "SET_ERROR", error: validationError });
          return;
        }
      }

      dispatch({ type: "SET_ERROR", error: null });
      dispatch({
        type: "SET_NFT_FILE",
        id,
        file,
        previewUrl: createObjectUrl(file),
      });
    },
    [dispatch],
  );

  const handleBulkMetadataFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      if (file) {
        const validationError = validateJsonFile(file, MAX_BULK_METADATA_BYTES);
        if (validationError) {
          dispatch({ type: "SET_ERROR", error: validationError });
          dispatch({
            type: "SET_BULK_METADATA_FILE",
            file: null,
            name: "",
          });
          return;
        }
      }

      dispatch({ type: "SET_ERROR", error: null });
      dispatch({
        type: "SET_BULK_METADATA_FILE",
        file,
        name: file?.name ?? "",
      });
    },
    [dispatch],
  );

  const handleBulkImageFilesChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files ? Array.from(event.target.files) : [];
      const invalidFile = files.find((file) => validateImageFile(file));
      if (invalidFile) {
        dispatch({
          type: "SET_ERROR",
          error: validateImageFile(invalidFile),
        });
        dispatch({
          type: "SET_BULK_IMAGE_FILES",
          files: [],
          names: [],
        });
        return;
      }

      dispatch({ type: "SET_ERROR", error: null });
      dispatch({
        type: "SET_BULK_IMAGE_FILES",
        files,
        names: files.map((file) => file.name),
      });
    },
    [dispatch],
  );

  const parseBulkNFTs = useCallback(async () => {
    dispatch({ type: "SET_ERROR", error: null });
    dispatch({ type: "SET_BULK_PARSING_ERROR", error: null });

    if (!bulkMetadataFile) {
      dispatch({
        type: "SET_ERROR",
        error: "Please select a metadata JSON file.",
      });
      return;
    }

    if (bulkImageFiles.length === 0) {
      dispatch({
        type: "SET_ERROR",
        error: "Please select matching image files for bulk import.",
      });
      return;
    }

    dispatch({ type: "SET_BULK_PROCESSING", value: true });

    try {
      const text = await bulkMetadataFile.text();
      const json = JSON.parse(text);

      if (!Array.isArray(json)) {
        throw new Error("Bulk metadata must be an array of objects.");
      }
      if (json.length > MAX_BULK_METADATA_ENTRIES) {
        throw new Error(
          `Bulk metadata supports at most ${MAX_BULK_METADATA_ENTRIES} entries.`,
        );
      }

      const parsedNFTs = json.map((item: BulkMetadataItem, index: number) => {
        const nftName = String(item.name ?? "").trim();
        const nftDescription = String(item.description ?? "").trim();
        const imageName = String(item.image ?? "").trim();

        if (!nftName || !imageName) {
          throw new Error(
            `Entry ${index + 1} must contain 'name' and 'image' fields.`,
          );
        }

        const imageFile = bulkImageFiles.find(
          (file) =>
            file.name === imageName ||
            file.name === imageName.replace(/^.*[\\/]/, ""),
        );

        if (!imageFile) {
          throw new Error(
            `Image '${imageName}' for entry ${index + 1} not found in uploaded images.`,
          );
        }
        const fileError = validateImageFile(imageFile);
        if (fileError) {
          throw new Error(`Image '${imageFile.name}' is invalid: ${fileError}`);
        }

        return {
          id: Date.now() + index,
          name: nftName,
          description: nftDescription,
          file: imageFile,
          previewUrl: createObjectUrl(imageFile),
        } satisfies NFTDraft;
      });

      dispatch({ type: "SET_NFTS", nfts: parsedNFTs });
      dispatch({ type: "SET_ERROR", error: null });
    } catch (error) {
      dispatch({
        type: "SET_BULK_PARSING_ERROR",
        error:
          error instanceof Error
            ? error.message
            : "Failed to parse bulk metadata.",
      });
    } finally {
      dispatch({ type: "SET_BULK_PROCESSING", value: false });
    }
  }, [bulkImageFiles, bulkMetadataFile, dispatch]);

  const setTraitSchema = useCallback(
    (schema: TraitSchema | undefined) =>
      dispatch({ type: "SET_TRAIT_SCHEMA", schema }),
    [dispatch],
  );

  const setNFTAttributes = useCallback(
    (id: number, attributes: NftAttribute[]) =>
      dispatch({ type: "SET_NFT_ATTRIBUTES", id, attributes }),
    [dispatch],
  );

  return {
    form,
    dispatch,
    totalPages,
    pagedNFTs,
    addNFT,
    removeNFT,
    updateNFTField,
    setNFTFile,
    setCoverFile,
    setTraitSchema,
    setNFTAttributes,
    setPage: (page: number) => dispatch({ type: "SET_PAGE", page }),
    handleBulkMetadataFileChange,
    handleBulkImageFilesChange,
    parseBulkNFTs,
  };
}
