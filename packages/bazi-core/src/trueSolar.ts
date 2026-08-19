/** 时钟时间（出生地当地钟表读数，不含时区语义） */
export interface ClockTime {
  y: number
  m: number
  d: number
  hh: number
  mi: number
  ss?: number
}

/**
 * 均时差（分钟），Spencer 1971 级数，精度约 ±0.5 分钟。
 * 真太阳时 = 平太阳时 + 均时差。
 */
export function equationOfTimeMinutes(y: number, m: number, d: number): number {
  const n = Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86400000) + 1
  const B = (2 * Math.PI * (n - 1)) / 365
  return (
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(B) -
      0.032077 * Math.sin(B) -
      0.014615 * Math.cos(2 * B) -
      0.04089 * Math.sin(2 * B))
  )
}

/** 钟表时间平移 deltaMin 分钟（跨日/跨月/跨年自动进退位） */
export function shiftClockMinutes(t: ClockTime, deltaMin: number): ClockTime {
  const ms = Date.UTC(t.y, t.m - 1, t.d, t.hh, t.mi, t.ss ?? 0) + Math.round(deltaMin * 60) * 1000
  const dt = new Date(ms)
  return {
    y: dt.getUTCFullYear(),
    m: dt.getUTCMonth() + 1,
    d: dt.getUTCDate(),
    hh: dt.getUTCHours(),
    mi: dt.getUTCMinutes(),
    ss: dt.getUTCSeconds(),
  }
}

/**
 * 钟表时间 → 真太阳时。
 * @param t 当地钟表时间
 * @param lonDeg 出生地经度（东经为正）
 * @param tzMeridianDeg 该钟表对应时区的标准经线（中国 120°E）
 */
export function toTrueSolar(t: ClockTime, lonDeg: number, tzMeridianDeg = 120): ClockTime {
  return shiftClockMinutes(t, (lonDeg - tzMeridianDeg) * 4 + equationOfTimeMinutes(t.y, t.m, t.d))
}

/**
 * 中国夏令时（1986–1991）实施区间 [起日 02:00, 止日 02:00)，按钟表本地时刻判定。
 * 起：当日 02:00 拨快至 03:00；止：当日 02:00（夏令时读数）拨回 01:00。
 * 区间表两处独立来源一致：IANA tzdata Asia/Shanghai（Rule PRC 1986–1991：
 * 1986 首年 5/4 起，1987–1991 起＝4 月 10 日起第一个周日、止＝9 月 11 日起第一个周日）
 * × 国务院历年公布的夏时制起止日。
 */
const CN_DST: ReadonlyArray<[number, number, number, number, number]> = [
  // [年, 起月, 起日, 止月, 止日]
  [1986, 5, 4, 9, 14],
  [1987, 4, 12, 9, 13],
  [1988, 4, 10, 9, 11],
  [1989, 4, 16, 9, 17],
  [1990, 4, 15, 9, 16],
  [1991, 4, 14, 9, 15],
]

/** 该钟表时刻是否落在中国夏令时区间（录入层据此显示「夏令时」确认项） */
export function inChinaDst(t: ClockTime): boolean {
  const row = CN_DST.find((r) => r[0] === t.y)
  if (!row) return false
  const key = (m: number, d: number, hh: number, mi: number) => ((m * 100 + d) * 100 + hh) * 100 + mi
  const k = key(t.m, t.d, t.hh, t.mi)
  return k >= key(row[1], row[2], 2, 0) && k < key(row[3], row[4], 2, 0)
}

export function formatClock(t: ClockTime): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${t.y}-${p(t.m)}-${p(t.d)} ${p(t.hh)}:${p(t.mi)}`
}
