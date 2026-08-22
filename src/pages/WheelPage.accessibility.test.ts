import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// BUG-08 回归测试：生命之轮的 7 个评分滑块（<input type="range">）之前完全没有
// <label>、aria-label 或 aria-labelledby——旁边虽然有一个视觉 <span> 显示维度
// 名称，但和滑块之间没有任何程序化关联，读屏用户没法区分自己在给哪个维度打分。
//
// 这是静态源码扫描：断言 WheelPage.tsx 里每一个 type="range" 的 <input ...>
// 自己的属性列表里都带 aria-label（不接受只有视觉上相邻的文字这种"看起来关联"
// 但实际没有关联的写法）。

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.resolve(__dirname, "WheelPage.tsx");

function findRangeInputs(content: string): { line: number; attrs: string }[] {
  const results: { line: number; attrs: string }[] = [];
  const openRe = /<input\b/g;
  let om: RegExpExecArray | null;
  while ((om = openRe.exec(content))) {
    const tagStart = om.index;
    let i = tagStart + "<input".length;
    let depth = 0;
    let tagEnd = -1;
    for (; i < content.length; i++) {
      const c = content[i];
      if (c === "{") depth++;
      else if (c === "}") depth--;
      else if (c === ">" && depth === 0) { tagEnd = i; break; }
    }
    if (tagEnd === -1) continue;
    const attrs = content.slice(tagStart + "<input".length, tagEnd);
    if (!/type=["']range["']/.test(attrs)) continue;
    const line = content.slice(0, tagStart).split("\n").length;
    results.push({ line, attrs });
  }
  return results;
}

describe("wheel score sliders must have aria-label (BUG-08)", () => {
  it("每一个 type=\"range\" 滑块都带 aria-label", () => {
    const content = fs.readFileSync(FILE, "utf-8");
    const sliders = findRangeInputs(content);
    expect(sliders.length, "没有扫描到任何 range 滑块，测试可能已经形同虚设").toBeGreaterThan(0);
    const offenders = sliders.filter(s => !/\baria-label\s*=/.test(s.attrs));
    expect(offenders.map(o => `line ${o.line}`), "以下滑块缺少 aria-label").toEqual([]);
  });
});
