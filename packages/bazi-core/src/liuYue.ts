import { SixtyCycle, SolarTerm } from 'tyme4ts'
import { BRANCHES, MONTH_TERMS, STEMS, WUHU, WUSHU } from './ganzhi'

export interface LiuYueItem {
  term: string
  /** 交节公历月/日 */
  month: number
  day: number
  ganZhi: string
}

/** 某流年的十二流月（按节气，小寒落在次年一月） */
export function liuYue(yearGanZhi: string, year: number): LiuYueItem[] {
  const start = SixtyCycle.fromName(WUHU[yearGanZhi.charAt(0)] + '寅')
  return MONTH_TERMS.map((name, i) => {
    const termYear = name === '小寒' ? year + 1 : year
    const s = SolarTerm.fromName(termYear, name).getJulianDay().getSolarTime()
    return { term: name, month: s.getMonth(), day: s.getDay(), ganZhi: start.next(i).getName() }
  })
}

export interface LiuRiItem {
  /** 公历年月日（小寒月会跨入次年） */
  y: number
  month: number
  day: number
  /** 农历日名，如「廿八」（问真流日格显示） */
  lunar: string
  ganZhi: string
}

/** 某流月（节气月）内的逐日流日：交节当日起，至下一节交节时刻所在日止（首尾边界日均含） */
export function liuRi(termYear: number, term: string): LiuRiItem[] {
  const jie = SolarTerm.fromName(termYear, term)
  const start = jie.getJulianDay().getSolarTime()
  const end = jie.next(2).getJulianDay().getSolarTime()
  const dayKey = (y: number, m: number, d: number) => (y * 100 + m) * 100 + d
  // 下一节恰在 00:00:00 交接时，该日整日已属下月，不收
  const endKey = dayKey(end.getYear(), end.getMonth(), end.getDay()) +
    (end.getHour() || end.getMinute() || end.getSecond() ? 1 : 0)
  const items: LiuRiItem[] = []
  for (let d = start.getSolarDay(); dayKey(d.getYear(), d.getMonth(), d.getDay()) < endKey; d = d.next(1)) {
    const ld = d.getLunarDay()
    items.push({ y: d.getYear(), month: d.getMonth(), day: d.getDay(), lunar: ld.getName(), ganZhi: ld.getSixtyCycle().getName() })
  }
  return items
}

export interface LiuShiItem {
  /** 时支：子 / 丑 … 亥 */
  label: string
  /** 时辰起始钟表时刻（问真流时格显示）；子时 23:00 跨自前一公历日（干支历十二时辰制） */
  start: string
  ganZhi: string
}

/**
 * 某流日的十二流时（黄金样本实证：12 格干支历制，子时起于前日 23:00，
 * 子时干按当日日干五鼠遁——丁亥日首格 23:00 庚子）
 */
export function liuShi(dayGanZhi: string): LiuShiItem[] {
  const zi = STEMS.indexOf(WUSHU[dayGanZhi.charAt(0)])
  return BRANCHES.map((b, i) => ({
    label: b,
    start: `${String((i * 2 + 23) % 24).padStart(2, '0')}:00`,
    ganZhi: STEMS[(zi + i) % 10] + b,
  }))
}
