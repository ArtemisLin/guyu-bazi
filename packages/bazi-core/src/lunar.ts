import { LunarHour, LunarMonth, LunarYear, SolarDay } from 'tyme4ts'

export interface LunarMonthOption {
  /** 与 tyme 一致：闰月为负数（2004 年闰二月 = -2） */
  month: number
  /** 正月 / 二月 / 闰二月 … */
  name: string
}

/** 某农历年的月份列表（按年内顺序，闰月插在原月之后） */
export function lunarMonthsOf(year: number): LunarMonthOption[] {
  return LunarYear.fromYear(year).getMonths().map((m) => ({ month: m.getMonthWithLeap(), name: m.getName() }))
}

/** 某农历月的日名列表（初一…廿九/三十），下标+1 = 日序 */
export function lunarDaysOf(year: number, month: number): string[] {
  return LunarMonth.fromYm(year, month).getDays().map((d) => d.getName())
}

/** 公历日期 → 农历年月日（month 负数=闰月；农历录入切换时预填用） */
export function solarToLunar(y: number, m: number, d: number): { y: number; m: number; d: number } {
  const ld = SolarDay.fromYmd(y, m, d).getLunarDay()
  return { y: ld.getYear(), m: ld.getLunarMonth().getMonthWithLeap(), d: ld.getDay() }
}

/** 农历生辰 → 公历钟表时间。month 负数=闰月；23 时（晚子）不换公历日，与问真录入一致（G1 实证） */
export function lunarToSolar(
  year: number, month: number, day: number, hh: number, mi: number,
): { y: number; m: number; d: number; hh: number; mi: number } {
  const st = LunarHour.fromYmdHms(year, month, day, hh, mi, 0).getSolarTime()
  return { y: st.getYear(), m: st.getMonth(), d: st.getDay(), hh: st.getHour(), mi: st.getMinute() }
}
