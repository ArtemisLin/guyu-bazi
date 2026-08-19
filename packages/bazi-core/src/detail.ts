import { EarthBranch, HeavenStem, SixtyCycle } from 'tyme4ts'
import { BRANCHES, STEMS } from './ganzhi'

export interface HiddenStem {
  stem: string
  /** 副星：藏干相对日主的十神 */
  tenStar: string
  type: '本气' | '中气' | '余气'
}

/** 单柱明细（四柱/大运/流年/流月/胎元/命宫/身宫通用） */
export interface PillarDetail {
  ganZhi: string
  stem: string
  branch: string
  /** 主星：天干相对日主的十神；日柱为 元男/元女 */
  mainStar: string
  hiddenStems: HiddenStem[]
  /** 星运：日主在该支的十二长生 */
  stage: string
  /** 自坐：本柱天干在本柱地支的十二长生 */
  selfSit: string
  /** 空亡（旬空），如「申酉」 */
  voidBranches: string
  naYin: string
  /** 本柱神煞（由 chart 层按列位注入） */
  shenSha: string[]
}

export function pillarDetail(
  sc: SixtyCycle,
  dayMaster: HeavenStem,
  opts?: { isDayPillar?: boolean; gender?: '乾' | '坤' },
): PillarDetail {
  const stem = sc.getHeavenStem()
  const branch = sc.getEarthBranch()
  const hidden: HiddenStem[] = []
  const push = (h: HeavenStem | null, type: HiddenStem['type']) => {
    if (h) hidden.push({ stem: h.getName(), tenStar: dayMaster.getTenStar(h).getName(), type })
  }
  push(branch.getHideHeavenStemMain(), '本气')
  push(branch.getHideHeavenStemMiddle(), '中气')
  push(branch.getHideHeavenStemResidual(), '余气')
  return {
    ganZhi: sc.getName(),
    stem: stem.getName(),
    branch: branch.getName(),
    mainStar: opts?.isDayPillar
      ? opts.gender === '坤'
        ? '元女'
        : '元男'
      : dayMaster.getTenStar(stem).getName(),
    hiddenStems: hidden,
    stage: dayMaster.getTerrain(branch).getName(),
    selfSit: stem.getTerrain(branch).getName(),
    voidBranches: sc
      .getExtraEarthBranches()
      .map((b) => b.getName())
      .join(''),
    naYin: sc.getSound().getName(),
    shenSha: [],
  }
}

/** 十二长生阶段序（长生→养），总表列头用 */
export const CHANG_SHENG_STAGES = ['长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝', '胎', '养']

export interface ChangShengRow {
  /** 同表天干合并（火土同宫 → 丙戊/丁己），按行内容相同自动归并 */
  gans: string
  /** 十二地支按阶段序排列（长生位→养位） */
  zhis: string[]
}

/**
 * 十二长生总表：与明细表星运/自坐行同一函数（tyme getTerrain，阳顺阴逆、火土同宫）生成，
 * 不另抄表——盘面与总表永远同源。行内容相同的天干自动合并（当前即丙戊/丁己两组）。
 */
export function changShengTable(): ChangShengRow[] {
  const rows: ChangShengRow[] = []
  for (const g of STEMS) {
    const byStage = new Map<string, string>()
    for (const z of BRANCHES) {
      byStage.set(HeavenStem.fromName(g).getTerrain(EarthBranch.fromName(z)).getName(), z)
    }
    const zhis = CHANG_SHENG_STAGES.map((s) => byStage.get(s) ?? '—')
    const same = rows.find((r) => r.zhis.join('') === zhis.join(''))
    if (same) same.gans += g
    else rows.push({ gans: g, zhis })
  }
  return rows
}
