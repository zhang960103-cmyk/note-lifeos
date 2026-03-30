/**
 * 货币工具 - 根据用户选择的货币显示正确的符号和格式
 */

const CURRENCY_SYMBOLS: Record<string, string> = {
  CNY: "¥",
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  KRW: "₩",
  AED: "د.إ",
  RUB: "₽",
  BRL: "R$",
  INR: "₹",
};

export function getCurrencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] || currency;
}

export function formatMoney(amount: number, currency: string = "CNY"): string {
  const symbol = getCurrencySymbol(currency);
  const abs = Math.abs(amount);
  const formatted = Number.isInteger(abs) ? abs.toString() : abs.toFixed(2);
  return `${symbol}${formatted}`;
}

export function formatMoneyWithSign(amount: number, currency: string = "CNY"): string {
  const symbol = getCurrencySymbol(currency);
  const abs = Math.abs(amount);
  const formatted = Number.isInteger(abs) ? abs.toString() : abs.toFixed(2);
  const sign = amount >= 0 ? "+" : "-";
  return `${sign}${symbol}${formatted}`;
}
