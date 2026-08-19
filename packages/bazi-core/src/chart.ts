import {
  ChildLimit,
  DefaultEightCharProvider,
  Gender,
  HeavenStem,
  LunarHour,
  LunarSect2EightCharProvider,
  SixtyCycle,
  SolarTime,
} from 'tyme4ts'
import { ClockTime, shiftClockMinutes, toTrueSolar } from './trueSolar'
import { WenzhenChildLimitProvider } from './qiyun'
import { PillarDetail, pillarDetail } from './detail'
import { mingGong, shenGong, taiXi, taiYuan } from './mingGong'
import { siLing } from './siLing'
import { ColumnKind, queryShenSha, ShenShaContext } from './shensha'
import { mingGua } from './mingGua'

/**
 * 早晚子时流派：
 * - wenzhen 问真派：晚子时（23:00–24:00）日柱算当天，时柱用次日子时干（黄金样本 G1 实证）
 * - huanri  换日派：晚子时日柱算次日
 */
export type ZiShiSect = 'wenzhen' | 'huanri'

export interface ChartInput {
  clock: ClockTime
  /** 出生地经度（东经为正）。缺省 120 = 不做经度修正 */
  lon?: number
  gender: '乾' | '坤'
  /** 真太阳时开关，默认开 */
  trueSolar?: boolean
  /** 早晚子时流派，默认问真派 */
  ziShiSect?: ZiShiSect
  /** 输入钟表时为中国夏令时读数（1986–1991，inChinaDst 判窗）：先减 1 小时化为东八区标准时再排盘 */
  dst?: boolean
}

export interface ChartResult {
  /** 换算后的真太阳时（trueSolar=false 时等于输入钟表时间；dst 时已先减 1 小时） */
  trueSolarClock: ClockTime
  /**
   * 虚岁与流年锚定用的出生年＝真太阳时年。
   * 经度修正把出生时刻推过元旦时与钟表年差一年——大运/流年/小运/虚岁全部以本值为基准，
   * 两壳显示虚岁必须用它，不得再从输入日期取年（审查修复 2026-08-11）。
   */
  birthYear: number
  pillars: { year: string; month: string; day: string; hour: string }
  /** 四柱明细：主星/藏干副星/星运/自坐/空亡/纳音 */
  detail: { year: PillarDetail; month: PillarDetail; day: PillarDetail; hour: PillarDetail }
  /** 日主（日元天干） */
  dayMaster: string
  /** 胎元/命宫/身宫（含明细）与胎息 */
  taiMingShen: { taiYuan: PillarDetail; mingGong: PillarDetail; shenGong: PillarDetail; taiXi: string }
  /** 人元司令分野用事之干（问真式），如「戊」「戊己」 */
  siLing: string
  /** 二十八宿，如「亢」 */
  xingXiu: string
  /** 三元命卦（节气年），如 坎卦·东四命 */
  mingGua: { name: string; group: '东四命' | '西四命' }
  /** 农历标签，如「2004年闰二月廿一」 */
  lunarLabel: string
  /** 大运顺排（true）/ 逆排（false） */
  fortuneForward: boolean
  /** 起运后前 n 步大运干支 */
  decadeFortunes: string[]
  /** 起运数：X年X月X天X时 */
  childLimit: { year: number; month: number; day: number; hour: number; minute: number }
  /** 交运（起运）时间，如 1989-04-26 */
  qiYunDate: string
  /** 大运列表（含每运明细与神煞、10 个流年） */
  daYun: DaYunItem[]
  /** 起运前的小运期（交运年＝出生年时流年列表为空） */
  preYun: XiaoYunPeriod
}

export interface LiuNianItem {
  year: number
  ganZhi: string
  /**
   * 该流年的小运干支：时柱起、虚岁步进、方向同大运（阳男阴女顺、阴男阳女逆）。
   * 内部黄金样本三盘（阴男逆／阴女顺／阳男顺）28 个小运值全部命中。
   */
  xiaoYun: string
  detail: PillarDetail
}

export interface DaYunItem {
  ganZhi: string
  /** 交运年（虚岁 startAge 对应的公历年） */
  startYear: number
  startAge: number
  detail: PillarDetail
  liuNian: LiuNianItem[]
}

/** 起运前的小运期（问真大运条首格「1~N岁 小运」；流年为出生年至交运前一年） */
export interface XiaoYunPeriod {
  startYear: number
  /** 1~N岁 的 N＝首步大运虚岁 */
  endAge: number
  liuNian: LiuNianItem[]
}

/** 从排盘结果重建神煞上下文（与 computeChart 内部 ssCtx 同构） */
export function shenShaContextOf(
  chart: Pick<ChartResult, 'dayMaster' | 'detail'>,
  gender: '乾' | '坤',
): ShenShaContext {
  return {
    yearGan: chart.detail.year.stem,
    yearZhi: chart.detail.year.branch,
    monthZhi: chart.detail.month.branch,
    dayGan: chart.dayMaster,
    dayZhi: chart.detail.day.branch,
    hourGan: chart.detail.hour.stem,
    hourZhi: chart.detail.hour.branch,
    gender,
    yearNaYin: chart.detail.year.naYin,
  }
}

/**
 * 岁运/流钻取列明细：给定干支按「岁运通用列」语义生成明细＋神煞。
 * 黄金样本实证：流月/流日/流时神煞与流年同一套规则（同干支的流时列与流年列逐字相同）。
 */
export function suiYunDetail(
  ganZhi: string,
  chart: Pick<ChartResult, 'dayMaster' | 'detail'>,
  gender: '乾' | '坤',
  kind: ColumnKind = 'liunian',
): PillarDetail {
  const d = pillarDetail(SixtyCycle.fromName(ganZhi), HeavenStem.fromName(chart.dayMaster))
  d.shenSha = queryShenSha(ganZhi.charAt(0), ganZhi.charAt(1), kind, shenShaContextOf(chart, gender))
  return d
}

/** 节气年数字（立春界）：年柱干支与公历年对齐则为当年，否则为前一年 */
function jieQiYear(t: ClockTime, yearPillar: string): number {
  const sc = SixtyCycle.fromIndex((((t.y - 1984) % 60) + 60) % 60)
  return sc.getName() === yearPillar ? t.y : t.y - 1
}

/**
 * tyme4ts 的流派 Provider 与我们两派的映射（由黄金测试 G1/G2 锁定）。
 * ⚠ LunarHour.provider / ChildLimit.provider 是 tyme4ts 的**模块级全局**——排盘期间改写、结束后必须恢复
 * （withSect），否则任何直接调 tyme EightChar 的新代码都会静默继承「上一次排盘用的流派」（审查修复 2026-08-18）。
 */
export function withSect<T>(sect: ZiShiSect, fn: () => T): T {
  const prevHour = LunarHour.provider
  const prevChild = ChildLimit.provider
  LunarHour.provider = sect === 'wenzhen' ? new LunarSect2EightCharProvider() : new DefaultEightCharProvider()
  ChildLimit.provider = new WenzhenChildLimitProvider()
  try {
    return fn()
  } finally {
    LunarHour.provider = prevHour
    ChildLimit.provider = prevChild
  }
}

export function computeChart(input: ChartInput): ChartResult {
  return withSect(input.ziShiSect ?? 'wenzhen', () => computeChartInner(input))
}

function computeChartInner(input: ChartInput): ChartResult {
  const useTrueSolar = input.trueSolar !== false
  const lon = input.lon ?? 120
  // 夏令时读数先减 1 小时化为标准时（1986–1991，录入层按 inChinaDst 判窗后置 dst）
  const clock = input.dst ? shiftClockMinutes(input.clock, -60) : input.clock
  const t = useTrueSolar ? toTrueSolar(clock, lon) : { ...clock }

  const st = SolarTime.fromYmdHms(t.y, t.m, t.d, t.hh, t.mi, t.ss ?? 0)
  const lh = st.getLunarHour()
  const ec = lh.getEightChar()

  const gender = input.gender === '乾' ? Gender.MAN : Gender.WOMAN
  const cl = ChildLimit.fromSolarTime(st, gender)
  const dayMaster = ec.getDay().getHeavenStem()

  const ssCtx: ShenShaContext = {
    yearGan: ec.getYear().getHeavenStem().getName(),
    yearZhi: ec.getYear().getEarthBranch().getName(),
    monthZhi: ec.getMonth().getEarthBranch().getName(),
    dayGan: dayMaster.getName(),
    dayZhi: ec.getDay().getEarthBranch().getName(),
    hourGan: ec.getHour().getHeavenStem().getName(),
    hourZhi: ec.getHour().getEarthBranch().getName(),
    gender: input.gender,
    yearNaYin: ec.getYear().getSound().getName(),
  }
  const det = (sc: SixtyCycle, kind: ColumnKind, opts?: { isDayPillar?: boolean; gender?: '乾' | '坤' }) => {
    const d = pillarDetail(sc, dayMaster, opts)
    d.shenSha = queryShenSha(d.stem, d.branch, kind, ssCtx)
    return d
  }
  const sixtyOfYear = (y: number) => SixtyCycle.fromIndex((((y - 1984) % 60) + 60) % 60)

  // 出生年＝真太阳时年（非钟表年）：经度修正跨过元旦时两者差一年，
  // 大运 startYear/虚岁/小运/preYun 与 tyme 起运（同样基于真太阳时）必须同基准，
  // 否则交运日期与首步大运年份会自相矛盾（审查实测复现：1990-01-01 00:05 成都）
  const birthYear = t.y
  // 小运：时柱起、虚岁步进、方向同大运（内部黄金样本三盘实证）
  const hourSC = ec.getHour()
  const xiaoYunOf = (year: number) => hourSC.next((cl.isForward() ? 1 : -1) * (year - birthYear + 1)).getName()
  const liuNianItem = (year: number): LiuNianItem => {
    const sc = sixtyOfYear(year)
    return { year, ganZhi: sc.getName(), xiaoYun: xiaoYunOf(year), detail: det(sc, 'liunian') }
  }
  const fortunes: string[] = []
  const daYun: DaYunItem[] = []
  let df = cl.getStartDecadeFortune()
  // 20 步大运（约 200 岁）：看古盘时可一路顺推（用户 2026-07-31 要求）
  for (let i = 0; i < 20; i++) {
    const gzName = df.getName()
    fortunes.push(gzName)
    const startAge = df.getStartAge()
    const startYear = birthYear + startAge - 1
    const liuNian: LiuNianItem[] = []
    for (let k = 0; k < 10; k++) liuNian.push(liuNianItem(startYear + k))
    daYun.push({ ganZhi: gzName, startYear, startAge, detail: det(df.getSixtyCycle(), 'dayun'), liuNian })
    df = df.next(1)
  }
  fortunes.length = 10
  // 小运期至少含出生年：交运年=出生年时问真仍显示「0岁小运」期、流年为出生年（G5 第二批截图实证）
  const preYunNian: LiuNianItem[] = []
  for (let y = birthYear; y < Math.max(birthYear + 1, daYun[0].startYear); y++) preYunNian.push(liuNianItem(y))
  const endT = cl.getEndTime()
  const p2 = (n: number) => String(n).padStart(2, '0')
  const qiYunDate = `${endT.getYear()}-${p2(endT.getMonth())}-${p2(endT.getDay())}`

  const ld = lh.getLunarDay()
  const tyGZ = taiYuan(ec.getMonth())
  const mgGZ = mingGong(ec.getYear().getHeavenStem(), ec.getMonth().getEarthBranch(), ec.getHour().getEarthBranch())
  const sgGZ = shenGong(ec.getYear().getHeavenStem(), ec.getMonth().getEarthBranch(), ec.getHour().getEarthBranch())
  return {
    trueSolarClock: t,
    birthYear,
    pillars: {
      year: ec.getYear().getName(),
      month: ec.getMonth().getName(),
      day: ec.getDay().getName(),
      hour: ec.getHour().getName(),
    },
    detail: {
      year: det(ec.getYear(), 'year'),
      month: det(ec.getMonth(), 'month'),
      day: det(ec.getDay(), 'day', { isDayPillar: true, gender: input.gender }),
      hour: det(ec.getHour(), 'hour'),
    },
    dayMaster: dayMaster.getName(),
    taiMingShen: {
      taiYuan: det(tyGZ, 'gong'),
      mingGong: det(mgGZ, 'gong'),
      shenGong: det(sgGZ, 'gong'),
      taiXi: taiXi(ec.getDay()).getName(),
    },
    siLing: siLing(ec.getMonth().getEarthBranch().getName(), t).name,
    xingXiu: ld.getTwentyEightStar().getName(),
    mingGua: mingGua(jieQiYear(t, ec.getYear().getName()), input.gender),
    lunarLabel: `${ld.getLunarMonth().getYear()}年${ld.getLunarMonth().getName()}${ld.getName()}`,
    fortuneForward: cl.isForward(),
    decadeFortunes: fortunes,
    qiYunDate,
    daYun,
    preYun: { startYear: birthYear, endAge: daYun[0].startAge, liuNian: preYunNian },
    childLimit: {
      year: cl.getYearCount(),
      month: cl.getMonthCount(),
      day: cl.getDayCount(),
      hour: cl.getHourCount(),
      minute: cl.getMinuteCount(),
    },
  }
}
