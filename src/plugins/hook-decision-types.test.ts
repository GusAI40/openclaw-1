import { describe, expect, it } from "vitest";
import {
  type HookDecision,
  type HookDecisionBlock,
  mergeHookDecisions,
  isHookDecision,
  HOOK_DECISION_SEVERITY,
  DEFAULT_BLOCK_MESSAGE,
  DEFAULT_BLOCK_MAX_RETRIES,
  resolveBlockMessage,
} from "./hook-decision-types.js";

describe("HookDecision types", () => {
  describe("isHookDecision", () => {
    it("recognizes pass", () => {
      expect(isHookDecision({ outcome: "pass" })).toBe(true);
    });

    it("recognizes ask", () => {
      expect(
        isHookDecision({
          outcome: "ask",
          reason: "check",
          title: "Review",
          description: "Continue?",
        }),
      ).toBe(true);
    });

    it("recognizes ask with minimal fields", () => {
      expect(isHookDecision({ outcome: "ask", reason: "check" })).toBe(true);
    });

    it("recognizes block", () => {
      expect(isHookDecision({ outcome: "block", reason: "test" })).toBe(true);
    });

    it("recognizes block with message", () => {
      expect(
        isHookDecision({
          outcome: "block",
          reason: "policy",
          message: "Please rephrase",
        }),
      ).toBe(true);
    });

    it("recognizes block with retry fields", () => {
      expect(
        isHookDecision({
          outcome: "block",
          reason: "policy",
          retry: true,
          maxRetries: 5,
        }),
      ).toBe(true);
    });

    it("does not recognize the removed `redact` outcome", () => {
      expect(isHookDecision({ outcome: "redact", reason: "r" })).toBe(false);
    });

    it("rejects null", () => {
      expect(isHookDecision(null)).toBe(false);
    });

    it("rejects undefined", () => {
      expect(isHookDecision(undefined)).toBe(false);
    });

    it("rejects strings", () => {
      expect(isHookDecision("pass")).toBe(false);
    });

    it("rejects objects without outcome", () => {
      expect(isHookDecision({ block: true })).toBe(false);
    });

    it("rejects objects with invalid outcome", () => {
      expect(isHookDecision({ outcome: "invalid" })).toBe(false);
    });
  });

  describe("HOOK_DECISION_SEVERITY", () => {
    it("pass is least restrictive", () => {
      expect(HOOK_DECISION_SEVERITY.pass).toBe(0);
    });

    it("ask has severity 1", () => {
      expect(HOOK_DECISION_SEVERITY.ask).toBe(1);
    });

    it("block has severity 2", () => {
      expect(HOOK_DECISION_SEVERITY.block).toBe(2);
    });

    it("severity order is pass < ask < block", () => {
      expect(HOOK_DECISION_SEVERITY.pass).toBeLessThan(HOOK_DECISION_SEVERITY.ask);
      expect(HOOK_DECISION_SEVERITY.ask).toBeLessThan(HOOK_DECISION_SEVERITY.block);
    });

    it("does not expose a `redact` severity entry", () => {
      // Type-level guarantee: HOOK_DECISION_SEVERITY is keyed on
      // HookDecision["outcome"], which no longer includes "redact".
      expect(Object.keys(HOOK_DECISION_SEVERITY).toSorted()).toEqual(["ask", "block", "pass"]);
    });
  });

  describe("mergeHookDecisions", () => {
    const askDecision: HookDecision = {
      outcome: "ask",
      reason: "needs approval",
      title: "Approval Required",
      description: "Continue with this action?",
    };

    it("returns b when a is undefined", () => {
      const b: HookDecision = { outcome: "pass" };
      expect(mergeHookDecisions(undefined, b)).toBe(b);
    });

    it("keeps pass when both are pass", () => {
      const a: HookDecision = { outcome: "pass" };
      const b: HookDecision = { outcome: "pass" };
      expect(mergeHookDecisions(a, b)).toBe(a);
    });

    it("escalates pass → ask", () => {
      const a: HookDecision = { outcome: "pass" };
      expect(mergeHookDecisions(a, askDecision)).toBe(askDecision);
    });

    it("ask beats pass", () => {
      const b: HookDecision = { outcome: "pass" };
      expect(mergeHookDecisions(askDecision, b)).toBe(askDecision);
    });

    it("block beats ask", () => {
      const b: HookDecision = { outcome: "block", reason: "test" };
      expect(mergeHookDecisions(askDecision, b)).toBe(b);
    });

    it("keeps first ask when severities match", () => {
      const a: HookDecision = askDecision;
      const b: HookDecision = {
        outcome: "ask",
        reason: "second approval",
        title: "Second Check",
        description: "Continue anyway?",
      };
      expect(mergeHookDecisions(a, b)).toBe(a);
    });

    it("ask does not downgrade to pass", () => {
      const b: HookDecision = { outcome: "pass" };
      expect(mergeHookDecisions(askDecision, b).outcome).toBe("ask");
    });

    it("escalates pass → block", () => {
      const a: HookDecision = { outcome: "pass" };
      const b: HookDecision = { outcome: "block", reason: "test" };
      expect(mergeHookDecisions(a, b)).toBe(b);
    });

    it("does not downgrade block → ask", () => {
      const a: HookDecision = { outcome: "block", reason: "b" };
      const b: HookDecision = askDecision;
      expect(mergeHookDecisions(a, b)).toBe(a);
    });

    it("does not downgrade block → pass", () => {
      const a: HookDecision = { outcome: "block", reason: "b" };
      const b: HookDecision = { outcome: "pass" };
      expect(mergeHookDecisions(a, b)).toBe(a);
    });

    it("keeps first block when both are block", () => {
      const a: HookDecision = { outcome: "block", reason: "first" };
      const b: HookDecision = { outcome: "block", reason: "second" };
      expect(mergeHookDecisions(a, b)).toBe(a);
    });
  });

  describe("resolveBlockMessage", () => {
    it("returns the explicit `message` when present", () => {
      const decision: HookDecisionBlock = {
        outcome: "block",
        reason: "policy",
        message: "Please rephrase your request.",
      };
      expect(resolveBlockMessage(decision)).toBe("Please rephrase your request.");
    });

    it("falls back to deprecated `userMessage` for backwards compatibility", () => {
      const decision: HookDecisionBlock = {
        outcome: "block",
        reason: "policy",
        userMessage: "Legacy text",
      };
      expect(resolveBlockMessage(decision)).toBe("Legacy text");
    });

    it("prefers `message` over the deprecated `userMessage`", () => {
      const decision: HookDecisionBlock = {
        outcome: "block",
        reason: "policy",
        message: "New text",
        userMessage: "Old text",
      };
      expect(resolveBlockMessage(decision)).toBe("New text");
    });

    it("falls back to the default message when neither is provided", () => {
      const decision: HookDecisionBlock = {
        outcome: "block",
        reason: "policy",
      };
      expect(resolveBlockMessage(decision)).toBe(DEFAULT_BLOCK_MESSAGE);
    });
  });

  describe("block decision retry semantics", () => {
    it("defaults retry to undefined (interpreted as false)", () => {
      const decision: HookDecisionBlock = { outcome: "block", reason: "policy" };
      expect(decision.retry).toBeUndefined();
    });

    it("supports `retry: true` and `maxRetries`", () => {
      const decision: HookDecisionBlock = {
        outcome: "block",
        reason: "policy",
        retry: true,
        maxRetries: 5,
      };
      expect(decision.retry).toBe(true);
      expect(decision.maxRetries).toBe(5);
    });

    it("DEFAULT_BLOCK_MAX_RETRIES is 3", () => {
      expect(DEFAULT_BLOCK_MAX_RETRIES).toBe(3);
    });
  });
});
