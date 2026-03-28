/**
 * Client-facing copy for failed calls to third-party APIs (never echo upstream bodies).
 */
export const CLIENT_UPSTREAM_FAILED = "Request failed.";

const BODY_PREVIEW_MAX = 800;

/** Read response text for logging only (consumes body). */
export async function peekErrorBody(res: Response): Promise<string> {
  const t = await res.text();
  if (t.length <= BODY_PREVIEW_MAX) return t;
  return `${t.slice(0, BODY_PREVIEW_MAX)}…`;
}
