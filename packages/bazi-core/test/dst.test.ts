import { describe, expect, it } from 'vitest'
import { inChinaDst } from '../src/trueSolar'
import { computeChart } from '../src/chart'

describe('中国夏令时 1986–1991（两源：IANA tzdata PRC 规则 × 国务院历年公布起止日）', () => {
  it('六年起止日全表（起日 02:00 含、止日 02:00 不含）', () => {
    const table: Array<[number, number, number, number, number]> = [
      [1986, 5, 4, 9, 14],
      [1987, 4, 12, 9, 13],
      [1988, 4, 10, 9, 11],
      [1989, 4, 16, 9, 17],
      [1990, 4, 15, 9, 16],
      [1991, 4, 14, 9, 15],
    ]
    for (const [y, sm, sd, em, ed] of table) {
      expect(inChinaDst({ y, m: sm, d: sd, hh: 1, mi: 59 }), `${y} 起日 01:59`).toBe(false)
      expect(inChinaDst({ y, m: sm, d: sd, hh: 3, mi: 0 }), `${y} 起日 03:00`).toBe(true)
      expect(inChinaDst({ y, m: em, d: ed, hh: 1, mi: 59 }), `${y} 止日 01:59`).toBe(true)
      expect(inChinaDst({ y, m: em, d: ed, hh: 2, mi: 0 }), `${y} 止日 02:00`).toBe(false)
    }
  })

  it('区间外年份恒 false', () => {
    expect(inChinaDst({ y: 1985, m: 7, d: 1, hh: 12, mi: 0 })).toBe(false)
    expect(inChinaDst({ y: 1992, m: 7, d: 1, hh: 12, mi: 0 })).toBe(false)
    expect(inChinaDst({ y: 1988, m: 1, d: 15, hh: 12, mi: 0 })).toBe(false)
  })

  it('dst 排盘＝钟表减 1 小时（四柱与减后钟表盘逐柱一致）', () => {
    const a = computeChart({ clock: { y: 1988, m: 7, d: 15, hh: 11, mi: 30 }, gender: '坤', dst: true, trueSolar: false })
    const b = computeChart({ clock: { y: 1988, m: 7, d: 15, hh: 10, mi: 30 }, gender: '坤', trueSolar: false })
    expect(a.pillars).toEqual(b.pillars)
    expect(a.trueSolarClock.hh).toBe(10)
    // 11:30 夏令时读数＝标准时 10:30 巳时；不减则误作午时
    const c = computeChart({ clock: { y: 1988, m: 7, d: 15, hh: 11, mi: 30 }, gender: '坤', trueSolar: false })
    expect(a.detail.hour.branch).toBe('巳')
    expect(c.detail.hour.branch).toBe('午')
  })

  it('dst 与真太阳时叠加：先减 1 小时再做经度/均时差修正', () => {
    const a = computeChart({ clock: { y: 1990, m: 8, d: 1, hh: 12, mi: 0 }, lon: 116.407, gender: '乾', dst: true })
    const b = computeChart({ clock: { y: 1990, m: 8, d: 1, hh: 11, mi: 0 }, lon: 116.407, gender: '乾' })
    expect(a.trueSolarClock).toEqual(b.trueSolarClock)
    expect(a.pillars).toEqual(b.pillars)
  })
})
