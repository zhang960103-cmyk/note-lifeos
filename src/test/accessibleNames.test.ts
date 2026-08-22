import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// BUG-07 回归测试：多个只有图标、没有可见文字的核心按钮（搜索/历史/设置/语音/
// 附件/日记模式/发送等）之前完全没有 aria-label，屏幕阅读器只能读出"按钮"。
//
// 这是一个静态扫描测试：在指定文件里找出"只包含一个图标组件、没有任何其它可见
// 文字子节点"的 <button ...>...</button>，断言这个 button 自己的开始标签属性里
// 一定带有 aria-label（title 不算数——title 不能可靠地被所有屏幕阅读器/浏览器
// 当作可访问名称，这正是 BUG-07 报告里点名的问题之一）。
//
// 注：不能用简单的 `[^>]*` 找开始标签的结束——按钮几乎都带
// `onClick={() => doSomething()}` 这种箭头函数，`=>` 里的 `>` 会被 `[^>]*` 提前
// 截断，导致属性和内容整个错位。这里手写一个简单的括号深度扫描器：只在
// `{...}` 花括号深度为 0 时遇到的第一个 `>` 才算开始标签真正结束。

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.resolve(__dirname, "..");

const FILES_TO_CHECK = [
  "pages/HomePage.tsx",
  "components/GlobalSearch.tsx",
];

interface ButtonMatch {
  line: number;
  attrs: string;
  inner: string;
}

function findButtons(content: string): ButtonMatch[] {
  const results: ButtonMatch[] = [];
  const openRe = /<button\b/g;
  let om: RegExpExecArray | null;
  while ((om = openRe.exec(content))) {
    const tagStart = om.index;
    let i = tagStart + "<button".length;
    let depth = 0;
    // 找开始标签真正的结束 '>'（花括号深度为 0 时的第一个 '>' ，且不是自闭合 '/>' 之外的东西）
    let tagEnd = -1;
    for (; i < content.length; i++) {
      const c = content[i];
      if (c === "{") depth++;
      else if (c === "}") depth--;
      else if (c === ">" && depth === 0) { tagEnd = i; break; }
    }
    if (tagEnd === -1) continue; // 没找到，跳过（不应该发生）
    const attrs = content.slice(tagStart + "<button".length, tagEnd);
    if (attrs.trim().endsWith("/")) continue; // 自闭合 <button ... /> 没有子内容，不在我们要扫的范围里

    // 找匹配的 </button>（不需要处理嵌套 <button>，这套代码里没有按钮套按钮）
    const closeIdx = content.indexOf("</button>", tagEnd);
    if (closeIdx === -1) continue;
    const inner = content.slice(tagEnd + 1, closeIdx);
    const line = content.slice(0, tagStart).split("\n").length;
    results.push({ line, attrs, inner });
  }
  return results;
}

// 判断按钮内容是否"只有一个图标组件，没有任何可见文字"：
// - 允许内容里只有形如 <IconName ... /> 的自闭合标签（首字母大写，符合 lucide-react 图标命名）
// - 不允许出现任何 {t(...)}、纯文本、或多个子元素夹带文字
function isIconOnly(inner: string): boolean {
  const trimmed = inner.trim();
  if (!trimmed) return false;
  const iconRe = /<[A-Z]\w*\b[^>]*\/>/g;
  const iconMatches = trimmed.match(iconRe) || [];
  if (iconMatches.length !== 1) return false;
  const withoutIcons = trimmed.replace(iconRe, "").trim();
  return withoutIcons.length === 0;
}

function hasAriaLabel(attrs: string): boolean {
  return /\baria-label\s*=/.test(attrs);
}

describe("icon-only buttons must have aria-label (BUG-07)", () => {
  for (const rel of FILES_TO_CHECK) {
    it(`${rel}：所有仅含图标、无可见文字的按钮都带 aria-label`, () => {
      const full = path.join(SRC_ROOT, rel);
      const content = fs.readFileSync(full, "utf-8");
      const offenders: string[] = [];
      for (const btn of findButtons(content)) {
        if (!isIconOnly(btn.inner)) continue;
        if (!hasAriaLabel(btn.attrs)) {
          offenders.push(`line ${btn.line}: <button ${btn.attrs.trim().slice(0, 80)}>`);
        }
      }
      expect(offenders, `以下纯图标按钮缺少 aria-label：\n${offenders.join("\n")}`).toEqual([]);
    });
  }

  it("扫描确实找到了纯图标按钮（防止解析失效导致测试形同虚设）", () => {
    const full = path.join(SRC_ROOT, "pages/HomePage.tsx");
    const content = fs.readFileSync(full, "utf-8");
    const iconOnlyCount = findButtons(content).filter(b => isIconOnly(b.inner)).length;
    expect(iconOnlyCount).toBeGreaterThan(5);
  });
});
