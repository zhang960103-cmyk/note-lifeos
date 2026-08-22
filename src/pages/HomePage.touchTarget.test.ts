import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// BUG-10 二次整改（方案A）回归测试："深入追问"按钮第一版用负外边距抵消正
// 内边距的技巧把点击热区从约 19px 撑到约 39px，没有打满 WCAG 2.5.5(AAA)
// 建议的 44px，而且这种"负边距抵消"的做法一旦以后有人手滑加大负边距，热区
// 会开始视觉重叠进相邻消息气泡，点击可能命中错误元素——是一种隐患，不是
// 稳妥的长期方案。
//
// 二次整改后改用真实 padding（不再用负边距抵消），本测试直接从源码里读出
// 实际生效的 py-N 内边距，按 Tailwind 间距刻度（1 unit = 4px）和
// text-caption 的行高（12px 字号 × 1.6 行高 = 19.2px，定义于 src/index.css）
// 换算出总热区高度，断言 ≥ 44px；同时断言不再出现 "-my-" 这种负边距抵消写法，
// 防止以后又滑回第一版的重叠隐患。

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HOME_FILE = path.resolve(__dirname, "HomePage.tsx");
const CSS_FILE = path.resolve(__dirname, "../index.css");

const TAILWIND_SPACING_PX = 4; // 1 unit（如 py-1）= 4px；py-3.5 = 3.5 * 4 = 14px

function getCaptionLineHeightPx(): number {
  const css = fs.readFileSync(CSS_FILE, "utf-8");
  const block = css.match(/\.text-caption\s*\{([^}]*)\}/);
  if (!block) throw new Error("找不到 .text-caption 定义，测试基准失效");
  const fontSizeMatch = block[1].match(/font-size:\s*([\d.]+)px/);
  const lineHeightMatch = block[1].match(/line-height:\s*([\d.]+)/);
  if (!fontSizeMatch || !lineHeightMatch) throw new Error(".text-caption 缺少 font-size/line-height，测试基准失效");
  return parseFloat(fontSizeMatch[1]) * parseFloat(lineHeightMatch[1]);
}

function getGoDeeperButtonClassName(): string {
  const content = fs.readFileSync(HOME_FILE, "utf-8");
  // "深入追问"按钮的 className 是纯字符串字面量，紧跟着 aria-label={t("home.go_deeper_aria")}
  const m = content.match(/className="([^"]*)"\s*\n\s*aria-label=\{t\("home\.go_deeper_aria"\)\}/);
  if (!m) throw new Error("没找到深入追问按钮（aria-label=home.go_deeper_aria），DOM 结构可能变了，请更新这个测试的匹配方式");
  return m[1];
}

describe("HomePage『深入追问』按钮触摸热区 (BUG-10 二次整改)", () => {
  const className = getGoDeeperButtonClassName();

  it("不再使用负外边距抵消正内边距这种有重叠隐患的写法", () => {
    expect(className).not.toMatch(/-my-/);
  });

  it("纵向点击热区（文字行高 + 上下 padding）达到 44px", () => {
    const captionLineHeight = getCaptionLineHeightPx();
    const pyMatch = className.match(/(?:^|\s)py-([\d.]+)(?:\s|$)/);
    expect(pyMatch, `class 里没找到 py-N，实际 class="${className}"`).not.toBeNull();
    const paddingPxEachSide = parseFloat(pyMatch![1]) * TAILWIND_SPACING_PX;
    const totalHitAreaPx = captionLineHeight + paddingPxEachSide * 2;
    expect(totalHitAreaPx).toBeGreaterThanOrEqual(44);
  });
});
