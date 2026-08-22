import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { subDays, format } from "date-fns";

// BUG-09 回归测试：365 天情绪热力图之前对每一天（含头尾占位）都渲染一个真实
// <button>，一年下来大约 389 个可聚焦控件——键盘用户要 Tab 几百次才能跳过这个
// 区块，触摸也几乎点不中单个 8×8px 格子，部分占位按钮还完全没有名称。
//
// 修复后：只有"这天真的写过日记"的格子才是 <button>；没有记录的日期和占位格
// 改成不可聚焦的 <div>；整个区块包一层 role="group" 的汇总说明；区块前面有一个
// 视觉隐藏、聚焦时才出现的"跳过热力图"链接。
//
// 这里 mock useLifeOs，只给 3 条日记记录（跨 365 天区间），断言：
//   1. 热力图里的可聚焦 <button> 数量等于"有记录的天数"，而不是接近 365
//   2. "跳过热力图"链接存在
//   3. 热力图容器有 role="group" 且 aria-label 里包含正确的统计数字

const today = new Date();
const ENTRY_DATES = [0, 10, 100].map(daysAgo => format(subDays(today, daysAgo), "yyyy-MM-dd"));

vi.mock("@/contexts/LifeOsContext", () => ({
  useLifeOs: () => ({
    entries: ENTRY_DATES.map(date => ({
      id: date,
      date,
      emotionScore: 7,
      emotionTags: [],
      messages: [{ role: "user", content: "test" }],
    })),
    toggleTodo: vi.fn(),
    deleteEntry: vi.fn(),
    monthFinanceStats: { income: 0, expense: 0, net: 0, entries: [], count: 0 },
  }),
}));

const { default: HistoryPage } = await import("./HistoryPage");
const { LanguageProvider } = await import("@/contexts/LanguageContext");

function renderHistory() {
  return render(
    <MemoryRouter>
      <LanguageProvider>
        <HistoryPage />
      </LanguageProvider>
    </MemoryRouter>
  );
}

describe("HistoryPage heatmap (BUG-09)", () => {
  it("只有有记录的日期才是可聚焦按钮，数量等于记录天数（不是接近 365 个）", () => {
    const { container } = renderHistory();
    const heatmapGroup = container.querySelector('[role="group"]');
    expect(heatmapGroup).not.toBeNull();
    const buttonsInHeatmap = heatmapGroup!.querySelectorAll("button");
    expect(buttonsInHeatmap.length).toBe(ENTRY_DATES.length);
  });

  it("热力图前面有一个跳过链接", () => {
    renderHistory();
    const skipLink = screen.getByText(/跳过热力图/);
    expect(skipLink.tagName.toLowerCase()).toBe("a");
    expect(skipLink.getAttribute("href")).toBe("#history-heatmap-end");
  });

  it("热力图容器的 aria-label 汇总了总天数和有记录天数", () => {
    const { container } = renderHistory();
    const heatmapGroup = container.querySelector('[role="group"]');
    const label = heatmapGroup!.getAttribute("aria-label") || "";
    expect(label).toContain("365");
    expect(label).toContain(String(ENTRY_DATES.length));
  });
});
