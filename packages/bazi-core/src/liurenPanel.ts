/**
 * 六壬动态神煞面板 API：起法解释器＋分组组装（数据在 liurenRegistry.ts）。
 * 面板只显「神煞＝支位」盘，不做命中标注（docs/10 §〇-7），故与原局 chart 零耦合。
 */
import { BRANCHES, bAdd, bi, si } from './ganzhi'
import { tianMa, xunKong, xunShou } from './tables'
import { LIUREN_RULES, LiurenRule, LiurenStatus, Season } from './liurenRegistry'

export type LiurenLevel = 'liunian' | 'liuyue' | 'liuri'

export interface LiurenLine {
  /** 合并后并列（主规则在前） */
  ruleIds: string[]
  /** 显示名（同族合并如「天耳／天喜(季)」；别名如「直符（飞符）」） */
  label: string
  /** 位：支、双支或干支（判柱型） */
  pos: string[]
  /** 各规则口诀（验证模式推导链，与 ruleIds 对齐） */
  koujue: string[]
  judge?: string
  /** 并入 ring 的点名项标注，如「＝岁前十二神·岁破同位」 */
  mergeNote?: string
  status: LiurenStatus
}

export interface LiurenBar {
  ruleId: string
  /** 十二神类强制前缀（docs/10 §〇-6），如「流年太岁」 */
  prefix: string
  /** 12 槽，按神名序（首槽＝起点） */
  slots: Array<{ branch: string; name: string; coNames: string[] }>
  koujue: string
  status: LiurenStatus
}

export interface LiurenSection {
  title: string
  bars?: LiurenBar[]
  lines: LiurenLine[]
}

export function seasonOf(zhi: string): Season {
  const m = (bi(zhi) - 2 + 12) % 12
  return (['春', '夏', '秋', '冬'] as const)[Math.floor(m / 3)]
}

/** 六甲旬起讫：甲子旬 → 甲子〜癸酉 */
export function xunLabel(ganZhi: string): { shouGanZhi: string; endGanZhi: string; shouZhi: string } {
  const shouZhi = xunShou(ganZhi.charAt(0), ganZhi.charAt(1))
  return { shouGanZhi: `甲${shouZhi}`, endGanZhi: `癸${bAdd(shouZhi, 9)}`, shouZhi }
}

const flat = (v: string | readonly string[] | undefined): string[] => (v === undefined ? [] : typeof v === 'string' ? [v] : [...v])

/** 单规则求位（ring 类返回 []，用 resolveLiurenRing） */
export function resolveLiurenRule(rule: LiurenRule, ganZhi: string): string[] {
  const gan = ganZhi.charAt(0)
  const zhi = ganZhi.charAt(1)
  const q = rule.qifa
  switch (q.kind) {
    case 'ring12':
      return []
    case 'offset':
      return [bAdd(zhi, q.n)]
    case 'branchMap':
      return flat(q.table[zhi])
    case 'monthSeq': {
      const m = (bi(zhi) - 2 + 12) % 12 // 正月＝寅
      return [BRANCHES[(bi(q.start) + q.dir * m + 120) % 12]]
    }
    case 'seasonMap':
      return flat(q.table[seasonOf(zhi)])
    case 'stemMap':
      return flat(q.table[gan])
    case 'xunMap':
      return flat(q.table[xunShou(gan, zhi)])
    case 'xunDun':
      // 旬遁干：遁干距旬首甲的步数即支距旬首支的步数
      return [q.gan + bAdd(xunShou(gan, zhi), si(q.gan))]
    case 'builtin':
      switch (q.fn) {
        case 'xunKong':
          return [...xunKong(gan, zhi)]
        case 'xunShou':
          return [xunShou(gan, zhi)]
        case 'tianMa':
          return [tianMa(zhi)]
      }
  }
}

/** ring 类 12 槽（按神名序，首槽＝起点支） */
export function resolveLiurenRing(rule: LiurenRule, ganZhi: string): Array<{ branch: string; name: string }> {
  const q = rule.qifa
  if (q.kind !== 'ring12') return []
  const zhi = ganZhi.charAt(1)
  const startZhi = q.start === 'anchor' ? zhi : q.start[zhi]
  return q.names.map((name, i) => ({ branch: bAdd(startZhi, i), name }))
}

const LEVEL_FAMILIES: Record<LiurenLevel, Array<{ fams: LiurenRule['family'][]; title: (gz: string) => string }>> = {
  liunian: [{ fams: ['岁'], title: (gz) => `岁煞盘 · 以流年支${gz.charAt(1)}起` }],
  liuyue: [
    { fams: ['月'], title: (gz) => `月煞盘 · 以流月支${gz.charAt(1)}起` },
    { fams: ['季'], title: (gz) => seasonTitle(gz.charAt(1)) },
  ],
  liuri: [
    { fams: ['日干'], title: (gz) => `日干煞盘 · 以流日干${gz.charAt(0)}起` },
    { fams: ['日支'], title: (gz) => `日支煞盘 · 以流日支${gz.charAt(1)}起` },
    { fams: ['旬'], title: (gz) => xunTitle(gz) },
  ],
}

const SEASON_MONTHS: Record<Season, string> = { 春: '寅卯辰', 夏: '巳午未', 秋: '申酉戌', 冬: '亥子丑' }
function seasonTitle(zhi: string): string {
  const s = seasonOf(zhi)
  return `季煞 · ${s}季通用（${SEASON_MONTHS[s]}三月同）`
}
function xunTitle(gz: string): string {
  const x = xunLabel(gz)
  return `旬煞 · ${x.shouGanZhi}旬（${x.shouGanZhi}〜${x.endGanZhi}）`
}

const RING_PREFIX: Record<string, string> = { suiQian12: '流年太岁', sanhe12: '流年三合' }

/** 按 family 集合组一个 section（谷雨六壬复用入口：标题由调用方给，避免「流年/流月」等八字用语硬编码——007 docs/02 §1.2 前置改动②） */
export function buildLiurenSection(fams: LiurenRule['family'][], ganZhi: string, title: string): LiurenSection {
  const byId = new Map(LIUREN_RULES.map((r) => [r.id, r]))
  {
    const rules = LIUREN_RULES.filter((r) => fams.includes(r.family))
    const bars: LiurenBar[] = []
    const lines: LiurenLine[] = []
    // 先立 ring 与独立行，再挂同族合并与 ring 徽标
    for (const r of rules) {
      if (r.qifa.kind === 'ring12') {
        bars.push({
          ruleId: r.id,
          prefix: RING_PREFIX[r.id] ?? '',
          slots: resolveLiurenRing(r, ganZhi).map((s) => ({ ...s, coNames: [] })),
          koujue: r.koujue,
          status: r.status,
        })
        continue
      }
      if (r.mergeInto && !r.mergeInto.ringName) continue // 并入同族行，不出独立行
      const label = r.aliases?.length ? `${r.name}（${r.aliases.join('/')}）` : r.name
      const host = r.mergeInto?.ringName ? byId.get(r.mergeInto.rule) : undefined
      lines.push({
        ruleIds: [r.id],
        label,
        pos: resolveLiurenRule(r, ganZhi),
        koujue: [r.koujue],
        judge: r.judge ? `判${r.judge}干支` : undefined,
        mergeNote: host ? `＝${host.name}·${r.mergeInto!.ringName}同位` : undefined,
        status: r.status,
      })
    }
    for (const r of rules) {
      if (!r.mergeInto) continue
      if (r.mergeInto.ringName) {
        // ring 槽位徽标（名字与槽位同名时不加，避免噪音）
        const bar = bars.find((b) => b.ruleId === r.mergeInto!.rule)
        const slot = bar?.slots.find((s) => s.name === r.mergeInto!.ringName)
        if (slot && r.name !== slot.name) slot.coNames.push(r.name)
      } else {
        const hostLine = lines.find((l) => l.ruleIds[0] === r.mergeInto!.rule)
        if (hostLine) {
          hostLine.ruleIds.push(r.id)
          hostLine.label += `／${r.name}`
          hostLine.koujue.push(r.koujue)
          if (r.status === '待验收') hostLine.status = '待验收'
        }
      }
    }
    return { title, bars: bars.length ? bars : undefined, lines }
  }
}

/** level＋锚干支 → 分组好的「神煞＝支位」盘 */
export function liurenPanel(level: LiurenLevel, ganZhi: string): LiurenSection[] {
  return LEVEL_FAMILIES[level].map(({ fams, title }) => buildLiurenSection(fams, ganZhi, title(ganZhi)))
}
