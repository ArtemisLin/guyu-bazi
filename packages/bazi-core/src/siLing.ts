import { SolarTerm, SolarTime } from 'tyme4ts'
import { ClockTime } from './trueSolar'

/**
 * 人元司令分野（渊海子平标准表，问真七样本全部吻合，见 docs/08）。
 * 申月首段问真显示「戊己」双字（G5 实证），照抄。
 */
const TABLE: Record<string, Array<[number, string]>> = {
  寅: [[7, '戊'], [7, '丙'], [16, '甲']],
  卯: [[10, '甲'], [20, '乙']],
  辰: [[9, '乙'], [3, '癸'], [18, '戊']],
  巳: [[5, '戊'], [9, '庚'], [16, '丙']],
  午: [[10, '丙'], [9, '己'], [11, '丁']],
  未: [[9, '丁'], [3, '乙'], [18, '己']],
  申: [[7, '戊己'], [3, '壬'], [20, '庚']],
  酉: [[10, '庚'], [20, '辛']],
  戌: [[9, '辛'], [3, '丁'], [18, '戊']],
  亥: [[7, '戊'], [5, '甲'], [18, '壬']],
  子: [[10, '壬'], [20, '癸']],
  丑: [[9, '癸'], [3, '辛'], [18, '己']],
}

/** 月支 → 该月之节 */
const MONTH_TERM: Record<string, string> = {
  寅: '立春', 卯: '惊蛰', 辰: '清明', 巳: '立夏', 午: '芒种', 未: '小暑',
  申: '立秋', 酉: '白露', 戌: '寒露', 亥: '立冬', 子: '大雪', 丑: '小寒',
}

const toMs = (s: SolarTime) =>
  Date.UTC(s.getYear(), s.getMonth() - 1, s.getDay(), s.getHour(), s.getMinute(), s.getSecond())

/**
 * 司令用事之干。
 * @param monthBranchName 月柱地支
 * @param birth 出生时刻（与排盘同基准：开真太阳时则为换算后时刻）
 */
export function siLing(monthBranchName: string, birth: ClockTime): { name: string; elapsedDays: number } {
  const termName = MONTH_TERM[monthBranchName]
  let term = SolarTerm.fromName(birth.y, termName)
  const birthMs = Date.UTC(birth.y, birth.m - 1, birth.d, birth.hh, birth.mi, birth.ss ?? 0)
  if (toMs(term.getJulianDay().getSolarTime()) > birthMs) {
    term = SolarTerm.fromName(birth.y - 1, termName)
  }
  const elapsedDays = (birthMs - toMs(term.getJulianDay().getSolarTime())) / 86400000
  let cum = 0
  for (const [days, stem] of TABLE[monthBranchName]) {
    cum += days
    if (elapsedDays < cum) return { name: stem, elapsedDays }
  }
  const last = TABLE[monthBranchName][TABLE[monthBranchName].length - 1]
  return { name: last[1], elapsedDays }
}
