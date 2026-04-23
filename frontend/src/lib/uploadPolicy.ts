export const ALLOWED_IMAGE_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export const IMAGE_ACCEPT_ATTR = ALLOWED_IMAGE_MIME.join(",");

export const MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_JSON_UPLOAD_BYTES = 256 * 1024;
export const MAX_BULK_METADATA_BYTES = 512 * 1024;
export const MAX_BULK_METADATA_ENTRIES = 500;

export function isAllowedImageMime(mime: string): boolean {
  return ALLOWED_IMAGE_MIME.includes(mime.toLowerCase() as (typeof ALLOWED_IMAGE_MIME)[number]);
}

export function validateImageFile(file: File): string | null {
  if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
    return "Image file too large. Max 10 MB.";
  }
  if (!isAllowedImageMime(file.type)) {
    return "Unsupported image type. Use JPEG, PNG, WebP, or GIF.";
  }
  return null;
}

export function validateJsonFile(file: File, maxBytes = MAX_JSON_UPLOAD_BYTES): string | null {
  const mime = file.type.toLowerCase();
  const allowedMime =
    mime === "" ||
    mime === "application/json" ||
    mime === "text/json" ||
    mime === "application/ld+json";

  if (!allowedMime) {
    return "Unsupported JSON file type.";
  }
  if (file.size > maxBytes) {
    return `JSON file too large. Max ${Math.floor(maxBytes / 1024)} KB.`;
  }
  return null;
}
