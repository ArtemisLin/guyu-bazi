/**
 * 三元命卦（问真三样本验证：1992坤→兑、1995乾→坤、G3 立春前节气年1999乾→坎）。
 * 关键：年份取「节气年」（立春前算前一年）。
 */
const GUA = ['坎', '坤', '震', '巽', '中', '乾', '兑', '艮', '离']
const EAST = new Set(['坎', '离', '震', '巽'])

const digitSum = (n: number): number => {
  while (n > 9) n = String(n).split('').reduce((a, b) => a + Number(b), 0)
  return n
}

export function mingGua(jieQiYear: number, gender: '乾' | '坤'): { name: string; group: '东四命' | '西四命' } {
  const s = digitSum(jieQiYear)
  let g = digitSum(gender === '乾' ? 11 - s : s + 4)
  if (g === 5) g = gender === '乾' ? 2 : 8
  const name = GUA[g - 1]
  return { name: `${name}卦`, group: EAST.has(name) ? '东四命' : '西四命' }
}
