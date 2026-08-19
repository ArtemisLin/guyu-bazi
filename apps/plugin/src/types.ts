import type { ChartResult } from '@bazi/core'
import type { LiurenCat, PanelAnchors } from '@bazi/view'

/** 生辰：可完整重现盘面的最小集，原样存进笔记 frontmatter */
export interface Birth {
  /** 公历 YYYY-MM-DD */
  date: string
  /** HH:mm（24 时制，钟表时；真太阳时由引擎按经度换算） */
  time: string
  gender: '乾' | '坤'
  /** 出生地名，仅作展示与记录 */
  place?: string
  /** 出生地经度（东经为正）；缺省＝不修正真太阳时 */
  lon?: number
  /** 晚子时规则：wenzhen＝不换日（默认）、huanri＝换日 */
  sect: 'wenzhen' | 'huanri'
  /** 钟表时为中国夏令时读数（1986–1991）：排盘先减 1 小时化为标准时 */
  dst?: boolean
}

export interface BaziSettings {
  /** 设置格式版本（docs/13 §5）；loadSettings 按此做将来迁移，坏值/缺失按 1 */
  settingsVersion: number
  /** 断案笔记默认文件夹 */
  folder: string
  /** 文件名模板，{案例名} 占位 */
  fileTemplate: string
  /** 真太阳时开关（关＝按钟表时排） */
  trueSolar: boolean
  /** 默认晚子时规则 */
  sect: 'wenzhen' | 'huanri'
  /** 神煞总览默认收起 */
  overviewFolded: boolean
  /** 三栏布局：折叠状态与栏宽（px），持久化 */
  panes: {
    chartFold: boolean
    noteFold: boolean
    aiFold: boolean
    noteW: number
    aiW: number
  }
}

export const DEFAULT_SETTINGS: BaziSettings = {
  settingsVersion: 1,
  folder: '八字剧本集',
  fileTemplate: '{案例名}',
  trueSolar: true,
  sect: 'wenzhen',
  overviewFolded: true,
  panes: { chartFold: false, noteFold: false, aiFold: false, noteW: 380, aiW: 260 },
}

/** 一次解读会话的全部视图状态（每个 View 实例一份） */
export interface ViewState {
  caseName: string
  birth: Birth
  chart?: ChartResult
  /** 当前笔记文件路径；null＝尚未落盘 */
  notePath: string | null
  /** 大运索引，-1＝小运期 */
  dy: number
  /** 流年在当前大运内的索引 */
  ln: number
  /** 展开的流月/流日/流时序号 */
  my: number | null
  ri: number | null
  si: number | null
  /** 胎命身开关 */
  tms: boolean
  /** 动态神煞面板 */
  cat: LiurenCat
  pin: PanelAnchors | null
  panelFolded: boolean
  overviewFolded: boolean
  /** 十二长生总表收起（默认收起，速查表——docs/00 #64） */
  csFold: boolean
  /** 中栏就地编辑模式（编辑正文、自动保存；开着时外部 modify 不刷新时间线以免打断输入） */
  editing: boolean
}

/**
 * data.json → 设置：浅合并默认值＋逐字段类型校验（docs/13 §5）。
 * data.json 被手改/同步冲突写坏（noteW 变字符串、panes 变 null…）时静默回默认，
 * 不让坏值流进布局算出 "0 0 nullpx"（审查发现，2026-08-18 修）。settingsVersion 留将来迁移钩子。
 */
export function sanitizeSettings(raw: Partial<BaziSettings> | Record<string, unknown>): BaziSettings {
  const r = raw as Record<string, unknown>
  const D = DEFAULT_SETTINGS
  const str = (v: unknown, d: string) => (typeof v === 'string' && v.trim() ? v : d)
  const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d)
  const num = (v: unknown, d: number, min: number, max: number) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : d
  const rp = (r.panes && typeof r.panes === 'object' ? r.panes : {}) as Record<string, unknown>
  return {
    settingsVersion: 1,
    folder: str(r.folder, D.folder),
    fileTemplate: str(r.fileTemplate, D.fileTemplate),
    trueSolar: bool(r.trueSolar, D.trueSolar),
    sect: r.sect === 'huanri' ? 'huanri' : 'wenzhen',
    overviewFolded: bool(r.overviewFolded, D.overviewFolded),
    panes: {
      chartFold: bool(rp.chartFold, D.panes.chartFold),
      noteFold: bool(rp.noteFold, D.panes.noteFold),
      aiFold: bool(rp.aiFold, D.panes.aiFold),
      noteW: num(rp.noteW, D.panes.noteW, 170, 900),
      aiW: num(rp.aiW, D.panes.aiW, 170, 900),
    },
  }
}
