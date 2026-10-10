import { describe, expect, it } from "vitest";
import { formatMoney, formatMoneyWithSign, getCurrencySymbol } from "./currencyUtils";
import { extractTimeBlocks, hasTimeHints } from "./timeExtractor";
import { recognizeIntent } from "./intentEngine";

describe("currency formatting", () => {
  it.each([
    [12, "USD", "$12"], [-12.345, "CNY", "¥12.35"],
    [0, "EUR", "€0"], [4.5, "XYZ", "XYZ4.50"],
  ])("formats %s in %s", (amount, currency, expected) => {
    expect(formatMoney(amount, currency)).toBe(expected);
  });
  it("retains the sign only in signed formatting", () => {
    expect(formatMoneyWithSign(-2.5, "USD")).toBe("-$2.50");
    expect(formatMoneyWithSign(0)).toBe("+¥0");
    expect(getCurrencySymbol("AED")).toBe("د.إ");
  });
});

describe("time extraction", () => {
  it("calculates durations across an hour boundary", () => {
    expect(extractTimeBlocks("会议 09:45-11:15")).toEqual([
      expect.objectContaining({ startTime: "09:45", endTime: "11:15", durationMin: 90 }),
    ]);
  });
  it("does not invent a block for text without a time", () => {
    expect(extractTimeBlocks("今天读书")).toEqual([]);
    expect(hasTimeHints("今天读书")).toBe(false);
    expect(hasTimeHints("下午开会一小时")).toBe(true);
  });
});

describe("intent recognition", () => {
  it("extracts a decimal expense and its category", () => {
    expect(recognizeIntent("午餐花了35.50元")).toMatchObject({
      intent: "finance_expense", extracted: { amount: 35.5, category: "餐饮" },
    });
  });
  it("falls back to conversation for unclassified input", () => {
    expect(recognizeIntent("你好")).toMatchObject({ intent: "general", extracted: {} });
  });
});
