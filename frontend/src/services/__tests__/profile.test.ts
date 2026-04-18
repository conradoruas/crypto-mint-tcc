import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  uploadProfileImage,
  uploadProfileToIPFS,
  saveProfileHash,
  loadProfileHash,
  fetchProfile,
  clearProfile,
  type UserProfile,
} from "@/services/profile";

const testProfile: UserProfile = {
  address: "0xuser",
  name: "Alice",
  imageUri: "ipfs://QmImage",
  updatedAt: 1700000000,
};

const noopAuth = async () => ({
  "X-CryptoMint-Address": "0x123",
  "X-CryptoMint-Timestamp": "1700000000",
  "X-CryptoMint-Signature": "0xsig",
});

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── localStorage helpers ────────────────���─────────────────────────���───────────

describe("saveProfileHash / loadProfileHash", () => {
  it("round-trips through localStorage", () => {
    saveProfileHash("0xUser", "ipfs://QmHash");
    expect(loadProfileHash("0xUser")).toBe("ipfs://QmHash");
  });

  it("is case-insensitive on address", () => {
    saveProfileHash("0xUSER", "ipfs://QmHash");
    expect(loadProfileHash("0xuser")).toBe("ipfs://QmHash");
  });

  it("returns null when nothing stored", () => {
    expect(loadProfileHash("0xunknown")).toBeNull();
  });
});

describe("clearProfile", () => {
  it("removes the profile entry", () => {
    saveProfileHash("0xaddr", "ipfs://QmSomething");
    clearProfile("0xaddr");
    expect(loadProfileHash("0xaddr")).toBeNull();
  });
});

// ── uploadProfileImage ───────────────────────────────────���────────────────────

describe("uploadProfileImage", () => {
  it("returns the ipfs URI from the API response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ uri: "ipfs://QmImg" }), { status: 200 }),
    );
    const file = new File(["data"], "test.png", { type: "image/png" });
    const uri = await uploadProfileImage(file, noopAuth);
    expect(uri).toBe("ipfs://QmImg");
  });

  it("throws when response is not ok", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Unauthorized", { status: 401 }),
    );
    const file = new File(["data"], "test.png", { type: "image/png" });
    await expect(uploadProfileImage(file, noopAuth)).rejects.toThrow("401");
  });

  it("throws when uri is missing from response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    );
    const file = new File(["data"], "test.png", { type: "image/png" });
    await expect(uploadProfileImage(file, noopAuth)).rejects.toThrow();
  });
});

// ── uploadProfileToIPFS ───────────────────────────────────────────────────────

describe("uploadProfileToIPFS", () => {
  it("posts the profile and returns the ipfs URI", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ uri: "ipfs://QmProfile" }), { status: 200 }),
    );
    const uri = await uploadProfileToIPFS(testProfile, noopAuth);
    expect(uri).toBe("ipfs://QmProfile");
  });

  it("throws when response is not ok", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Error", { status: 500 }),
    );
    await expect(uploadProfileToIPFS(testProfile, noopAuth)).rejects.toThrow(
      "500",
    );
  });
});

// ── fetchProfile ───────────────────────────────���──────────────────────────────

describe("fetchProfile", () => {
  it("returns null when no hash is stored", async () => {
    expect(await fetchProfile("0xnobody")).toBeNull();
  });

  it("fetches and returns the profile from IPFS", async () => {
    saveProfileHash("0xalice", "ipfs://QmProfileHash");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(testProfile), { status: 200 }),
    );
    const profile = await fetchProfile("0xalice");
    expect(profile?.name).toBe("Alice");
  });

  it("returns null when fetch fails", async () => {
    saveProfileHash("0xalice", "ipfs://QmFail");
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network"));
    expect(await fetchProfile("0xalice")).toBeNull();
  });

  it("returns null when response is not ok", async () => {
    saveProfileHash("0xalice", "ipfs://QmNotFound");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Not Found", { status: 404 }),
    );
    expect(await fetchProfile("0xalice")).toBeNull();
  });
});
