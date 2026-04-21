"use client";

export function createObjectUrl(file: File | null | undefined) {
  return file ? URL.createObjectURL(file) : "";
}

export function revokeObjectUrl(url: string | null | undefined) {
  if (url) {
    URL.revokeObjectURL(url);
  }
}

export function revokeRemovedObjectUrls(
  previousUrls: Iterable<string>,
  nextUrls: Iterable<string>,
) {
  const nextSet = new Set(Array.from(nextUrls).filter(Boolean));

  for (const url of previousUrls) {
    if (url && !nextSet.has(url)) {
      URL.revokeObjectURL(url);
    }
  }
}
