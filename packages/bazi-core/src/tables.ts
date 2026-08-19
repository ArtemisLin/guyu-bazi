/**
 * 干支公共表·六壬共享层（2026-08-19 自 shensha.ts 抽出，内容逐字未动）。
 * 动机：liurenRegistry/liurenPanel（131 条动态神煞，谷雨六壬同用）此前 import 自 shensha.ts（八字原局神煞模块），
 * 跨项目复用会把 308 行八字代码拖进六壬引擎——docs/00 #75 后续、007guyuliuren docs/02 §1.2 前置改动①。
 * 纪律不变：黄金样本锁定的规则表，「＝引擎同表」一律 import 复用禁复制。shensha.ts 原样再导出，外部 import 路径不变。
 */
import { BRANCHES, bi, si } from './ganzhi'

/** 旬空两支 */
export function xunKong(gan: string, zhi: string): [string, string] {
  const d = (bi(zhi) - si(gan) + 12) % 12
  return [BRANCHES[(d + 10) % 12], BRANCHES[(d + 11) % 12]]
}

/** 六甲旬首之支（甲子旬→子、甲戌旬→戌…）：与 xunKong 同一推导 */
export function xunShou(gan: string, zhi: string): string {
  return BRANCHES[(bi(zhi) - si(gan) + 12) % 12]
}

export const TIANDE: Record<string, string> = { 寅: '丁', 卯: '申', 辰: '壬', 巳: '辛', 午: '亥', 未: '甲', 申: '癸', 酉: '寅', 戌: '丙', 亥: '乙', 子: '巳', 丑: '庚' }
export const YUEDE: Record<string, string> = { 寅: '丙', 午: '丙', 戌: '丙', 申: '壬', 子: '壬', 辰: '壬', 亥: '甲', 卯: '甲', 未: '甲', 巳: '庚', 酉: '庚', 丑: '庚' }
export const WENCHANG: Record<string, string> = { 甲: '巳', 乙: '午', 丙: '申', 丁: '酉', 戊: '申', 己: '酉', 庚: '亥', 辛: '子', 壬: '寅', 癸: '卯' }
export const YIMA: Record<string, string> = { 申: '寅', 子: '寅', 辰: '寅', 寅: '申', 午: '申', 戌: '申', 亥: '巳', 卯: '巳', 未: '巳', 巳: '亥', 酉: '亥', 丑: '亥' }
export const HUAGAI: Record<string, string> = { 申: '辰', 子: '辰', 辰: '辰', 寅: '戌', 午: '戌', 戌: '戌', 巳: '丑', 酉: '丑', 丑: '丑', 亥: '未', 卯: '未', 未: '未' }
export const JIANGXING: Record<string, string> = { 申: '子', 子: '子', 辰: '子', 寅: '午', 午: '午', 戌: '午', 巳: '酉', 酉: '酉', 丑: '酉', 亥: '卯', 卯: '卯', 未: '卯' }
export const LUSHEN: Record<string, string> = { 甲: '寅', 乙: '卯', 丙: '巳', 戊: '巳', 丁: '午', 己: '午', 庚: '申', 辛: '酉', 壬: '亥', 癸: '子' }
/** target支 → 三合局源支 */
export const JIESHA: Record<string, string[]> = { 亥: ['寅', '午', '戌'], 巳: ['申', '子', '辰'], 寅: ['巳', '酉', '丑'], 申: ['亥', '卯', '未'] }
export const TAOHUA: Record<string, string> = { 申: '酉', 子: '酉', 辰: '酉', 寅: '卯', 午: '卯', 戌: '卯', 巳: '午', 酉: '午', 丑: '午', 亥: '子', 卯: '子', 未: '子' }
export const TIANSHE: Record<string, string> = { 寅: '戊寅', 卯: '戊寅', 辰: '戊寅', 巳: '甲午', 午: '甲午', 未: '甲午', 申: '戊申', 酉: '戊申', 戌: '戊申', 亥: '甲子', 子: '甲子', 丑: '甲子' }

/**
 * 六壬系 · 岁前十二神：以年支起太岁顺行（唐李淳风《四利三元》体系，与问真丧门(+2)/吊客(+10)自洽）。
 * 每一支都对应一神。
 */
export const SUI_QIAN = ['太岁', '太阳', '丧门', '太阴', '官符', '死符', '岁破', '龙德', '白虎', '福德', '吊客', '病符']
export function suiQianShiErShen(yearZhi: string, zhi: string): string {
  return SUI_QIAN[(bi(zhi) - bi(yearZhi) + 12) % 12]
}

/** 六壬系 · 天马：诀「正七午、二八申、三九戌、四十子、五十一寅、六十二辰」（以月支起） */
export function tianMa(monthZhi: string): string {
  const monthOrder = (bi(monthZhi) - 2 + 12) % 12 // 寅=0
  return BRANCHES[(6 + 2 * (monthOrder % 6)) % 12]
}
