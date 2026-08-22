import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { translations } from "./LanguageContext";

// BUG-03 回归测试：中文设置页曾经直接显示 settings.search_placeholder 这类原始翻译键。
// 根因是 t() 的三层回退（当前语言 → en → zh）在三层都查不到时，最后把 key 字符串本身
// 原样返回；组件里又常年用 `t("xxx") || "兜底文案"` 这种写法——而 t() 返回的 key 字符串
// 是非空 truthy 值，`||` 根本不会走到兜底文案，用户看到的就是裸的 "settings.xxx"。
//
// 这个测试做静态扫描：全仓找出所有 t("...") 调用引用的 key，断言它们在 zh 和 en 两个
// 唯一"全量维护"的语言字典里都存在——防止未来又出现"代码里新增了 t() 调用，但没人记得
// 去 LanguageContext.tsx 里补对应的 key"这种回归。
//
// 注：ar/ja/ko/fr/es/de/ru/pt 目前是有意保留的部分翻译（另一个已经跟用户对齐过范围的
// i18n 补齐任务），不在这个测试的断言范围内——这里只保证"裸 key 不会露出来"这个下限，
// 不保证十种语言互相对齐。

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.resolve(__dirname, "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(tsx?|jsx?)$/.test(entry.name) && !/\.test\.[tj]sx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

// 匹配 t("key") / t('key')，要求 key 看起来像我们的命名空间.键名 格式（含点号），
// 排除掉像 t("T") 这种单字母误匹配（模板字符串里偶尔会有变量也叫 t）。
const T_CALL_RE = /\bt\(\s*["']([a-zA-Z][a-zA-Z0-9_]*\.[a-zA-Z0-9_.]+)["']/g;

function collectUsedKeys(): Map<string, string[]> {
  const usedIn = new Map<string, string[]>();
  for (const file of walk(SRC_ROOT)) {
    const content = fs.readFileSync(file, "utf-8");
    let m: RegExpExecArray | null;
    T_CALL_RE.lastIndex = 0;
    while ((m = T_CALL_RE.exec(content))) {
      const key = m[1];
      const rel = path.relative(SRC_ROOT, file);
      if (!usedIn.has(key)) usedIn.set(key, []);
      const files = usedIn.get(key)!;
      if (!files.includes(rel)) files.push(rel);
    }
  }
  return usedIn;
}

describe("i18n key consistency (BUG-03)", () => {
  it("代码里引用的每一个 t(\"...\") key，在 zh 字典里都存在", () => {
    const used = collectUsedKeys();
    const missing: string[] = [];
    for (const [key, files] of used) {
      if (!(key in translations.zh)) missing.push(`${key}  (used in: ${files.join(", ")})`);
    }
    expect(missing, `以下 key 在代码里被调用，但 zh 字典里缺失，会在中文界面下显示原始 key 字符串：\n${missing.join("\n")}`).toEqual([]);
  });

  it("代码里引用的每一个 t(\"...\") key，在 en 字典里都存在", () => {
    const used = collectUsedKeys();
    const missing: string[] = [];
    for (const [key, files] of used) {
      if (!(key in translations.en)) missing.push(`${key}  (used in: ${files.join(", ")})`);
    }
    expect(missing, `以下 key 在代码里被调用，但 en 字典里缺失，会在英文界面下回退成中文或裸 key：\n${missing.join("\n")}`).toEqual([]);
  });

  it("扫描确实找到了 t() 调用（防止正则失效导致测试形同虚设）", () => {
    const used = collectUsedKeys();
    expect(used.size).toBeGreaterThan(20);
  });

  it("settings.* 命名空间下，BUG-03 报告里点名的几个 key 确实存在且非空", () => {
    for (const key of [
      "settings.search_placeholder",
      "settings.regional",
      "settings.export_json",
      "settings.export_csv",
    ]) {
      expect(translations.zh[key], `zh.${key}`).toBeTruthy();
      expect(translations.en[key], `en.${key}`).toBeTruthy();
    }
  });
});
