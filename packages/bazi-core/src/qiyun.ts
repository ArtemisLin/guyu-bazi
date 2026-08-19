import { AbstractChildLimitProvider, ChildLimitInfo, SolarTerm, SolarTime } from 'tyme4ts'

/**
 * 问真式起运数：出生到相邻节（顺排取未来节、逆排取过去节，由 ChildLimit 调用方向决定传入的 term）
 * 的精确时距，按古法折算——3日=1年、1日=4月（即6小时=1月）、1时辰=10天（即12分钟=1天）、30秒=1小时，
 * 每级向下取整。由黄金样本 G1/G2/G4 逐秒校准（见 docs/06、docs/08 校准记录）。
 */
export class WenzhenChildLimitProvider extends AbstractChildLimitProvider {
  getInfo(birthTime: SolarTime, term: SolarTerm): ChildLimitInfo {
    const t = term.getJulianDay().getSolarTime()
    const toSec = (s: SolarTime) =>
      Date.UTC(s.getYear(), s.getMonth() - 1, s.getDay(), s.getHour(), s.getMinute(), s.getSecond()) / 1000
    let rem = Math.abs(toSec(t) - toSec(birthTime))
    const YEAR = 259200 // 3日
    const MONTH = 21600 // 6小时
    const DAY = 720 // 12分钟
    const HOUR = 30 // 30秒
    const year = Math.floor(rem / YEAR)
    rem -= year * YEAR
    const month = Math.floor(rem / MONTH)
    rem -= month * MONTH
    const day = Math.floor(rem / DAY)
    rem -= day * DAY
    const hour = Math.floor(rem / HOUR)
    return this.next(birthTime, year, month, day, hour, 0, 0)
  }
}
