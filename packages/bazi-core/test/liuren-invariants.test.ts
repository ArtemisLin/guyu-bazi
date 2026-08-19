/**
 * 六壬动态神煞 · 结构不变量测试（docs/10 §〇-3：免费交叉校验）。
 * 本文件允许 import 注册表（测的是内部自洽），与 liuren-rules.test.ts 的独立转译期望互补：
 * 派生关系类规则（豹尾/天耳/死气/五墓/羊刃…）在注册表里是独立转录的数据，
 * 这里验证它们与派生来源的关系恒成立——转录错一位就会在此暴露。
 */
import { describe, expect, it } from 'vitest'
import { BRANCHES, STEMS, bAdd } from '../src/ganzhi'
import { HUAGAI, LUSHEN, YIMA } from '../src/tables'
import { LIUREN_RULES, SANHE_JIE } from '../src/liurenRegistry'
import { resolveLiurenRing, resolveLiurenRule } from '../src/liurenPanel'

const R = (id: string) => {
  const r = LIUREN_RULES.find((r) => r.id === id)
  if (!r) throw new Error(`注册表缺规则 ${id}`)
  return r
}
/** 支→合法干支（阴阳配对） */
const gzOfZhi = (zhi: string) => (BRANCHES.indexOf(zhi) % 2 === 0 ? '甲' : '乙') + zhi
/** 干→合法干支 */
const gzOfGan = (gan: string) => gan + (STEMS.indexOf(gan) % 2 === 0 ? '子' : '丑')
const one = (id: string, gz: string) => {
  const p = resolveLiurenRule(R(id), gz)
  expect(p.length, `${id}@${gz} 应恰一位`).toBe(1)
  return p[0]
}
const ringSlot = (ringId: string, gz: string, name: string) => {
  const s = resolveLiurenRing(R(ringId), gz).find((s) => s.name === name)
  if (!s) throw new Error(`${ringId}@${gz} 无槽位 ${name}`)
  return s.branch
}
const SEASON_REP = ['寅', '巳', '申', '亥'] // 四季代表月支

describe('六壬不变量 · 岁族', () => {
  it('豹尾＝黄幡对冲；黄幡＝三合墓（HUAGAI）', () => {
    for (const z of BRANCHES) {
      const gz = gzOfZhi(z)
      expect(one('huangFan', gz), `黄幡@${z}`).toBe(HUAGAI[z])
      expect(one('baoWei', gz), `豹尾@${z}`).toBe(bAdd(one('huangFan', gz), 6))
    }
  })
  it('大耗/小耗/病符/岁虎＝岁前十二神对应槽同位', () => {
    for (const z of BRANCHES) {
      const gz = gzOfZhi(z)
      expect(one('daHao', gz), `大耗@${z}`).toBe(bAdd(z, 6))
      expect(one('daHao', gz), `大耗=岁破槽@${z}`).toBe(ringSlot('suiQian12', gz, '岁破'))
      expect(one('xiaoHao', gz), `小耗=死符槽@${z}`).toBe(ringSlot('suiQian12', gz, '死符'))
      expect(one('bingFu', gz), `病符=病符槽@${z}`).toBe(ringSlot('suiQian12', gz, '病符'))
      expect(one('suiHu', gz), `岁虎=白虎槽@${z}`).toBe(ringSlot('suiQian12', gz, '白虎'))
    }
  })
  it('三合十二煞：劫煞＝绝位、将星＝劫煞+7＝旺地、华盖＝三合墓、驿马＝YIMA', () => {
    for (const z of BRANCHES) {
      const gz = gzOfZhi(z)
      expect(ringSlot('sanhe12', gz, '劫煞'), `劫煞@${z}`).toBe(SANHE_JIE[z])
      expect(ringSlot('sanhe12', gz, '将星'), `将星@${z}`).toBe(bAdd(SANHE_JIE[z], 7))
      expect(ringSlot('sanhe12', gz, '华盖'), `华盖@${z}`).toBe(HUAGAI[z])
      expect(ringSlot('sanhe12', gz, '驿马'), `驿马@${z}`).toBe(YIMA[z])
    }
  })
  it('两条 ring 各 12 槽、支互异且覆盖十二支', () => {
    for (const id of ['suiQian12', 'sanhe12'])
      for (const z of BRANCHES) {
        const slots = resolveLiurenRing(R(id), gzOfZhi(z))
        expect(slots.length, `${id}@${z}`).toBe(12)
        expect(new Set(slots.map((s) => s.branch)).size, `${id}@${z} 支互异`).toBe(12)
      }
  })
})

describe('六壬不变量 · 季族', () => {
  it('天耳＝天目冲；天喜(季)＝天耳、喝散＝季孤、丧车＝四废、关神＝季寡同位', () => {
    for (const z of SEASON_REP) {
      const gz = gzOfZhi(z)
      expect(one('tianEr', gz), `天耳@${z}`).toBe(bAdd(one('tianMu', gz), 6))
      expect(one('tianXiJi', gz), `天喜季@${z}`).toBe(one('tianEr', gz))
      expect(one('heSan', gz), `喝散@${z}`).toBe(one('jiGu', gz))
      expect(one('sangChe', gz), `丧车@${z}`).toBe(one('siFeiZhi', gz))
      expect(one('guanShen', gz), `关神@${z}`).toBe(one('jiGua', gz))
    }
  })
})

describe('六壬不变量 · 月族', () => {
  it('死气＝生气冲；月破＝月支冲', () => {
    for (const z of BRANCHES) {
      const gz = gzOfZhi(z)
      expect(one('siQi', gz), `死气@${z}`).toBe(bAdd(one('shengQi', gz), 6))
      expect(one('yuePo', gz), `月破@${z}`).toBe(bAdd(z, 6))
    }
  })
  // 2026-08-02 三丘起法定案后，旧「五墓＝三丘冲」不再成立（那是被推翻的冠带口径的性质）；
  // 新关系：三丘＝四季长生之墓＝天目同位，五墓＝四季五行墓库＝三丘顺行三位。
  it('三丘＝天目同位；五墓＝三丘顺行三位（四季代表月支）', () => {
    for (const z of SEASON_REP) {
      const gz = gzOfZhi(z)
      expect(one('sanQiu', gz), `三丘@${z}`).toBe(one('tianMu', gz))
      expect(one('wuMu', gz), `五墓@${z}`).toBe(bAdd(one('sanQiu', gz), 3))
    }
  })
})

describe('六壬不变量 · 日干族', () => {
  it('羊刃(六壬)＝禄前一位（十干全扫，阴干亦然——与子平羊刃不同表的核验）', () => {
    for (const g of STEMS) expect(one('yangRenLr', gzOfGan(g)), `羊刃@${g}`).toBe(bAdd(LUSHEN[g], 1))
  })
  it('日禄＝LUSHEN', () => {
    for (const g of STEMS) expect(one('riLu', gzOfGan(g)), `日禄@${g}`).toBe(LUSHEN[g])
  })
})

describe('六壬不变量 · 日支族', () => {
  it('支冲自反；支破/支害对称', () => {
    for (const z of BRANCHES) {
      const gz = gzOfZhi(z)
      const chong = one('zhiChong', gz)
      expect(one('zhiChong', gzOfZhi(chong)), `冲之冲@${z}`).toBe(z)
      expect(one('zhiPo', gzOfZhi(one('zhiPo', gz))), `破之破@${z}`).toBe(z)
      expect(one('zhiHai', gzOfZhi(one('zhiHai', gz))), `害之害@${z}`).toBe(z)
    }
  })
  it('支刑：子卯互、寅巳申环、丑戌未环、辰午酉亥自刑', () => {
    const xing = (z: string) => one('zhiXing', gzOfZhi(z))
    expect(xing('子')).toBe('卯')
    expect(xing('卯')).toBe('子')
    expect([xing('寅'), xing('巳'), xing('申')].join('')).toBe('巳申寅')
    expect([xing('丑'), xing('戌'), xing('未')].join('')).toBe('戌未丑')
    for (const z of ['辰', '午', '酉', '亥']) expect(xing(z), `自刑@${z}`).toBe(z)
  })
})

describe('六壬不变量 · 旬族', () => {
  it('旬仪＝旬首支；旬空两支＝本旬所缺（六旬全扫）', () => {
    // 六旬代表干支：旬首本身
    for (const shou of ['子', '戌', '申', '午', '辰', '寅']) {
      const gz = `甲${shou}`
      expect(one('xunYi', gz), `旬仪@甲${shou}旬`).toBe(shou)
      const kong = resolveLiurenRule(R('xunKongDyn'), gz)
      expect(kong.length, `旬空@甲${shou}旬`).toBe(2)
      // 本旬十位干支的支 ∪ 旬空两支 ＝ 十二支
      const inXun = new Set<string>()
      for (let i = 0; i < 10; i++) inXun.add(bAdd(shou, i))
      for (const k of kong) expect(inXun.has(k), `旬空${k}不在旬内`).toBe(false)
      expect(new Set([...inXun, ...kong]).size).toBe(12)
    }
  })
})
