import { EarthBranch, HeavenStem, SixtyCycle } from 'tyme4ts'
import { WUHU } from './ganzhi'

/**
 * 胎元 / 命宫 / 身宫 / 胎息。
 * 公式由内部黄金样本六例反推并全部验证：
 * - 胎元 = 月干进一位、月支进三位
 * - 命宫 = 寅起「节气月」序 + 寅起时支序，和<14 取 14−和、≥14 取 26−和，得支；年干五虎遁定干
 * - 身宫 = 子起月支序 + 子起时支序之和（mod 12）得支；年干五虎遁定干
 * - 胎息 = 日干五合之干 + 日支六合之支
 */

function stemByFiveTigers(yearStem: HeavenStem, branch: EarthBranch): HeavenStem {
  const start = HeavenStem.fromName(WUHU[yearStem.getName()])
  const steps = (branch.getIndex() - EarthBranch.fromName('寅').getIndex() + 12) % 12
  return start.next(steps)
}

/** 寅起序：寅=1 … 丑=12 */
const yinSeq = (b: EarthBranch) => ((b.getIndex() - 2 + 12) % 12) + 1
/** 子起序：子=1 … 亥=12 */
const ziSeq = (b: EarthBranch) => b.getIndex() + 1

export function taiYuan(month: SixtyCycle): SixtyCycle {
  return SixtyCycle.fromName(month.getHeavenStem().next(1).getName() + month.getEarthBranch().next(3).getName())
}

export function mingGong(yearStem: HeavenStem, monthBranch: EarthBranch, hourBranch: EarthBranch): SixtyCycle {
  const sum = yinSeq(monthBranch) + yinSeq(hourBranch)
  const g = sum < 14 ? 14 - sum : 26 - sum
  const branch = EarthBranch.fromIndex((g - 1 + 2) % 12)
  return SixtyCycle.fromName(stemByFiveTigers(yearStem, branch).getName() + branch.getName())
}

export function shenGong(yearStem: HeavenStem, monthBranch: EarthBranch, hourBranch: EarthBranch): SixtyCycle {
  const g = ((ziSeq(monthBranch) + ziSeq(hourBranch) - 1) % 12) + 1
  const branch = EarthBranch.fromIndex(g - 1)
  return SixtyCycle.fromName(stemByFiveTigers(yearStem, branch).getName() + branch.getName())
}

export function taiXi(day: SixtyCycle): SixtyCycle {
  return SixtyCycle.fromName(day.getHeavenStem().getCombine().getName() + day.getEarthBranch().getCombine().getName())
}
