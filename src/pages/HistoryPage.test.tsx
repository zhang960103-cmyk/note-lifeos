import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
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
      topicTags: [],
      todos: [],
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

// BUG-09 二次整改（方案C）回归测试：色块本身维持 8×8px 不放大到 44px，但
// 点击色块必须能跳转（展开+定位）到下方"按记录列表"里对应的那一条——列表
// 每一行是 px-4 py-3 的整行按钮，尺寸远超 44px，是色块点击的"等效大尺寸
// 入口"，这正是 WCAG 2.5.8 允许小尺寸控件不达标的前提条件。这里断言点击
// 色块后，下方对应日期的记录会展开（出现只有展开态才渲染的"删除"按钮）。
describe("HistoryPage heatmap 点击跳转到列表 (BUG-09 二次整改)", () => {
  it("点击有记录的色块后，下方列表对应日期的记录会展开显示详情", () => {
    const { container } = renderHistory();
    const heatmapGroup = container.querySelector('[role="group"]')!;
    const cellButtons = heatmapGroup.querySelectorAll("button");
    expect(cellButtons.length).toBe(ENTRY_DATES.length);

    const targetDate = ENTRY_DATES[0];
    const targetCell = Array.from(cellButtons).find(b =>
      (b.getAttribute("aria-label") || "").startsWith(targetDate)
    );
    expect(targetCell, `没找到 ${targetDate} 对应的色块`).toBeTruthy();

    const entryContainer = document.getElementById(`history-entry-${targetDate}`);
    expect(entryContainer, "列表里没有对应日期的锚点元素，跳转目标不存在").toBeTruthy();
    expect(within(entryContainer as HTMLElement).queryByText("删除")).toBeNull();

    fireEvent.click(targetCell!);

    expect(within(entryContainer as HTMLElement).getByText("删除")).toBeTruthy();
  });

  it("色块的 aria-label 明确提示会跳转到下方列表", () => {
    const { container } = renderHistory();
    const heatmapGroup = container.querySelector('[role="group"]')!;
    const cellButtons = Array.from(heatmapGroup.querySelectorAll("button"));
    expect(cellButtons.length).toBeGreaterThan(0);
    cellButtons.forEach(b => {
      expect(b.getAttribute("aria-label") || "").toContain("跳转到下方对应记录");
    });
  });
});
