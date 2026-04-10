import { describe, it, expect } from "vitest";
import {
  formatTransactionError,
  getTransactionErrorKind,
} from "@/lib/txErrors";

// ─── getTransactionErrorKind (user rejection detection) ──────────────────────

describe("getTransactionErrorKind", () => {
  it("detects MetaMask user rejection (code 4001)", () => {
    const err = { code: 4001, message: "User rejected the request" };
    expect(getTransactionErrorKind(err)).toBe("user_rejected");
  });

  it("detects 'User rejected' in message", () => {
    expect(getTransactionErrorKind(new Error("User rejected the request."))).toBe("user_rejected");
  });

  it("detects 'user rejected' (case insensitive)", () => {
    expect(getTransactionErrorKind(new Error("user rejected transaction"))).toBe("user_rejected");
  });

  it("detects 'User denied' in message", () => {
    expect(getTransactionErrorKind(new Error("User denied transaction signature"))).toBe(
      "user_rejected",
    );
  });

  it("classifies unrelated errors as other kinds", () => {
    const kind = getTransactionErrorKind(new Error("insufficient funds"));
    expect(kind).not.toBe("user_rejected");
  });

  it("returns a kind for null/undefined", () => {
    expect(typeof getTransactionErrorKind(null)).toBe("string");
    expect(typeof getTransactionErrorKind(undefined)).toBe("string");
  });
});

// ─── formatTransactionError ─────────────────────────────────────────────────

describe("formatTransactionError", () => {
  it("returns user rejection message for rejected tx", () => {
    const err = { code: 4001, message: "User rejected" };
    const result = formatTransactionError(err, "fallback");
    expect(result.toLowerCase()).toContain("you cancelled the transaction in your wallet.");
  });

  it("returns a friendly message for generic errors", () => {
    const result = formatTransactionError(new Error("Something broke"), "Fallback msg");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("handles nested error.cause chains", () => {
    const inner = new Error("insufficient funds for gas");
    const outer = new Error("contract call failed");
    (outer as { cause: Error }).cause = inner;
    const result = formatTransactionError(outer, "Fallback");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns fallback message for null/undefined", () => {
    const result = formatTransactionError(null, "Default fallback");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("handles viem-style ContractFunctionRevertedError format", () => {
    const err = {
      name: "ContractFunctionRevertedError",
      message: "execution reverted",
      data: { message: "NFT nao esta a venda" },
    };
    const result = formatTransactionError(err, "Fallback");
    expect(typeof result).toBe("string");
  });

  it("detects 'insufficient funds' errors", () => {
    const err = new Error("insufficient funds for intrinsic transaction cost");
    const result = formatTransactionError(err, "Fallback");
    expect(result.toLowerCase()).toContain("not enough eth for gas or this transaction.");
  });
});
