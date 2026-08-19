/**
 * 批注锚：盘面钻取状态 ↔ 笔记批注行 的双向转化。
 * （用户 2026-08-05 核心需求：文档与盘面的信息可以相互转化——笔记里的时间点可以还原成盘面；
 *  即 docs/00 决策 3「人生节点时间线与盘面大运/流年双向联动」的落地。）
 *
 * 批注行格式（插件写入的规范格式；手写不合格式的行不识别、不报错）：
 *   - ⏱ 2026丙午｜小暑乙未｜8/2戊申｜申时 —— 批语文字
 * 锚段 1~4 级：流年｜流月（节气）｜流日｜流时，批到哪级就写到哪级。
 */
import { liuRi, liuShi, liuYue, type ChartResult } from '@bazi/core'
import type { ViewState } from './types'

export interface DrillAnchor {
  y: number
  yGz: string
  term?: string
  tGz?: string
  m?: number
  d?: number
  dGz?: string
  /** 时辰名（子/丑/…） */
  shi?: string
}

export interface Annotation {
  anchor: DrillAnchor
  text: string
  /** 所在行号（0 起） */
  line: number
}

/** 节气月序（排序用；小寒在流年末尾） */
const TERMS = ['立春', '惊蛰', '清明', '立夏', '芒种', '小暑', '立秋', '白露', '寒露', '立冬', '大雪', '小寒']

/**
 * 钻取链解算：当前选中的流年/流月/流日/流时。
 * chartPane 渲染与批注锚共用同一份（防「渲染的盘」与「批注的锚」漂移）。
 */
export function drillChain(st: ViewState, c: ChartResult) {
  const inXY = st.dy === -1 && c.preYun.liuNian.length > 0
  const dy = inXY ? null : c.daYun[Math.max(0, st.dy)]
  const nianList = inXY ? c.preYun.liuNian : dy!.liuNian
  const ln = nianList[Math.min(st.ln, nianList.length - 1)]
  const months = liuYue(ln.ganZhi, ln.year)
  const mo = st.my !== null ? months[st.my] ?? null : null
  const days = mo ? liuRi(mo.term === '小寒' ? ln.year + 1 : ln.year, mo.term) : null
  const rd = days && st.ri !== null ? days[st.ri] ?? null : null
  const shi = rd ? liuShi(rd.ganZhi) : null
  const stt = shi && st.si !== null ? shi[st.si] ?? null : null
  return { inXY, dy, nianList, ln, months, mo, days, rd, shi, stt }
}

/** 从当前钻取状态提取批注锚（点到哪级锚到哪级） */
export function currentAnchor(st: ViewState, c: ChartResult): DrillAnchor {
  const { ln, mo, rd, stt } = drillChain(st, c)
  const a: DrillAnchor = { y: ln.year, yGz: ln.ganZhi }
  if (mo) {
    a.term = mo.term
    a.tGz = mo.ganZhi
  }
  if (rd) {
    a.m = rd.month
    a.d = rd.day
    a.dGz = rd.ganZhi
  }
  if (stt) a.shi = stt.label
  return a
}

/** 节气月 → 所在公历月（交节在月初 4~8 日，映射固定） */
const TERM_MONTH: Record<string, number> = {
  立春: 2, 惊蛰: 3, 清明: 4, 立夏: 5, 芒种: 6, 小暑: 7,
  立秋: 8, 白露: 9, 寒露: 10, 立冬: 11, 大雪: 12, 小寒: 1,
}
/** 时辰起点钟点（子时 23 点起） */
const SHI_START: Record<string, number> = {
  子: 23, 丑: 1, 寅: 3, 卯: 5, 辰: 7, 巳: 9, 午: 11, 未: 13, 申: 15, 酉: 17, 戌: 19, 亥: 21,
}

/**
 * 人读的锚描述——先公历、再干支（用户 2026-08-05 裁决）：
 * 「2002年6月9日 19时 · 壬午年 芒种丙午月 戊申日 戌时（4岁）」
 */
export function anchorText(a: DrillAnchor, birthYear?: number): string {
  const age = birthYear !== undefined ? `（${a.y - birthYear + 1}岁）` : ''
  // 公历段
  let g = `${a.y}年`
  if (a.m !== undefined) g += `${a.m}月${a.d}日`
  else if (a.term && TERM_MONTH[a.term]) g += `${TERM_MONTH[a.term]}月`
  if (a.shi && SHI_START[a.shi] !== undefined) g += ` ${SHI_START[a.shi]}时`
  // 干支段
  let z = `${a.yGz}年`
  if (a.term) z += ` ${a.term}${a.tGz ?? ''}月`
  if (a.m !== undefined && a.dGz) z += ` ${a.dGz}日`
  if (a.shi) z += ` ${a.shi}时`
  return `${g} · ${z}${age}`
}

/** 批注 → 笔记行（多行批语压成一行，段间用分号） */
export function formatAnnotationLine(a: DrillAnchor, text: string): string {
  const segs = [`${a.y}${a.yGz}`]
  if (a.term) segs.push(`${a.term}${a.tGz ?? ''}`)
  if (a.m !== undefined && a.d !== undefined) segs.push(`${a.m}/${a.d}${a.dGz ?? ''}`)
  if (a.shi) segs.push(`${a.shi}时`)
  return `- ⏱ ${segs.join('｜')} —— ${text.replace(/\s*\n+\s*/g, '；')}`
}

/** 从笔记全文解析全部批注行（按锚排序：年→节气月序→日→时辰） */
export function parseAnnotations(md: string): Annotation[] {
  const out: Annotation[] = []
  const lines = md.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\s*[-*]\s*⏱\s*(.+?)\s*——\s*(.*)$/)
    if (!m) continue
    const segs = m[1].split('｜').map((s) => s.trim())
    const y = segs[0].match(/^(\d{4})(\S{0,2})$/)
    if (!y) continue
    const a: DrillAnchor = { y: Number(y[1]), yGz: y[2] }
    let bad = false
    for (const seg of segs.slice(1)) {
      let mm: RegExpMatchArray | null
      if ((mm = seg.match(/^(\d{1,2})\/(\d{1,2})(\S{0,2})$/))) {
        a.m = Number(mm[1])
        a.d = Number(mm[2])
        a.dGz = mm[3] || undefined
      } else if ((mm = seg.match(/^(\S{1,2})时$/))) {
        a.shi = mm[1]
      } else if ((mm = seg.match(/^(\S{2})(\S{0,2})$/)) && TERMS.includes(mm[1])) {
        a.term = mm[1]
        a.tGz = mm[2] || undefined
      } else {
        bad = true
      }
    }
    if (bad) continue
    out.push({ anchor: a, text: m[2], line: i })
  }
  return out.sort((p, q) => sortKey(p.anchor) - sortKey(q.anchor))
}

function sortKey(a: DrillAnchor): number {
  const t = a.term ? TERMS.indexOf(a.term) + 1 : 0
  return a.y * 1e7 + t * 1e5 + (a.m ?? 0) * 1e3 + (a.d ?? 0) * 10 + (a.shi ? 1 : 0)
}

/**
 * 把批注锚还原成钻取选中状态：年→定位大运（含小运期）与流年，节气→流月，月/日→流日，时辰→流时。
 * 能还原到哪级就到哪级（比如手改过的锚缺流月，就停在流年）。返回给用户看的结果描述。
 */
export function restoreDrill(st: ViewState, c: ChartResult, a: DrillAnchor): string {
  st.my = null
  st.ri = null
  st.si = null
  st.pin = null
  let found = false
  const pi = c.preYun.liuNian.findIndex((l) => l.year === a.y)
  if (pi >= 0) {
    st.dy = -1
    st.ln = pi
    found = true
  } else {
    for (let i = 0; i < c.daYun.length; i++) {
      const j = c.daYun[i].liuNian.findIndex((l) => l.year === a.y)
      if (j >= 0) {
        st.dy = i
        st.ln = j
        found = true
        break
      }
    }
  }
  if (!found) return `未找到 ${a.y} 年（不在本盘大运范围内）`
  let level = `流年 ${a.y}`
  if (a.term) {
    const { ln } = drillChain(st, c)
    const mi = liuYue(ln.ganZhi, ln.year).findIndex((m) => m.term === a.term)
    if (mi >= 0) {
      st.my = mi
      level = `流月 ${a.term}`
    }
  }
  if (a.m !== undefined && st.my !== null) {
    const { days } = drillChain(st, c)
    const ri = days ? days.findIndex((r) => r.month === a.m && r.day === a.d) : -1
    if (ri >= 0) {
      st.ri = ri
      level = `流日 ${a.m}/${a.d}`
    }
  }
  if (a.shi && st.ri !== null) {
    const { shi } = drillChain(st, c)
    const si = shi ? shi.findIndex((s) => s.label === a.shi) : -1
    if (si >= 0) {
      st.si = si
      level = `流时 ${a.shi}时`
    }
  }
  return `已还原到 ${level}`
}
