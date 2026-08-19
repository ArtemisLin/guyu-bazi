/**
 * 干支基础表——全引擎唯一来源（审查修复 2026-08-18：此前 STEMS/BRANCHES/WUHU/WUSHU/MONTH_TERMS 在
 * shensha/reverse/liuYue/mingGong 各存一份，违反「标『＝引擎同表』一律 import 复用、禁止侧车复制」纪律）。
 * 这些是黄金样本锁定的规则表，改一处漏一处会产生只有特定入口触发的偏差。
 */
export const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
export const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
/** 六十甲子（甲子…癸亥） */
export const JIAZI: string[] = Array.from({ length: 60 }, (_, i) => STEMS[i % 10] + BRANCHES[i % 12])
/** 五虎遁：年干 → 寅月起干（甲己丙、乙庚戊、丙辛庚、丁壬壬、戊癸甲） */
export const WUHU: Record<string, string> = {
  甲: '丙', 己: '丙', 乙: '戊', 庚: '戊', 丙: '庚', 辛: '庚', 丁: '壬', 壬: '壬', 戊: '甲', 癸: '甲',
}
/** 五鼠遁：日干 → 子时起干（甲己甲、乙庚丙、丙辛戊、丁壬庚、戊癸壬） */
export const WUSHU: Record<string, string> = {
  甲: '甲', 己: '甲', 乙: '丙', 庚: '丙', 丙: '戊', 辛: '戊', 丁: '庚', 壬: '庚', 戊: '壬', 癸: '壬',
}
/** 十二节（月柱以节为界）：寅月立春起，丑月小寒止 */
export const MONTH_TERMS = ['立春', '惊蛰', '清明', '立夏', '芒种', '小暑', '立秋', '白露', '寒露', '立冬', '大雪', '小寒']
export const si = (g: string) => STEMS.indexOf(g)
export const bi = (z: string) => BRANCHES.indexOf(z)
export const bAdd = (z: string, n: number) => BRANCHES[(bi(z) + n + 120) % 12]
