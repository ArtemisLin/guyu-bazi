/**
 * 冒烟用的 ViewState 构造器——放在 .ts 里并纳入 tsconfig include，
 * ViewState 加字段/改类型时 `npm run typecheck` 会红（此前 smoke 手写字面量缺 csFold/editing 靠渲染层 ?? 兜底碰巧全绿）。
 */
import type { ViewState } from '../src/types'

export const mkState = (birth: ViewState['birth'], chart: ViewState['chart']): ViewState => ({
  caseName: '样本A', birth, chart, notePath: null,
  dy: 0, ln: 0, my: null, ri: null, si: null, tms: false,
  cat: 'sui', pin: null, panelFolded: false, overviewFolded: true, csFold: true, editing: false,
} satisfies ViewState)
