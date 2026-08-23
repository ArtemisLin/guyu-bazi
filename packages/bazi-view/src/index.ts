/**
 * 盘面渲染共享层：纯函数，输入排盘结果＋视图状态 → HTML 字符串。
 * 零宿主依赖（不碰 DOM / localStorage / location），供网页验证台与 Obsidian 插件共用——
 * 避免两个壳各渲染一套导致「用户验的和用的不是同一份」。
 * 事件绑定与状态管理留在各自的壳里（靠 data-* 属性对接）。
 */
import {
  CHANG_SHENG_STAGES, LIUREN_RULES, changShengTable, liurenPanel, shenShaContextOf, shenShaOrigins, suiQianShiErShen, tianMa,
  type ChartResult, type LiurenLevel, type PillarDetail,
} from '@bazi/core'
import { HeavenStem, SixtyCycle, SolarDay } from 'tyme4ts'
import { REGIONS, regionCoord } from './regions'
export { REGIONS, regionCoord } from './regions'
export type { Region, RegionCity, RegionArea } from './regions'

// —— 基础：HTML 转义／五行着色与十神缩写 ——

/** HTML 转义：外部来源字符串（如笔记 frontmatter 的 place）拼进 innerHTML 前必须过一遍（审查修复 2026-08-11） */
export const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

const ABBR: Record<string, string> = {
  比肩: '比', 劫财: '劫', 食神: '食', 伤官: '伤', 正财: '财',
  偏财: '才', 正官: '官', 七杀: '杀', 正印: '印', 偏印: '枭',
}
const WX: Record<string, string> = {
  甲: 'wood', 乙: 'wood', 丙: 'fire', 丁: 'fire', 戊: 'earth', 己: 'earth', 庚: 'metal', 辛: 'metal', 壬: 'water', 癸: 'water',
  寅: 'wood', 卯: 'wood', 巳: 'fire', 午: 'fire', 申: 'metal', 酉: 'metal', 亥: 'water', 子: 'water', 辰: 'earth', 戌: 'earth', 丑: 'earth', 未: 'earth',
}
export const wx = (c: string) => `<span class="wx-${WX[c]}">${c}</span>`
/** 单字五行类名（wood/fire/earth/metal/water）：供 DOM API 场景（如插件弹窗）着色，避免另存一份 WX 表 */
export const wxName = (c: string): string => WX[c] ?? ''
export const wxGZ = (gz: string) => wx(gz[0]) + wx(gz[1])

export function tenStarAbbr(dayMaster: string, target: string): string {
  return ABBR[HeavenStem.fromName(dayMaster).getTenStar(HeavenStem.fromName(target)).getName()] ?? ''
}
export function branchMainAbbr(dayMaster: string, ganZhi: string): string {
  return tenStarAbbr(dayMaster, SixtyCycle.fromName(ganZhi).getEarthBranch().getHideHeavenStemMain().getName())
}
/** 岁运格内两行「干+十神／支+十神」 */
export function gz2(dayMaster: string, ganZhi: string): string {
  return `${wx(ganZhi[0])}<i>${tenStarAbbr(dayMaster, ganZhi[0])}</i><br>${wx(ganZhi[1])}<i>${branchMainAbbr(dayMaster, ganZhi)}</i>`
}

export const ZONE: Record<string, string> = {}
for (const [zone, stars] of [['东方苍龙', '角亢氐房心尾箕'], ['北方玄武', '斗牛女虚危室壁'], ['西方白虎', '奎娄胃昴毕觜参'], ['南方朱雀', '井鬼柳星张翼轸']] as const)
  for (const s of stars) ZONE[s] = zone

/** 今天的年/月/日干支（tyme4ts 节气制，与引擎同底座） */
export function todayGZ(): { nian: string; yue: string; ri: string } {
  const n = new Date()
  const scd = SolarDay.fromYmd(n.getFullYear(), n.getMonth() + 1, n.getDate()).getSixtyCycleDay()
  const m = scd.getSixtyCycleMonth()
  return { nian: m.getSixtyCycleYear().getSixtyCycle().getName(), yue: m.getSixtyCycle().getName(), ri: scd.getSixtyCycle().getName() }
}

// —— 主盘明细表 ——

export interface PillarCol { h: string; sui?: boolean; det: PillarDetail }

/** 十二长生总表内层（常量表，模块级缓存一次） */
let CS_TABLE_HTML: string | null = null
function csTableHtml(): string {
  if (CS_TABLE_HTML) return CS_TABLE_HTML
  CS_TABLE_HTML = `<div class="csgrid"><div class="csg h"></div>${
    CHANG_SHENG_STAGES.map((s) => `<div class="csg h">${s}</div>`).join('')}${
    changShengTable().map((r) =>
      `<div class="csg lab">${[...r.gans].map(wx).join('')}</div>${r.zhis.map((z) => `<div class="csg">${wx(z)}</div>`).join('')}`,
    ).join('')}</div>`
  return CS_TABLE_HTML
}

/** 主盘明细表：表头＋主星/天干/地支/藏干/星运/自坐/十二长生总表（默认折叠）/空亡/纳音/神煞 */
export function pillarRows(cols: PillarCol[], opts?: { csFold?: boolean }): string {
  const g = (cls: string, i: number, html: string) => `<div class="g ${cls}${i === 0 ? ' c0' : ''}">${html}</div>`
  let html = `<div class="grid" style="grid-template-columns:36px repeat(${cols.length},1fr)">`
  html += g('h', 0, '') + cols.map((c, i) => g(`h${c.sui ? ' sui' : ''}`, i + 1, c.h)).join('')
  const row = (lab: string, f: (c: PillarCol) => string, cls: string) =>
    g('lab', 0, lab) + cols.map((c, i) => g(cls, i + 1, f(c))).join('')
  html += row('主星', (c) => c.det.mainStar, 'star')
  html += row('天干', (c) => wx(c.det.stem), 'gz')
  html += row('地支', (c) => wx(c.det.branch), 'gz')
  html += row('藏干', (c) => c.det.hiddenStems.map((h) => `${wx(h.stem)}<i>${h.tenStar}</i>`).join('<br>') || '—', 'hide')
  html += row('星运', (c) => c.det.stage, 'sm')
  html += row('自坐', (c) => c.det.selfSit, 'sm')
  // 十二长生总表：太极点常换、忘了某干在某支的状态时点开速查（docs/00 #64）
  const csFold = opts?.csFold ?? true
  html += `<div class="g cshead" style="grid-column:1/-1"><button class="fold" id="f-cs">十二长生总表（火土同宫） ${csFold ? '展开 ▼' : '收起 ▲'}</button></div>`
  if (!csFold) html += `<div class="g csbody" style="grid-column:1/-1">${csTableHtml()}</div>`
  html += row('空亡', (c) => c.det.voidBranches, 'dim')
  html += row('纳音', (c) => c.det.naYin, 'dim')
  html += row('神煞', (c) => c.det.shenSha.join('<br>') || '—', 'ss')
  return html + '</div>'
}

// —— 五行旺相休囚死 ——

const SHENG: Record<string, string> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' }
const KE: Record<string, string> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' }
export function wangBar(monthBranch: string): string {
  const ELEM: Record<string, string> = { 寅: '木', 卯: '木', 巳: '火', 午: '火', 申: '金', 酉: '金', 亥: '水', 子: '水', 辰: '土', 戌: '土', 丑: '土', 未: '土' }
  const ling = ELEM[monthBranch]
  const state = (e: string) => (e === ling ? '旺' : SHENG[ling] === e ? '相' : SHENG[e] === ling ? '休' : KE[e] === ling ? '囚' : '死')
  const cls: Record<string, string> = { 木: 'wx-wood', 火: 'wx-fire', 土: 'wx-earth', 金: 'wx-metal', 水: 'wx-water' }
  return `<div class="wang">${['木', '火', '土', '金', '水'].map((e) => `<span class="${cls[e]}">${e}${state(e)}</span>`).join('')}</div>`
}

// —— 动态神煞面板 ——

export type LiurenCat = 'sui' | 'ji' | 'yue' | 'xun' | 'rg' | 'rz'
export type PanelAnchor = { gz: string; label: string; isToday?: boolean }
export type PanelAnchors = { nian: PanelAnchor; yue: PanelAnchor; ri: PanelAnchor }

/** 六类契约：类别 → 引擎 level 的第几个 section ＋ 用哪个锚 */
export const CATS: ReadonlyArray<{ k: LiurenCat; label: string; level: LiurenLevel; sec: number; a: keyof PanelAnchors }> = [
  { k: 'sui', label: '岁煞', level: 'liunian', sec: 0, a: 'nian' },
  { k: 'ji', label: '季煞', level: 'liuyue', sec: 1, a: 'yue' },
  { k: 'yue', label: '月煞', level: 'liuyue', sec: 0, a: 'yue' },
  { k: 'xun', label: '旬煞', level: 'liuri', sec: 2, a: 'ri' },
  { k: 'rg', label: '日干煞', level: 'liuri', sec: 0, a: 'ri' },
  { k: 'rz', label: '日支煞', level: 'liuri', sec: 1, a: 'ri' },
]

export interface PanelState {
  cat: LiurenCat
  /** 图钉冻结的三锚快照；null＝跟随选择 */
  pin: PanelAnchors | null
  folded: boolean
}

/** 动态神煞面板：六类切换＋年月日三柱条＋压缩条＋条目行 */
export function liurenPanelHtml(anchors: PanelAnchors, st: PanelState): string {
  const eff = st.pin ?? anchors
  const cat = CATS.find((c) => c.k === st.cat) ?? CATS[0]
  const anchor = eff[cat.a]
  const pend = LIUREN_RULES.filter((r) => r.status === '待验收').length
  // 2026-08-10 用户全量核验完成后撤掉验证 UI；仅「待验收」新规则仍带橙标（未核验先标出的纪律）
  const vBadge = (_ids: string[], status: string) =>
    status === '待验收' ? '<span class="lrwip">待验收</span>' : ''
  let html = `<div class="lrpanel" id="lrpanel"><div class="lrhead"><b>动态神煞</b>`
  html += CATS.map((c) => `<span class="chip tg${st.cat === c.k ? ' on' : ''}" data-pv="${c.k}">${c.label}</span>`).join('')
  html += `<span class="chip tg${st.pin ? ' on' : ''}" id="b-ppin">${st.pin ? '📌已钉·点击解除' : '图钉'}</span>`
  html += `<button class="fold" id="f-pn">${st.folded ? '展开 ▼' : '收起 ▲'}</button></div>`
  html += `<div class="lrnote">默认按今天起盘，点流年/流月/流日格换锚（神煞＝支位，自行对盘读，与明细表「原局起→落此柱」是两套体系）｜共 ${LIUREN_RULES.length} 条${pend ? `，其中 ${pend} 条待核验` : ''}；大运/流时不起煞</div>`
  if (st.folded) return html + '</div>'
  // 年/月/日三柱常驻放大条：当前类别用的那柱高亮，未点选而回落今天的标灰「今」
  const PILL: Record<keyof PanelAnchors, string> = { nian: '年', yue: '月', ri: '日' }
  html += `<div class="lrpills" id="lrpills">`
  html += (['nian', 'yue', 'ri'] as const)
    .map((k) => {
      const a = eff[k]
      return `<span class="lrp${cat.a === k ? ' on' : ''}"><i>${PILL[k]}</i><b>${a.label}</b><em>${wxGZ(a.gz)}</em>${a.isToday ? '<s>今</s>' : ''}</span>`
    })
    .join('')
  html += `${st.pin ? '<span class="lrpin">📌已钉住</span>' : ''}</div>`
  const sec = liurenPanel(cat.level, anchor.gz)[cat.sec]
  html += `<div class="lrsec">${sec.title}<span class="ln"></span></div>`
  for (const bar of sec.bars ?? []) {
    html += `<div class="lrbarw"><i class="lrpre">${bar.prefix}·</i>${vBadge([bar.ruleId], bar.status)}<div class="lrbar">`
    html += bar.slots
      .map((s) => `<span class="sl">${wx(s.branch)}<b>${s.name}</b>${s.coNames.map((n) => `<i>${n}</i>`).join('')}</span>`)
      .join('')
    html += `</div></div>`
  }
  html += `<div class="lrlines">`
  html += sec.lines
    .map((l) => {
      const pos = l.pos.map((p) => (p.length === 2 ? wxGZ(p) : wx(p))).join('、')
      return `<span class="lrline"><b>${l.label}</b>＝${pos || '—'}${l.judge ? `<i>（${l.judge}）</i>` : ''}${l.mergeNote ? `<i>${l.mergeNote}</i>` : ''}${vBadge(l.ruleIds, l.status)}</span>`
    })
    .join('')
  html += `</div>`
  return html + '</div>'
}

// —— 神煞总览（原局起，方案C） ——

/** 按起点分组，每条「神煞＝位 → 盘中落点」；folded 时只出标题行 */
export function shenShaGroups(
  c: ChartResult,
  lead: Array<{ h: string; det: PillarDetail }>,
  gender: '乾' | '坤',
  folded: boolean,
): string {
  const cols: Array<[string, PillarDetail]> = [
    ...lead.map((l) => [l.h.split(' ')[0], l.det] as [string, PillarDetail]),
    ['年柱', c.detail.year], ['月柱', c.detail.month], ['日柱', c.detail.day], ['时柱', c.detail.hour],
  ]
  const colTag = (label: string, det: PillarDetail) => `<i>${label}</i>${wxGZ(det.stem + det.branch)}`
  const hitsOf = (name: string) =>
    cols.filter(([, det]) => det.shenSha.includes(name)).map(([label, det]) => colTag(label, det))
  let html = `<div class="sec">神煞总览（原局起）· 每条：神煞＝位 → 盘中落点<button class="fold" id="f-ss">${folded ? '展开 ▼' : '收起 ▲'}</button><span class="ln"></span></div>`
  if (folded) return html
  html += `<div class="groups">`
  for (const g of shenShaOrigins(shenShaContextOf(c, gender))) {
    const lines = g.items
      .map((it) => ({ ...it, hits: hitsOf(it.name) }))
      .filter((it) => it.hits.length)
      .map((it) => `<b>${it.name}</b>${it.pos ? `＝${it.pos}` : ''} → ${it.hits.join('、')}`)
    if (lines.length)
      html += `<div class="grp"><span class="gl">${g.title}</span><span class="gi">${lines.join('<br>')}</span></div>`
  }
  const yearZhi = c.detail.year.branch
  html += `<div class="grp"><span class="gl">岁前十二神·原局年支版（年支${yearZhi}＝太岁，顺行每支一神；流年动态版见动态神煞面板）</span><span class="gi">${cols
    .map(([label, det]) => `${wx(det.branch)}<b>${suiQianShiErShen(yearZhi, det.branch)}</b><i>·${label}</i>`)
    .join('　')}</span></div>`
  const tm = tianMa(c.detail.month.branch)
  const tmHits = cols.filter(([, det]) => det.branch === tm).map(([label, det]) => colTag(label, det))
  html += `<div class="grp"><span class="gl">天马·原局月支版（月支起；流月动态版见动态神煞面板）</span><span class="gi">本月（${c.detail.month.branch}月）天马在 ${wx(tm)}${tmHits.length ? ` → ${tmHits.join('、')}` : '，盘中未见'}</span></div>`
  return html + `</div>`
}
