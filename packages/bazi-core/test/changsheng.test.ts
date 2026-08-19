import { describe, expect, it } from 'vitest'
import { CHANG_SHENG_STAGES, changShengTable } from '../src'

// 期望值＝口诀独立转录（双通道）：阳干顺行、阴干逆行；火土同宫（戊随丙长生寅、己随丁长生酉）
describe('十二长生总表（changShengTable）', () => {
  it('8 行：丙戊/丁己火土同宫合并，其余独立，顺序按十干', () => {
    expect(changShengTable().map((r) => r.gans)).toEqual(['甲', '乙', '丙戊', '丁己', '庚', '辛', '壬', '癸'])
  })

  it('阶段序列头＝长生→养十二位', () => {
    expect(CHANG_SHENG_STAGES).toEqual(['长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝', '胎', '养'])
  })

  it('八行全表逐位（独立转录）', () => {
    const t = Object.fromEntries(changShengTable().map((r) => [r.gans, r.zhis.join('')]))
    expect(t['甲']).toBe('亥子丑寅卯辰巳午未申酉戌')
    expect(t['乙']).toBe('午巳辰卯寅丑子亥戌酉申未')
    expect(t['丙戊']).toBe('寅卯辰巳午未申酉戌亥子丑')
    expect(t['丁己']).toBe('酉申未午巳辰卯寅丑子亥戌')
    expect(t['庚']).toBe('巳午未申酉戌亥子丑寅卯辰')
    expect(t['辛']).toBe('子亥戌酉申未午巳辰卯寅丑')
    expect(t['壬']).toBe('申酉戌亥子丑寅卯辰巳午未')
    expect(t['癸']).toBe('卯寅丑子亥戌酉申未午巳辰')
  })

  it('与明细表自坐抽查同源：辛养在丑、丁帝旺在巳（本轮即时盘时柱辛丑/日柱丁巳）', () => {
    const t = Object.fromEntries(changShengTable().map((r) => [r.gans, r.zhis]))
    expect(t['辛'][CHANG_SHENG_STAGES.indexOf('养')]).toBe('丑')
    expect(t['丁己'][CHANG_SHENG_STAGES.indexOf('帝旺')]).toBe('巳')
  })
})
