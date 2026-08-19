import { describe, expect, it } from 'vitest'
import { computeChart, shenShaContextOf, shenShaOrigins, suiQianShiErShen } from '../src'
import type { PillarDetail } from '../src'

/** 收集一张盘所有展示列的神煞名（四柱+胎命身+大运+流年+小运，即总览的数据源范围） */
function allNames(c: ReturnType<typeof computeChart>): Set<string> {
  const dets: PillarDetail[] = [
    c.detail.year, c.detail.month, c.detail.day, c.detail.hour,
    c.taiMingShen.taiYuan, c.taiMingShen.mingGong, c.taiMingShen.shenGong,
    ...c.daYun.flatMap((d) => [d.detail, ...d.liuNian.map((l) => l.detail)]),
    ...c.preYun.liuNian.map((l) => l.detail),
  ]
  return new Set(dets.flatMap((d) => d.shenSha))
}

describe('神煞起法目录（方案C总览的数据层）', () => {
  // 输入盘任意（本测试是结构性扫描：目录须覆盖任何盘的全部神煞输出）——
  // 2026-08-19 换为合成生辰（docs/00 #77 公开前提），覆盖面较原黄金盘不减：两性/晚子/经度修正/立春界/跨年代
  const charts = [
    computeChart({ clock: { y: 1985, m: 3, d: 8, hh: 10, mi: 30 }, gender: '乾', trueSolar: false }),
    computeChart({ clock: { y: 1986, m: 9, d: 12, hh: 9, mi: 30 }, gender: '坤', trueSolar: false }),
    computeChart({ clock: { y: 1993, m: 4, d: 4, hh: 23, mi: 30 }, gender: '乾', trueSolar: false }),
    computeChart({ clock: { y: 1998, m: 10, d: 5, hh: 8, mi: 0 }, gender: '坤', lon: 121.47 }),
    computeChart({ clock: { y: 2002, m: 2, d: 4, hh: 22, mi: 0 }, gender: '乾', trueSolar: false }),
    computeChart({ clock: { y: 1961, m: 12, d: 31, hh: 3, mi: 15 }, gender: '坤', trueSolar: false }),
  ]

  it('完整性：六张盘全列输出的每个神煞都在目录里（总览不会漏项）', () => {
    for (const c of charts) {
      const catalog = new Set(
        shenShaOrigins(shenShaContextOf(c, '乾')).flatMap((g) => g.items.map((i) => i.name)),
      )
      for (const name of allNames(c)) expect(catalog.has(name), name).toBe(true)
    }
  })

  it('S1 盘抽查：位与引擎锁值一致（乙丑 己卯 丙午 癸巳，合成样本）', () => {
    const c = charts[0]
    const groups = shenShaOrigins(shenShaContextOf(c, '乾'))
    const pos = (name: string) => groups.flatMap((g) => g.items).find((i) => i.name === name)!.pos
    expect(pos('红鸾')).toBe('寅') // 丑年红鸾在寅
    expect(pos('羊刃')).toBe('午') // 丙日羊刃午
    expect(pos('飞刃')).toContain('子') // 羊刃对冲
    expect(pos('勾绞煞')).toContain('辰') // 丑+3
    expect(pos('天德贵人')).toBe('申') // 卯月天德申
    expect(pos('德秀贵人')).toContain('甲乙丁壬')
    expect(pos('天乙贵人')).toContain('酉') // 丙→亥酉
    expect(pos('天乙贵人')).toContain('亥')
    expect(pos('空亡')).toContain('寅卯（日柱丙午旬）')
    expect(pos('空亡')).toContain('戌亥（年柱乙丑旬）')
    expect(pos('正词馆')).toContain('壬申') // 干支正配
    expect(pos('地网')).toContain('辰巳')
    expect(pos('天罗')).toContain('戌亥')
    expect(pos('将星')).toContain('午')
  })

  it('位与命中列自洽：年支起组的单支位神煞，支相符的流年其神煞行确实含该神煞', () => {
    const c = charts[0]
    const groups = shenShaOrigins(shenShaContextOf(c, '乾'))
    const yearGroup = groups.find((g) => g.title.startsWith('以年支'))!
    const hongLuan = yearGroup.items.find((i) => i.name === '红鸾')!
    // 扫全部流年找支＝红鸾位（寅）的年，其神煞行必含红鸾（位目录与明细表输出不漂移）
    const all = [...c.preYun.liuNian, ...c.daYun.flatMap((d) => d.liuNian)]
    const hit = all.find((l) => l.detail.branch === hongLuan.pos)!
    expect(hit).toBeTruthy()
    expect(hit.detail.shenSha).toContain('红鸾')
  })

  it('岁前十二神仍按年支起太岁顺行（总览六壬行）', () => {
    expect(suiQianShiErShen('卯', '卯')).toBe('太岁')
    expect(suiQianShiErShen('卯', '酉')).toBe('岁破')
  })
})
