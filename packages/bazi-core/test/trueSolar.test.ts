import { describe, expect, it } from 'vitest'
import { shiftClockMinutes, toTrueSolar } from '../src/trueSolar'
import { computeChart } from '../src/chart'

describe('真太阳时跨日/跨年边界（审查修复 2026-08-11：此前零直接覆盖）', () => {
  it('shiftClockMinutes 跨年进退位', () => {
    expect(shiftClockMinutes({ y: 1990, m: 1, d: 1, hh: 0, mi: 30 }, -60)).toMatchObject({ y: 1989, m: 12, d: 31, hh: 23, mi: 30 })
    expect(shiftClockMinutes({ y: 1989, m: 12, d: 31, hh: 23, mi: 30 }, 60)).toMatchObject({ y: 1990, m: 1, d: 1, hh: 0, mi: 30 })
  })

  it('经度西移跨年：1990-01-01 00:05 成都（104.07°E）→ 真太阳时 1989-12-31', () => {
    const t = toTrueSolar({ y: 1990, m: 1, d: 1, hh: 0, mi: 5 }, 104.07)
    expect([t.y, t.m, t.d]).toEqual([1989, 12, 31])
  })

  it('经度东移跨日：黑河以东 23:58 推入次日', () => {
    const t = toTrueSolar({ y: 2000, m: 6, d: 15, hh: 23, mi: 58 }, 135)
    expect([t.m, t.d]).toEqual([6, 16])
  })
})

describe('跨年盘的大运锚定（审查实测复现的 off-by-one 修复）', () => {
  it('1990-01-01 00:05 成都：birthYear＝真太阳时年，首步大运年份与交运日期同基准', () => {
    const c = computeChart({ clock: { y: 1990, m: 1, d: 1, hh: 0, mi: 5 }, lon: 104.07, gender: '乾' })
    expect(c.trueSolarClock.y).toBe(1989)
    expect(c.birthYear).toBe(1989)
    // 修复前：qiYunDate=1998-03-01 而 daYun[0].startYear=1999，同屏自相矛盾
    expect(c.daYun[0].startYear).toBe(Number(c.qiYunDate.slice(0, 4)))
    expect(c.preYun.startYear).toBe(1989)
    if (c.preYun.liuNian.length) expect(c.preYun.liuNian[0].year).toBe(1989)
  })

  it('不跨年的盘 birthYear＝钟表年（黄金样本基准不受影响）', () => {
    const c = computeChart({ clock: { y: 1986, m: 3, d: 15, hh: 9, mi: 37 }, gender: '坤', trueSolar: false })
    expect(c.birthYear).toBe(1986)
  })
})

describe('tyme4ts 全局 provider 不被排盘副作用污染（审查修复 2026-08-18）', () => {
  it('computeChart / reverseFourPillars 结束后 LunarHour.provider 与 ChildLimit.provider 恢复原值', async () => {
    const { LunarHour, ChildLimit } = await import('tyme4ts')
    const { reverseFourPillars } = await import('../src/reverse')
    const h0 = LunarHour.provider, c0 = ChildLimit.provider
    computeChart({ clock: { y: 1986, m: 3, d: 15, hh: 9, mi: 37 }, gender: '坤', ziShiSect: 'huanri', trueSolar: false })
    expect(LunarHour.provider).toBe(h0)
    expect(ChildLimit.provider).toBe(c0)
    reverseFourPillars('丙寅', '辛卯', '戊辰', '丁巳', { ziShiSect: 'huanri', startYear: 1980, endYear: 1990 })
    expect(LunarHour.provider).toBe(h0)
    // 两派交错排盘互不污染：同一生辰先 huanri 再 wenzhen，结果与单独排一致
    const a = computeChart({ clock: { y: 1986, m: 6, d: 18, hh: 23, mi: 30 }, gender: '坤', ziShiSect: 'huanri', trueSolar: false })
    const b = computeChart({ clock: { y: 1986, m: 6, d: 18, hh: 23, mi: 30 }, gender: '坤', ziShiSect: 'wenzhen', trueSolar: false })
    expect(a.pillars.day).not.toBe(b.pillars.day)
  })
})
