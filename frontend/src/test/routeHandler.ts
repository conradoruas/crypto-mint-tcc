import { NextRequest } from "next/server";
import { privateKeyToAccount } from "viem/accounts";
import type { Hex, Address } from "viem";
import { buildUploadAuthMessage } from "@/lib/uploadAuthMessage";

// ── Request builder ───────────────────────────────────────────────────────────

interface AuthOptions {
  /** viem private key (hex). A deterministic test key is used if omitted. */
  privateKey?: Hex;
  address?: Address;
  /** Override the pathname in the auth message. Defaults to the request pathname. */
  pathname?: string;
  /** Override timestamp (seconds). Defaults to Math.floor(Date.now()/1000). */
  timestamp?: number;
}

interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  /** Serialised as JSON if an object is passed. */
  body?: BodyInit | object;
  formData?: FormData;
  cookies?: Record<string, string>;
  /** Sets x-forwarded-for header. */
  ip?: string;
  /** Sign a valid x-cryptomint-* auth triple. */
  auth?: AuthOptions;
}

const DEFAULT_TEST_PRIVATE_KEY: Hex =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

export async function buildNextRequest(
  url: string,
  options: RequestOptions = {},
): Promise<NextRequest> {
  const { method = "GET", headers: extraHeaders = {}, ip, auth } = options;

  const headers = new Headers(extraHeaders);

  if (ip) headers.set("x-forwarded-for", ip);

  // Build body
  let body: BodyInit | undefined;
  if (options.formData) {
    body = options.formData;
  } else if (options.body !== undefined) {
    if (typeof options.body === "object" && !(options.body instanceof Blob)) {
      body = JSON.stringify(options.body);
      if (!headers.has("content-type"))
        headers.set("content-type", "application/json");
    } else {
      body = options.body as BodyInit;
    }
    if (body && !headers.has("content-length")) {
      const len =
        typeof body === "string"
          ? new TextEncoder().encode(body).byteLength
          : undefined;
      if (len !== undefined) headers.set("content-length", String(len));
    }
  }

  // Build auth headers
  if (auth) {
    const pk = auth.privateKey ?? DEFAULT_TEST_PRIVATE_KEY;
    const account = privateKeyToAccount(pk);
    const address = auth.address ?? account.address;
    const timestamp = auth.timestamp ?? Math.floor(Date.now() / 1000);
    const fullUrl = url.startsWith("http") ? url : `http://localhost${url}`;
    const pathname = auth.pathname ?? new URL(fullUrl).pathname;
    const message = buildUploadAuthMessage(pathname, timestamp);
    const signature = await account.signMessage({ message });

    headers.set("x-cryptomint-address", address);
    headers.set("x-cryptomint-timestamp", String(timestamp));
    headers.set("x-cryptomint-signature", signature);
  }

  // Cookie header
  if (options.cookies) {
    const cookieStr = Object.entries(options.cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
    headers.set("cookie", cookieStr);
  }

  const fullUrl = url.startsWith("http") ? url : `http://localhost${url}`;

  return new NextRequest(fullUrl, {
    method,
    headers,
    body: body ?? null,
  });
}

// ── Response assertion helpers ────────────────────────────────────────────────

export async function readJson<T = unknown>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}

export async function readText(res: Response): Promise<string> {
  return res.text();
}

export function expectStatus(res: Response, status: number): void {
  if (res.status !== status) {
    throw new Error(
      `Expected response status ${status}, got ${res.status}`,
    );
  }
}
