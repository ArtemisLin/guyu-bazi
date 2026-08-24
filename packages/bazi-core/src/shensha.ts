/**
 * 神煞模块（问真对齐版）。
 * 规则底稿：reference/shensha-chxb.js（MIT，吉时雨验证）；
 * 与问真的差异已按黄金样本逐格修正（docs/06、docs/08）：
 * - 德秀贵人：按「本柱天干 ∈ 月支三合局之德/秀干集合」判（chxb 原实现为全局判，与问真不符）
 * - 学堂/词馆：地支合为学堂/词馆，干支全合为正学堂/正词馆；日柱也查（chxb 原排除日柱，与 G1 不符）
 * - 天罗地网：查法一（年/日支见对支，标「天罗地网」）＋查法二（年纳音命：火命日支/宫位支戌亥标「天罗」，
 *   水土命辰巳标「地网」，仅日柱与胎命身宫位）并存
 * - 新增：勾绞煞（年支前后三辰）、六秀日
 */

import { BRANCHES, STEMS, bAdd, bi, si } from './ganzhi'
export { BRANCHES, STEMS, bAdd, bi, si }
import { JIESHA, HUAGAI, JIANGXING, LUSHEN, SUI_QIAN, TAOHUA, TIANDE, TIANSHE, WENCHANG, YIMA, YUEDE, tianMa, xunKong, xunShou, suiQianShiErShen } from './tables'
export { JIESHA, HUAGAI, JIANGXING, LUSHEN, SUI_QIAN, TAOHUA, TIANDE, TIANSHE, WENCHANG, YIMA, YUEDE, tianMa, xunKong, xunShou, suiQianShiErShen }
const isYangStem = (g: string) => si(g) % 2 === 0
const EARTH_BRANCHES = new Set(['丑', '辰', '未', '戌'])

export type ColumnKind = 'year' | 'month' | 'day' | 'hour' | 'dayun' | 'xiaoyun' | 'liunian' | 'liuyue' | 'liuri' | 'liushi' | 'gong'

export interface ShenShaContext {
  yearGan: string
  yearZhi: string
  monthZhi: string
  dayGan: string
  dayZhi: string
  hourGan: string
  hourZhi: string
  gender: '乾' | '坤'
  /** 年柱纳音，如「炉中火」 */
  yearNaYin: string
}



// ———— 查表 ————
// 天乙：庚行取「甲戊庚牛羊」（丑未）——2026-07-31 审查以 7 处黄金格实证修正（chxb 底稿误作午寅；辛=午寅由 G1 实证保留）
const TIANYI: Record<string, string[]> = { 甲: ['丑', '未'], 戊: ['丑', '未'], 庚: ['丑', '未'], 乙: ['申', '子'], 己: ['申', '子'], 丙: ['亥', '酉'], 丁: ['亥', '酉'], 壬: ['卯', '巳'], 癸: ['卯', '巳'], 辛: ['午', '寅'] }
const TAIJI: Record<string, string[]> = { 甲: ['子', '午'], 乙: ['子', '午'], 丙: ['酉', '卯'], 丁: ['酉', '卯'], 庚: ['寅', '亥'], 辛: ['寅', '亥'], 壬: ['申', '巳'], 癸: ['申', '巳'] }
const TIANDEHE: Record<string, string> = { 寅: '壬', 卯: '巳', 辰: '丁', 巳: '丙', 午: '寅', 未: '己', 申: '戊', 酉: '亥', 戌: '辛', 亥: '庚', 子: '申', 丑: '乙' }
const YUEDEHE: Record<string, string> = { 寅: '辛', 午: '辛', 戌: '辛', 申: '丁', 子: '丁', 辰: '丁', 巳: '乙', 酉: '乙', 丑: '乙', 亥: '己', 卯: '己', 未: '己' }
/** 德秀：月支三合局 → 德干∪秀干（问真按本柱天干判，样本多例验证） */
const DEXIU: Record<string, Set<string>> = {
  寅: new Set(['丙', '丁', '戊', '癸']), 午: new Set(['丙', '丁', '戊', '癸']), 戌: new Set(['丙', '丁', '戊', '癸']),
  申: new Set(['壬', '癸', '戊', '己', '丙', '辛', '甲']), 子: new Set(['壬', '癸', '戊', '己', '丙', '辛', '甲']), 辰: new Set(['壬', '癸', '戊', '己', '丙', '辛', '甲']),
  巳: new Set(['庚', '辛', '乙']), 酉: new Set(['庚', '辛', '乙']), 丑: new Set(['庚', '辛', '乙']),
  亥: new Set(['甲', '乙', '丁', '壬']), 卯: new Set(['甲', '乙', '丁', '壬']), 未: new Set(['甲', '乙', '丁', '壬']),
}
const FUXING: Record<string, string[]> = { 甲: ['寅', '子'], 丙: ['寅', '子'], 乙: ['卯', '丑'], 癸: ['卯', '丑'], 戊: ['申'], 己: ['未'], 丁: ['亥'], 庚: ['午'], 辛: ['巳'], 壬: ['辰'] }
/** 学堂/词馆：年纳音五行 → [支, 正配干支] */
const XUETANG: Record<string, [string, string]> = { 金: ['巳', '辛巳'], 木: ['亥', '己亥'], 水: ['申', '甲申'], 土: ['申', '戊申'], 火: ['寅', '丙寅'] }
const CIGUAN: Record<string, [string, string]> = { 金: ['申', '壬申'], 木: ['寅', '庚寅'], 水: ['亥', '癸亥'], 土: ['亥', '丁亥'], 火: ['巳', '乙巳'] }
const KUIGANG = new Set(['壬辰', '庚戌', '庚辰', '戊戌'])
const GUOYIN: Record<string, string> = { 甲: '戌', 乙: '亥', 丙: '丑', 丁: '寅', 戊: '丑', 己: '寅', 庚: '辰', 辛: '巳', 壬: '未', 癸: '申' }
const JINYU: Record<string, string> = { 甲: '辰', 乙: '巳', 丙: '未', 戊: '未', 丁: '申', 己: '申', 庚: '戌', 辛: '亥', 壬: '丑', 癸: '寅' }
const JINSHEN = new Set(['乙丑', '己巳', '癸酉'])
export const WUGUI: Record<string, string> = { 子: '辰', 丑: '巳', 寅: '午', 卯: '未', 辰: '申', 巳: '酉', 午: '戌', 未: '亥', 申: '子', 酉: '丑', 戌: '寅', 亥: '卯' }
const TIANYI_DOC: Record<string, string> = { 寅: '丑', 卯: '寅', 辰: '卯', 巳: '辰', 午: '巳', 未: '午', 申: '未', 酉: '申', 戌: '酉', 亥: '戌', 子: '亥', 丑: '子' }
const HONGLUAN: Record<string, string> = { 子: '卯', 丑: '寅', 寅: '丑', 卯: '子', 辰: '亥', 巳: '戌', 午: '酉', 未: '申', 申: '未', 酉: '午', 戌: '巳', 亥: '辰' }
const TIANXI: Record<string, string> = { 子: '酉', 丑: '申', 寅: '未', 卯: '午', 辰: '巳', 巳: '辰', 午: '卯', 未: '寅', 申: '丑', 酉: '子', 戌: '亥', 亥: '戌' }
const LIUXIA: Record<string, string> = { 甲: '酉', 乙: '戌', 丙: '未', 丁: '申', 戊: '巳', 己: '午', 庚: '辰', 辛: '卯', 壬: '亥', 癸: '寅' }
const HONGYAN: Record<string, string> = { 甲: '午', 乙: '午', 丙: '寅', 丁: '未', 戊: '辰', 己: '辰', 庚: '戌', 辛: '酉', 壬: '子', 癸: '申' }
const YANGREN: Record<string, string> = { 甲: '卯', 乙: '寅', 丙: '午', 戊: '午', 丁: '巳', 己: '巳', 庚: '酉', 辛: '申', 壬: '子', 癸: '亥' }
// 飞刃＝羊刃对冲（阴干四行原底稿混用他派刃位不成冲；癸→巳由 G6 大运乙巳/日癸未两格实证，丁己辛按同一对冲定义连带修正）
const FEIREN: Record<string, string> = { 甲: '酉', 乙: '申', 丙: '子', 戊: '子', 丁: '亥', 己: '亥', 庚: '卯', 辛: '寅', 壬: '午', 癸: '巳' }
const XUEREN: Record<string, string> = { 子: '午', 丑: '子', 寅: '丑', 卯: '未', 辰: '寅', 巳: '申', 午: '卯', 未: '酉', 申: '辰', 酉: '戌', 戌: '巳', 亥: '亥' }
const ZAISHA: Record<string, string[]> = { 午: ['申', '子', '辰'], 子: ['寅', '午', '戌'], 卯: ['巳', '酉', '丑'], 酉: ['亥', '卯', '未'] }
const WANGSHEN: Record<string, string[]> = { 亥: ['申', '子', '辰'], 巳: ['寅', '午', '戌'], 申: ['巳', '酉', '丑'], 寅: ['亥', '卯', '未'] }
const GUCHEN: Record<string, string[]> = { 寅: ['亥', '子', '丑'], 巳: ['寅', '卯', '辰'], 申: ['巳', '午', '未'], 亥: ['申', '酉', '戌'] }
const GUASU: Record<string, string[]> = { 戌: ['亥', '子', '丑'], 丑: ['寅', '卯', '辰'], 辰: ['巳', '午', '未'], 未: ['申', '酉', '戌'] }
const SHIEDABAI = new Set(['甲辰', '乙巳', '壬申', '丙申', '丁亥', '庚辰', '戊戌', '癸亥', '辛巳', '己丑'])
const GULUAN = new Set(['甲寅', '乙巳', '丙午', '丁巳', '戊午', '戊申', '辛亥', '壬子'])
const YINYANG_CHACUO = new Set(['丙子', '丁丑', '戊寅', '辛卯', '壬辰', '癸巳', '丙午', '丁未', '戊申', '辛酉', '壬戌', '癸亥'])
const JIUCHOU = new Set(['丁酉', '戊子', '戊午', '己卯', '己酉', '辛卯', '辛酉', '壬子', '壬午'])
const BAZHUAN = new Set(['甲寅', '乙卯', '丁未', '戊戌', '己未', '庚申', '辛酉', '癸丑'])
const SHILING = new Set(['甲辰', '乙亥', '丙辰', '丁酉', '戊午', '庚戌', '庚寅', '辛亥', '壬寅', '癸未'])
const LIUXIU = new Set(['丙午', '丁未', '戊子', '戊午', '己丑', '己未'])
// 天厨＝食神之禄（全十干；甲巳/乙午两行 chxb 底稿缺失，G5 流年丙午实证补齐）
const TIANCHU: Record<string, string> = { 甲: '巳', 乙: '午', 丙: '巳', 丁: '午', 戊: '申', 己: '酉', 庚: '亥', 辛: '子', 壬: '寅', 癸: '卯' }
const SIFEI: Record<string, string[]> = { 寅: ['庚申', '辛酉'], 卯: ['庚申', '辛酉'], 辰: ['庚申', '辛酉'], 巳: ['壬子', '癸亥'], 午: ['壬子', '癸亥'], 未: ['壬子', '癸亥'], 申: ['甲寅', '乙卯'], 酉: ['甲寅', '乙卯'], 戌: ['甲寅', '乙卯'], 亥: ['丙午', '丁巳'], 子: ['丙午', '丁巳'], 丑: ['丙午', '丁巳'] }
/** 丧门/吊客/披麻：年支序（子起）→ 对应支 */
const SHANGMEN = ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑']
const DIAOKE = ['戌', '亥', '子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉']
const PIMA = ['酉', '戌', '亥', '子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申']
/** 元辰 */
const YUANCHEN_A: Record<string, string> = { 子: '未', 丑: '申', 寅: '酉', 卯: '戌', 辰: '亥', 巳: '子', 午: '丑', 未: '寅', 申: '卯', 酉: '辰', 戌: '巳', 亥: '午' }
const YUANCHEN_B: Record<string, string> = { 子: '巳', 丑: '午', 寅: '未', 卯: '申', 辰: '酉', 巳: '戌', 午: '亥', 未: '子', 申: '丑', 酉: '寅', 戌: '卯', 亥: '辰' }
const LUOWANG_PAIR: Record<string, string> = { 辰: '巳', 巳: '辰', 戌: '亥', 亥: '戌' }
/** 童子：季节条件（月支→日/时支） */
const TONGZI_SEASON: Record<string, string[]> = { 寅: ['寅', '子'], 卯: ['寅', '子'], 辰: ['寅', '子'], 申: ['寅', '子'], 酉: ['寅', '子'], 戌: ['寅', '子'], 巳: ['卯', '未', '辰'], 午: ['卯', '未', '辰'], 未: ['卯', '未', '辰'], 亥: ['卯', '未', '辰'], 子: ['卯', '未', '辰'], 丑: ['卯', '未', '辰'] }
const TONGZI_NAYIN: Record<string, string[]> = { 金: ['午', '卯'], 木: ['午', '卯'], 水: ['酉', '戌'], 火: ['酉', '戌'], 土: ['辰', '巳'] }

/** 神煞起法目录条目：某神煞在本盘中「以什么起、位在哪」 */
export interface ShenShaOriginGroup {
  /** 分组标题（含本盘的具体起点值），如「以年支卯起」 */
  title: string
  /** 神煞名 → 位（本盘中该神煞落点的支/干/干支描述） */
  items: Array<{ name: string; pos: string }>
}

/**
 * 神煞起法目录（方案C总览用，2026-07-31 用户选定）：按起点分组，
 * 逐条给出「神煞＝位」，UI 再配上盘中实际命中的列（落点）。
 * 与 queryShenSha 共用同一套规则表——改表两处同步生效。
 */
export function shenShaOrigins(ctx: ShenShaContext): ShenShaOriginGroup[] {
  const { yearGan: ng, yearZhi: nz, monthZhi: yz, dayGan: rg, dayZhi: rz } = ctx
  const naYinElem = ctx.yearNaYin.charAt(ctx.yearNaYin.length - 1)
  const uniq = (a: Array<string | undefined>) => [...new Set(a.filter(Boolean) as string[])].join('、')
  const keysWith = (table: Record<string, string[]>, ...zhis: string[]) =>
    uniq(Object.keys(table).filter((k) => zhis.some((z) => table[k].includes(z))))
  const taijiPos = (g: string) => (g === '戊' || g === '己' ? [...EARTH_BRANCHES] : TAIJI[g] ?? [])
  const yangPair = (ctx.gender === '乾') === isYangStem(ng)
  const dayKong = xunKong(rg, rz)
  const yearKong = xunKong(ng, nz)
  const xt = XUETANG[naYinElem]
  const cg = CIGUAN[naYinElem]
  return [
    { title: `以年支${nz}起`, items: [
      { name: '红鸾', pos: HONGLUAN[nz] }, { name: '天喜', pos: TIANXI[nz] },
      { name: '丧门', pos: SHANGMEN[bi(nz)] }, { name: '吊客', pos: DIAOKE[bi(nz)] },
      { name: '披麻', pos: PIMA[bi(nz)] }, { name: '勾绞煞', pos: `${bAdd(nz, 3)}（前三辰）` },
      { name: '孤辰', pos: keysWith(GUCHEN, nz) }, { name: '寡宿', pos: keysWith(GUASU, nz) },
      { name: '元辰', pos: `${(yangPair ? YUANCHEN_A : YUANCHEN_B)[nz]}（${yangPair ? '阳男阴女' : '阴男阳女'}表）` },
    ] },
    { title: `以年支${nz}、日支${rz}三合局起`, items: [
      { name: '驿马', pos: uniq([YIMA[nz], YIMA[rz]]) }, { name: '华盖', pos: `${uniq([HUAGAI[nz], HUAGAI[rz]])}（起点柱自身不查）` },
      { name: '将星', pos: `${uniq([JIANGXING[nz], JIANGXING[rz]])}（起点柱自身不查）` }, { name: '桃花', pos: uniq([TAOHUA[nz], TAOHUA[rz]]) },
      { name: '劫煞', pos: keysWith(JIESHA, nz, rz) }, { name: '亡神', pos: keysWith(WANGSHEN, nz, rz) },
      { name: '灾煞', pos: `${keysWith(ZAISHA, nz)}（仅年支起）` },
    ] },
    { title: `以年干${ng}、日干${rg}起（两太极点）`, items: [
      { name: '天乙贵人', pos: uniq([...(TIANYI[ng] ?? []), ...(TIANYI[rg] ?? [])]) },
      { name: '太极贵人', pos: uniq([...taijiPos(ng), ...taijiPos(rg)]) },
      { name: '福星贵人', pos: uniq([...(FUXING[ng] ?? []), ...(FUXING[rg] ?? [])]) },
      { name: '文昌贵人', pos: uniq([WENCHANG[ng], WENCHANG[rg]]) },
      { name: '天厨贵人', pos: uniq([TIANCHU[ng], TIANCHU[rg]]) },
      { name: '国印贵人', pos: uniq([GUOYIN[ng], GUOYIN[rg]]) },
      { name: '金舆', pos: uniq([JINYU[rg], JINYU[ng]]) },
    ] },
    { title: `以日干${rg}起`, items: [
      { name: '禄神', pos: LUSHEN[rg] ?? '' }, { name: '羊刃', pos: YANGREN[rg] ?? '' },
      { name: '飞刃', pos: `${FEIREN[rg] ?? ''}（羊刃对冲）` }, { name: '红艳煞', pos: HONGYAN[rg] ?? '' },
      { name: '流霞', pos: LIUXIA[rg] ?? '' },
    ] },
    { title: `以月支${yz}起`, items: [
      { name: '天德贵人', pos: TIANDE[yz] }, { name: '天德合', pos: TIANDEHE[yz] },
      { name: '月德贵人', pos: `${YUEDE[yz]}（干）` }, { name: '月德合', pos: `${YUEDEHE[yz]}（干）` },
      { name: '德秀贵人', pos: `干见${[...(DEXIU[yz] ?? [])].join('')}` },
      { name: '天医', pos: TIANYI_DOC[yz] }, { name: '血刃', pos: XUEREN[yz] },
      { name: '童子煞', pos: `${(TONGZI_SEASON[yz] ?? []).join('')}／纳音命${(TONGZI_NAYIN[naYinElem] ?? []).join('')}（仅日/时柱）` },
    ] },
    { title: `以年柱纳音（${ctx.yearNaYin}·${naYinElem}命）起——学堂词馆不查年/月柱`, items: [
      { name: '学堂', pos: xt ? xt[0] : '' }, { name: '正学堂', pos: xt ? `${xt[1]}（干支正配）` : '' },
      { name: '词馆', pos: cg ? cg[0] : '' }, { name: '正词馆', pos: cg ? `${cg[1]}（干支正配）` : '' },
      { name: '天罗', pos: '戌亥（火命，仅日柱/宫位/岁运列）' }, { name: '地网', pos: '辰巳（水土命，仅日柱/宫位/岁运列）' },
    ] },
    { title: '以年支/日支见辰巳戌亥对支起', items: [
      { name: '天罗地网', pos: `${uniq([LUOWANG_PAIR[nz], LUOWANG_PAIR[rz]])}（辰↔巳、戌↔亥互见）` },
    ] },
    { title: '以旬空起', items: [
      { name: '空亡', pos: `${dayKong.join('')}（日柱${rg}${rz}旬）、${yearKong.join('')}（年柱${ng}${nz}旬）` },
    ] },
    { title: '柱内干支组合（自带，不另起）', items: [
      { name: '魁罡日', pos: '' }, { name: '九丑日', pos: '' }, { name: '八专日', pos: '' },
      { name: '十灵日', pos: '' }, { name: '六秀日', pos: '' }, { name: '孤鸾煞', pos: '' },
      { name: '阴差阳错', pos: '' }, { name: '十恶大败', pos: '' }, { name: '四废日', pos: `月支${yz}对应${(SIFEI[yz] ?? []).join('、')}` },
      { name: '天赦', pos: TIANSHE[yz] ? `${TIANSHE[yz]}（月支${yz}对应，仅日柱）` : '' }, { name: '金神', pos: '乙丑/己巳/癸酉（仅日/时柱）' },
    ] },
  ]
}



export function queryShenSha(gan: string, zhi: string, kind: ColumnKind, ctx: ShenShaContext): string[] {
  const out: string[] = []
  const gz = gan + zhi
  const { yearGan: ng, yearZhi: nz, monthZhi: yz, dayGan: rg, dayZhi: rz, hourZhi } = ctx
  const naYinElem = ctx.yearNaYin.charAt(ctx.yearNaYin.length - 1)
  const isDay = kind === 'day'
  const notDay = !isDay
  const notYear = kind !== 'year'
  const notMonth = kind !== 'month'
  const isGong = kind === 'gong'
  const isSuiYun = kind === 'dayun' || kind === 'xiaoyun' || kind === 'liunian' || kind === 'liuyue' || kind === 'liuri' || kind === 'liushi'
  const add = (name: string) => out.push(name)

  // 贵人类
  if (TIANYI[rg]?.includes(zhi) || TIANYI[ng]?.includes(zhi)) add('天乙贵人')
  const taiji = (g: string) => (g === '戊' || g === '己' ? EARTH_BRANCHES.has(zhi) : TAIJI[g]?.includes(zhi))
  if (taiji(rg) || taiji(ng)) add('太极贵人')
  if (TIANDE[yz] === gan || TIANDE[yz] === zhi) add('天德贵人')
  if (YUEDE[yz] === gan) add('月德贵人')
  if (DEXIU[yz]?.has(gan)) add('德秀贵人')
  if (TIANDEHE[yz] === gan || TIANDEHE[yz] === zhi) add('天德合')
  if (YUEDEHE[yz] === gan) add('月德合')
  if (FUXING[ng]?.includes(zhi) || FUXING[rg]?.includes(zhi)) add('福星贵人')
  if (WENCHANG[rg] === zhi || WENCHANG[ng] === zhi) add('文昌贵人')
  if (TIANCHU[ng] === zhi || TIANCHU[rg] === zhi) add('天厨贵人')
  if (GUOYIN[rg] === zhi || GUOYIN[ng] === zhi) add('国印贵人')
  // 学堂/词馆（含正配）。不查年柱与月柱：内部黄金样本两例（月柱命中词馆位、年柱命中正学堂正配）
  // 均不显示；时柱/日柱/胎元/大运/流年/流日诸列多例实证均显示
  if (notYear && notMonth) {
    const xt = XUETANG[naYinElem]
    if (xt) {
      if (gz === xt[1]) add('正学堂')
      else if (zhi === xt[0]) add('学堂')
    }
    const cg = CIGUAN[naYinElem]
    if (cg) {
      if (gz === cg[1]) add('正词馆')
      else if (zhi === cg[0]) add('词馆')
    }
  }
  // 日柱专属
  if (isDay) {
    if (KUIGANG.has(gz)) add('魁罡日')
    if (JIUCHOU.has(gz)) add('九丑日')
    if (BAZHUAN.has(gz)) add('八专日')
    if (SHILING.has(gz)) add('十灵日')
    if (LIUXIU.has(gz)) add('六秀日')
    if (GULUAN.has(gz)) add('孤鸾煞')
    if (YINYANG_CHACUO.has(gz)) add('阴差阳错')
    if (SHIEDABAI.has(gz)) add('十恶大败')
    if (SIFEI[yz]?.includes(gz)) add('四废日')
    if (TIANSHE[yz] === gz) add('天赦')
  }
  if ((isDay || kind === 'hour') && JINSHEN.has(gz)) add('金神')
  if ((isDay || kind === 'hour') && (TONGZI_SEASON[yz]?.includes(zhi) || TONGZI_NAYIN[naYinElem]?.includes(zhi))) add('童子煞')
  // 年/日支起（三合局系）
  if ((notDay && YIMA[rz] === zhi) || (notYear && YIMA[nz] === zhi)) add('驿马')
  if ((notDay && HUAGAI[rz] === zhi) || (notYear && HUAGAI[nz] === zhi)) add('华盖')
  if ((notDay && JIANGXING[rz] === zhi) || (notYear && JIANGXING[nz] === zhi)) add('将星')
  if (JIESHA[zhi]?.includes(rz) || JIESHA[zhi]?.includes(nz)) add('劫煞')
  if (ZAISHA[zhi]?.includes(nz)) add('灾煞')
  if ((notDay && WANGSHEN[zhi]?.includes(rz)) || (notYear && WANGSHEN[zhi]?.includes(nz))) add('亡神')
  if (TAOHUA[rz] === zhi || TAOHUA[nz] === zhi) add('桃花')
  // 年支起
  if (notYear && HONGLUAN[nz] === zhi) add('红鸾')
  if (notYear && TIANXI[nz] === zhi) add('天喜')
  if (notYear && GUCHEN[zhi]?.includes(nz)) add('孤辰')
  if (notYear && GUASU[zhi]?.includes(nz)) add('寡宿')
  if (notYear && SHANGMEN[bi(nz)] === zhi) add('丧门')
  if (notYear && DIAOKE[bi(nz)] === zhi) add('吊客')
  if (notYear && PIMA[bi(nz)] === zhi) add('披麻')
  if (notYear) {
    const yangPair = (ctx.gender === '乾') === isYangStem(ng) // 阳男阴女
    if ((yangPair ? YUANCHEN_A : YUANCHEN_B)[nz] === zhi) add('元辰')
  }
  // 勾绞煞＝年支前三辰（+3）。后三辰（−3）有黄金负样本（卯年流年子不显示）——原双向起法收窄
  if (zhi === bAdd(nz, 3)) add('勾绞煞')
  // 日干起
  if (LUSHEN[rg] === zhi) add('禄神')
  if (LIUXIA[rg] === zhi) add('流霞')
  if (HONGYAN[rg] === zhi) add('红艳煞')
  if (YANGREN[rg] === zhi) add('羊刃')
  if (FEIREN[rg] === zhi) add('飞刃')
  if (JINYU[rg] === zhi || JINYU[ng] === zhi) add('金舆')
  // 月支起
  // 五鬼：参考实现有此煞，但黄金样本不显示（大运/年柱两处实证均无）——默认关闭，规则表保留在 WUGUI 备用
  if (notMonth && TIANYI_DOC[yz] === zhi) add('天医')
  if (XUEREN[yz] === zhi) add('血刃')
  // 空亡（日旬＋年旬，均不查自身柱）
  const dayKong = xunKong(rg, rz)
  const yearKong = xunKong(ng, nz)
  if ((notDay && dayKong.includes(zhi)) || (notYear && yearKong.includes(zhi))) add('空亡')
  // 天罗地网
  if ((notDay && LUOWANG_PAIR[rz] === zhi) || (notYear && LUOWANG_PAIR[nz] === zhi)) add('天罗地网')
  // 查法二（纳音命）适用列扩展到岁运：黄金样本土命的流年/流时列均标「地网」
  if (isDay || isGong || isSuiYun) {
    if (naYinElem === '火' && (zhi === '戌' || zhi === '亥')) add('天罗')
    if ((naYinElem === '水' || naYinElem === '土') && (zhi === '辰' || zhi === '巳')) add('地网')
  }
  void hourZhi
  return out
}
