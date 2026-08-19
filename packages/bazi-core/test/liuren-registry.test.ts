/**
 * 六壬注册表完整性测试（仿 origins.test.ts 双向模式）：
 * 方向一：面板输出的每个 ruleId 必在注册表；方向二：注册表每条必可被面板输出（防「注册了但解释器不认」）。
 * 另测元数据纪律：出处/口诀非空、消歧后缀、禁词「日破」、mergeInto 指向存在、全锚无空位。
 */
import { describe, expect, it } from 'vitest'
import { BRANCHES, STEMS } from '../src/ganzhi'
import { LIUREN_RULES } from '../src/liurenRegistry'
import { LiurenLevel, liurenPanel, resolveLiurenRing, resolveLiurenRule } from '../src/liurenPanel'

const JIAZI = Array.from({ length: 60 }, (_, i) => STEMS[i % 10] + BRANCHES[i % 12])
const LEVELS: LiurenLevel[] = ['liunian', 'liuyue', 'liuri']
const idsOf = (level: LiurenLevel, gz: string) => {
  const out: string[] = []
  for (const sec of liurenPanel(level, gz)) {
    for (const b of sec.bars ?? []) out.push(b.ruleId)
    for (const l of sec.lines) out.push(...l.ruleIds)
  }
  return out
}

describe('注册表元数据', () => {
  it('131 条（含游神·大全本）、id 唯一、必填字段与体系标签', () => {
    expect(LIUREN_RULES.length).toBe(131)
    expect(new Set(LIUREN_RULES.map((r) => r.id)).size).toBe(131)
    for (const r of LIUREN_RULES) {
      expect(r.system, r.id).toBe('六壬')
      expect(r.koujue.length > 0, `${r.id} 口诀空`).toBe(true)
      expect(r.sourceRef.length > 0, `${r.id} 出处空`).toBe(true)
      expect(['待验收', '已验收']).toContain(r.status)
      expect(r.name.includes('日破'), `${r.id} 含禁词日破`).toBe(false)
    }
  })
  // 2026-08-02 用户裁决「名称按六壬app对齐」：显示名去消歧后缀（体系靠面板级「六壬」徽标区分），
  // 原消歧名转入 aliases 不得丢失——本测试守的是「信息不丢」而非「后缀在名里」。
  it('与八字原局同名异煞者：显示名对齐 app、消歧名保留在别名', () => {
    for (const id of ['tianXiJi', 'siFeiZhi', 'jiGu', 'jiGua', 'riDeLr', 'yangRenLr', 'fuXingLr', 'tianMaYue', 'tianSheDyn', 'xueZhi', 'jinShenLr', 'tuiShenLr', 'xueTangLr', 'tianYiLr']) {
      const r = LIUREN_RULES.find((r) => r.id === id)
      expect(r, id).toBeDefined()
      const hasSuffix = /[(（]/.test(r!.name) || (r!.aliases ?? []).some((a) => /[(（]/.test(a))
      expect(hasSuffix, `${id} 消歧名既不在 name 也不在 aliases`).toBe(true)
    }
  })
  it('同一族内显示名不撞车（撞车会让用户对不上 app）', () => {
    const byFam = new Map<string, Set<string>>()
    for (const r of LIUREN_RULES) {
      // 岁/季/月 与 旬/日干/日支 分别同屏；季族随流月与月族同锚但分节显示
      const key = r.family
      if (!byFam.has(key)) byFam.set(key, new Set())
      const set = byFam.get(key)!
      expect(set.has(r.name), `${r.family}族重名：${r.name}`).toBe(false)
      set.add(r.name)
    }
  })
  it('mergeInto 指向存在的规则与槽位', () => {
    const byId = new Map(LIUREN_RULES.map((r) => [r.id, r]))
    for (const r of LIUREN_RULES) {
      if (!r.mergeInto) continue
      const host = byId.get(r.mergeInto.rule)
      expect(host, `${r.id}→${r.mergeInto.rule}`).toBeDefined()
      if (r.mergeInto.ringName) {
        expect(host!.qifa.kind, `${r.id} 的宿主应为 ring`).toBe('ring12')
        if (host!.qifa.kind === 'ring12') expect(host!.qifa.names, `${r.id} 槽位 ${r.mergeInto.ringName}`).toContain(r.mergeInto.ringName)
      } else {
        expect(host!.family, `${r.id} 同族合并`).toBe(r.family)
      }
    }
  })
})

describe('解释器全锚扫（60 甲子）', () => {
  it('非 ring 规则任意合法锚都有位（缺表键即挂）', () => {
    for (const r of LIUREN_RULES) {
      if (r.qifa.kind === 'ring12') continue
      for (const gz of JIAZI) expect(resolveLiurenRule(r, gz).length > 0, `${r.id}@${gz} 无位`).toBe(true)
    }
  })
  it('ring 规则任意锚 12 槽齐', () => {
    for (const r of LIUREN_RULES) {
      if (r.qifa.kind !== 'ring12') continue
      for (const gz of JIAZI) expect(resolveLiurenRing(r, gz).length, `${r.id}@${gz}`).toBe(12)
    }
  })
})

describe('面板双向覆盖', () => {
  it('输出 ruleId ⊆ 注册表，且每条规则可被输出；族与视角对应', () => {
    const FAMS: Record<LiurenLevel, string[]> = { liunian: ['岁'], liuyue: ['月', '季'], liuri: ['日干', '日支', '旬'] }
    const all = new Set(LIUREN_RULES.map((r) => r.id))
    const seen = new Set<string>()
    const byId = new Map(LIUREN_RULES.map((r) => [r.id, r]))
    for (const level of LEVELS)
      for (const gz of JIAZI) {
        for (const id of idsOf(level, gz)) {
          expect(all.has(id), `${level} 输出未知规则 ${id}`).toBe(true)
          expect(FAMS[level], `${id} 族 ${byId.get(id)!.family} 不该出现在 ${level}`).toContain(byId.get(id)!.family)
          seen.add(id)
        }
      }
    for (const r of LIUREN_RULES) expect(seen.has(r.id), `${r.id} 从未被面板输出`).toBe(true)
  })
  it('同族合并规则不出独立行', () => {
    for (const level of LEVELS) {
      const secs = liurenPanel(level, '甲子')
      for (const l of secs.flatMap((s) => s.lines)) {
        const lead = LIUREN_RULES.find((r) => r.id === l.ruleIds[0])!
        expect(!lead.mergeInto || !!lead.mergeInto.ringName, `${lead.id} 应并入 ${lead.mergeInto?.rule}`).toBe(true)
      }
    }
  })
})
