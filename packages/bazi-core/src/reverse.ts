import { EightChar, SixtyCycle, SolarTerm, SolarTime } from 'tyme4ts'
import { ZiShiSect, withSect } from './chart'
import { shiftClockMinutes } from './trueSolar'
import { BRANCHES, JIAZI, MONTH_TERMS, STEMS, WUHU, WUSHU } from './ganzhi'
export { JIAZI }

export interface ReverseCandidate {
  y: number
  m: number
  d: number
  hh: number
  mi: number
  /** 如 1993-04-04 23:00 */
  solar: string
  /** 农历标签，如 七月廿九 */
  lunar: string
}

/**
 * 四柱反推公历生辰（对齐问真「四柱」录入模式，默认查找范围 1801–2099）。
 * 问真派晚子时（时柱＝子支＋次日子干）另走自研补偿扫描并入候选：
 * tyme getSolarTimes 的 d===30 月末回拨 bug 会丢晚子解（HANDOFF 坑10，
 * 审查实测：某晚子生辰的四柱反推丢失本人候选，已由补偿扫描修复并有回归测试）。
 */
export function reverseFourPillars(
  year: string,
  month: string,
  day: string,
  hour: string,
  opts?: { startYear?: number; endYear?: number; ziShiSect?: ZiShiSect },
): ReverseCandidate[] {
  const sect = opts?.ziShiSect ?? 'wenzhen'
  return withSect(sect, () => reverseFourPillarsInner(year, month, day, hour, sect, opts?.startYear ?? 1801, opts?.endYear ?? 2099))
}

function reverseFourPillarsInner(
  year: string, month: string, day: string, hour: string, sect: ZiShiSect, startYear: number, endYear: number,
): ReverseCandidate[] {
  const wenzhen = sect === 'wenzhen'
  const ec = new EightChar(year, month, day, hour)
  const p2 = (n: number) => String(n).padStart(2, '0')
  const mk = (st: SolarTime): ReverseCandidate => {
    const ld = st.getLunarHour().getLunarDay()
    return {
      y: st.getYear(), m: st.getMonth(), d: st.getDay(), hh: st.getHour(), mi: st.getMinute(),
      solar: `${st.getYear()}-${p2(st.getMonth())}-${p2(st.getDay())} ${p2(st.getHour())}:${p2(st.getMinute())}`,
      lunar: `${ld.getLunarMonth().getName()}${ld.getName()}`,
    }
  }
  const out = ec.getSolarTimes(startYear, endYear).map(mk)
  if (wenzhen) {
    // 按日去重：tyme 已给出某日晚子候选（含交节日它自己的分钟取整）时不再补塞，避免同日双候选
    const lateDays = new Set(out.filter((c) => c.hh === 23).map((c) => `${c.y}-${c.m}-${c.d}`))
    const seen = new Set(out.map((c) => c.solar))
    for (const d of wenzhenLateZiDays(year, month, day, hour, startYear, endYear)) {
      if (lateDays.has(`${d.y}-${d.m}-${d.d}`)) continue
      const c = mk(SolarTime.fromYmdHms(d.y, d.m, d.d, d.hh, d.mi, 0))
      if (!seen.has(c.solar)) {
        seen.add(c.solar)
        out.push(c)
      }
    }
    out.sort((a, b) => (a.solar < b.solar ? -1 : a.solar > b.solar ? 1 : 0))
  }
  return out
}

/**
 * 问真派晚子候选补偿：与 reverseDayOptions 同一套节气月窗口扫描，
 * 找出「日柱＝当日、晚子段（23–24 点）在窗内、次日日干五鼠遁子干＝所求时柱干」的日期。
 * 不依赖 tyme getSolarTimes，绕开其月末回拨丢解 bug。
 */
function wenzhenLateZiDays(
  yearGZ: string,
  monthGZ: string,
  dayGZ: string,
  hourGZ: string,
  startYear: number,
  endYear: number,
): Array<{ y: number; m: number; d: number; hh: number; mi: number }> {
  if (hourGZ.charAt(1) !== '子') return []
  const mIdx = (BRANCHES.indexOf(monthGZ.charAt(1)) - 2 + 12) % 12
  if (mIdx < 0 || STEMS[(STEMS.indexOf(WUHU[yearGZ.charAt(0)]) + mIdx) % 10] !== monthGZ.charAt(0)) return []
  const term = MONTH_TERMS[mIdx]
  const key = (y: number, m: number, d: number, hh: number) => ((y * 100 + m) * 100 + d) * 100 + hh
  const out: Array<{ y: number; m: number; d: number; hh: number; mi: number }> = []
  for (let y = startYear - 1; y <= endYear; y++) {
    if (SixtyCycle.fromIndex((((y - 1984) % 60) + 60) % 60).getName() !== yearGZ) continue
    const jie = SolarTerm.fromName(term === '小寒' ? y + 1 : y, term)
    const start = jie.getJulianDay().getSolarTime()
    if (start.getYear() < startYear) continue
    const end = jie.next(2).getJulianDay().getSolarTime()
    // 秒级比较：交节几乎总带秒，分钟截断会在交节恰落 23–24 点时漏/错判窗口边界（与 reverseDayOptions 同精度）
    const startKey = (key(start.getYear(), start.getMonth(), start.getDay(), start.getHour()) * 100 + start.getMinute()) * 100 + start.getSecond()
    const endKey = (key(end.getYear(), end.getMonth(), end.getDay(), end.getHour()) * 100 + end.getMinute()) * 100 + end.getSecond()
    for (let d = start.getSolarDay(); key(d.getYear(), d.getMonth(), d.getDay(), 0) * 10000 < endKey; d = d.next(1)) {
      const sc = d.getLunarDay().getSixtyCycle()
      if (sc.getName() !== dayGZ) continue
      // 晚子段 [23:00, 24:00) 须落在节气月窗口内
      const day23 = key(d.getYear(), d.getMonth(), d.getDay(), 23) * 10000
      const day24 = key(d.getYear(), d.getMonth(), d.getDay(), 24) * 10000
      if (!(Math.max(startKey, day23) < Math.min(endKey, day24))) continue
      // 问真派晚子时柱干＝次日日干的五鼠遁子干
      if (WUSHU[sc.next(1).getName().charAt(0)] !== hourGZ.charAt(0)) continue
      if (startKey > day23) {
        // 交节恰落在该日 23–24 点内：候选取交节时刻，秒非零向上取整到下一分钟
        // （截断会早于交节，用户按分钟复排得到前一个月柱）；进位越出 23 时段则该窗无法以分钟精度表示，弃
        let cand = { y: start.getYear(), m: start.getMonth(), d: start.getDay(), hh: start.getHour(), mi: start.getMinute() }
        if (start.getSecond() > 0) cand = shiftClockMinutes(cand, 1)
        if (cand.hh !== 23) continue
        out.push({ y: cand.y, m: cand.m, d: cand.d, hh: cand.hh, mi: cand.mi })
      } else {
        out.push({ y: d.getYear(), m: d.getMonth(), d: d.getDay(), hh: 23, mi: 0 })
      }
    }
  }
  return out
}


/** 给定年柱，按五虎遁返回该年 12 个月柱（寅月起顺行） */
export function reverseMonthOptions(yearGZ: string): string[] {
  const qi = STEMS.indexOf(WUHU[yearGZ.charAt(0)])
  return Array.from({ length: 12 }, (_, i) => STEMS[(qi + i) % 10] + BRANCHES[(i + 2) % 12])
}

/**
 * 给定日柱，按五鼠遁返回时柱选项：12 正时；不换日（问真）派另加「X子（晚）」（晚子时干＝次日子干）。
 * 换日派 23–24 点已是次日日柱＋正子时（当日日柱＋次日子干的组合无解），不出晚子项。
 */
export function reverseHourOptions(dayGZ: string, opts?: { ziShiSect?: ZiShiSect }): string[] {
  const zi = STEMS.indexOf(WUSHU[dayGZ.charAt(0)])
  const hs = Array.from({ length: 12 }, (_, i) => STEMS[(zi + i) % 10] + BRANCHES[i])
  if ((opts?.ziShiSect ?? 'wenzhen') === 'wenzhen') hs.push(WUSHU[STEMS[(STEMS.indexOf(dayGZ.charAt(0)) + 1) % 10]] + '子（晚）')
  return hs
}

/**
 * 给定年柱＋月柱，返回查找范围内实际出现过的日柱集合（甲子序），供四柱录入渐进过滤。
 * 逐个年柱出现年，取该节气月的精确窗口 [交节, 下一交节)，按日扫描：
 * 白天段（00:00–23:00）两派日柱同为当日；晚子段（23:00–24:00）问真派记当日、换日派记次日。
 * 年循环范围与 tyme getSolarTimes 一致（丑月窗口按交节公历年落在 [startYear, ∞) 判定）。
 */
export function reverseDayOptions(
  yearGZ: string,
  monthGZ: string,
  opts?: { startYear?: number; endYear?: number; ziShiSect?: ZiShiSect },
): string[] {
  const startYear = opts?.startYear ?? 1801
  const endYear = opts?.endYear ?? 2099
  const wenzhen = (opts?.ziShiSect ?? 'wenzhen') === 'wenzhen'
  const mIdx = (BRANCHES.indexOf(monthGZ.charAt(1)) - 2 + 12) % 12
  // 月干必须与年干五虎遁自洽，否则该年月组合不存在
  if (STEMS[(STEMS.indexOf(WUHU[yearGZ.charAt(0)]) + mIdx) % 10] !== monthGZ.charAt(0)) return []
  const term = MONTH_TERMS[mIdx]
  const key = (y: number, m: number, d: number, hh: number, mi: number, ss: number) =>
    (((y * 100 + m) * 100 + d) * 100 + hh) * 10000 + mi * 100 + ss
  const found = new Set<string>()
  for (let y = startYear - 1; y <= endYear; y++) {
    if (SixtyCycle.fromIndex((((y - 1984) % 60) + 60) % 60).getName() !== yearGZ) continue
    const jie = SolarTerm.fromName(term === '小寒' ? y + 1 : y, term)
    const start = jie.getJulianDay().getSolarTime()
    if (start.getYear() < startYear) continue
    const end = jie.next(2).getJulianDay().getSolarTime()
    const startKey = key(start.getYear(), start.getMonth(), start.getDay(), start.getHour(), start.getMinute(), start.getSecond())
    const endKey = key(end.getYear(), end.getMonth(), end.getDay(), end.getHour(), end.getMinute(), end.getSecond())
    for (let d = start.getSolarDay(); key(d.getYear(), d.getMonth(), d.getDay(), 0, 0, 0) < endKey; d = d.next(1)) {
      const sc = d.getLunarDay().getSixtyCycle()
      const day0 = key(d.getYear(), d.getMonth(), d.getDay(), 0, 0, 0)
      const day23 = key(d.getYear(), d.getMonth(), d.getDay(), 23, 0, 0)
      const day24 = key(d.getYear(), d.getMonth(), d.getDay(), 24, 0, 0)
      // 白天段 [00:00, 23:00)：日柱＝当日（两派同）
      if (Math.max(startKey, day0) < Math.min(endKey, day23)) found.add(sc.getName())
      // 晚子段 [23:00, 24:00)：问真派＝当日，换日派＝次日
      if (Math.max(startKey, day23) < Math.min(endKey, day24)) found.add(wenzhen ? sc.getName() : sc.next(1).getName())
    }
  }
  const idx = (gz: string) => (6 * STEMS.indexOf(gz.charAt(0)) - 5 * BRANCHES.indexOf(gz.charAt(1)) + 60) % 60
  return [...found].sort((a, b) => idx(a) - idx(b))
}
