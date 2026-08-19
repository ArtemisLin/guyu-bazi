// 由 scripts/gen-public-tests.mjs 生成于引擎 v0.1.0——期望值为引擎锁值（防回归），出处链见私仓黄金测试。
// 全部生辰均为合成（虚构），不对应任何真实人物；请勿手改，改动会被下次生成覆盖。
import { describe, expect, it } from 'vitest'
import { computeChart, liuRi, liuShi, liuYue, lunarDaysOf, lunarMonthsOf, lunarToSolar, reverseFourPillars, solarToLunar } from '../src'

const P = (r: ReturnType<typeof computeChart>) => [r.pillars.year, r.pillars.month, r.pillars.day, r.pillars.hour].join(' ')

describe('S1 主样本（合成）· 1985-03-08 10:30 乾造 · 无出生地', () => {
  const r = computeChart({ clock: { y: 1985, m: 3, d: 8, hh: 10, mi: 30 }, gender: '乾', trueSolar: false })

  it('四柱 / 日主 / 农历标签', () => {
    expect(P(r)).toBe('乙丑 己卯 丙午 癸巳')
    expect(r.dayMaster).toBe('丙')
    expect(r.lunarLabel).toBe('1985年正月十七')
  })

  it('年柱明细九行＋原局神煞', () => {
    expect(r.detail.year).toEqual({
      "ganZhi": "乙丑",
      "stem": "乙",
      "branch": "丑",
      "mainStar": "正印",
      "hiddenStems": [
        {
          "stem": "己",
          "tenStar": "伤官",
          "type": "本气"
        },
        {
          "stem": "癸",
          "tenStar": "正官",
          "type": "中气"
        },
        {
          "stem": "辛",
          "tenStar": "正财",
          "type": "余气"
        }
      ],
      "stage": "养",
      "selfSit": "衰",
      "voidBranches": "戌亥",
      "naYin": "海中金",
      "shenSha": [
        "德秀贵人",
        "福星贵人",
        "国印贵人"
      ]
    })
  })

  it('月柱明细九行＋原局神煞', () => {
    expect(r.detail.month).toEqual({
      "ganZhi": "己卯",
      "stem": "己",
      "branch": "卯",
      "mainStar": "伤官",
      "hiddenStems": [
        {
          "stem": "乙",
          "tenStar": "正印",
          "type": "本气"
        }
      ],
      "stage": "沐浴",
      "selfSit": "病",
      "voidBranches": "申酉",
      "naYin": "城头土",
      "shenSha": [
        "太极贵人",
        "月德合",
        "福星贵人",
        "灾煞",
        "桃花",
        "丧门",
        "空亡"
      ]
    })
  })

  it('日柱明细九行＋原局神煞', () => {
    expect(r.detail.day).toEqual({
      "ganZhi": "丙午",
      "stem": "丙",
      "branch": "午",
      "mainStar": "元男",
      "hiddenStems": [
        {
          "stem": "丁",
          "tenStar": "劫财",
          "type": "本气"
        },
        {
          "stem": "己",
          "tenStar": "伤官",
          "type": "中气"
        }
      ],
      "stage": "帝旺",
      "selfSit": "帝旺",
      "voidBranches": "寅卯",
      "naYin": "天河水",
      "shenSha": [
        "太极贵人",
        "文昌贵人",
        "天厨贵人",
        "六秀日",
        "孤鸾煞",
        "阴差阳错",
        "童子煞",
        "桃花",
        "元辰",
        "羊刃"
      ]
    })
  })

  it('时柱明细九行＋原局神煞', () => {
    expect(r.detail.hour).toEqual({
      "ganZhi": "癸巳",
      "stem": "癸",
      "branch": "巳",
      "mainStar": "正官",
      "hiddenStems": [
        {
          "stem": "丙",
          "tenStar": "比肩",
          "type": "本气"
        },
        {
          "stem": "庚",
          "tenStar": "偏财",
          "type": "中气"
        },
        {
          "stem": "戊",
          "tenStar": "食神",
          "type": "余气"
        }
      ],
      "stage": "临官",
      "selfSit": "胎",
      "voidBranches": "午未",
      "naYin": "长流水",
      "shenSha": [
        "天德合",
        "天厨贵人",
        "学堂",
        "亡神",
        "禄神",
        "金舆"
      ]
    })
  })

  it('大运 20 步首尾＋起运数＋交运日期', () => {
    expect(r.fortuneForward).toBe(false)
    expect(r.daYun.length).toBe(20)
    expect(r.decadeFortunes).toEqual(["戊寅","丁丑","丙子","乙亥","甲戌","癸酉","壬申","辛未","庚午","己巳"])
    expect(r.daYun[0]).toMatchObject({ ganZhi: '戊寅', startYear: 1986, startAge: 2 })
    expect(r.daYun[19]).toMatchObject({ ganZhi: '己未', startYear: 2176, startAge: 192 })
    expect(r.childLimit).toEqual({"year":0,"month":9,"day":26,"hour":3,"minute":0})
    expect(r.qiYunDate).toBe('1986-01-03')
  })

  it('preYun 小运期＋流年条首年（含小运）', () => {
    expect(r.preYun.startYear).toBe(1985)
    expect(r.preYun.endAge).toBe(2)
    expect(r.preYun.liuNian.map((l) => [l.year, l.ganZhi, l.xiaoYun])).toEqual([[1985,"乙丑","壬辰"]])
    expect(r.daYun[0].liuNian.length).toBe(10)
    expect(r.daYun[0].liuNian[0]).toMatchObject({"year":1986,"ganZhi":"丙寅","xiaoYun":"辛卯"})
  })

  it('胎命身＋胎息（含三宫神煞）', () => {
    expect(r.taiMingShen.taiYuan.ganZhi).toBe('庚午')
    expect(r.taiMingShen.mingGong.ganZhi).toBe('乙酉')
    expect(r.taiMingShen.shenGong.ganZhi).toBe('乙酉')
    expect(r.taiMingShen.taiXi).toBe('辛未')
    expect(r.taiMingShen.taiYuan.shenSha).toEqual(["太极贵人","文昌贵人","天厨贵人","将星","桃花","元辰","羊刃"])
    expect(r.taiMingShen.mingGong.shenSha).toEqual(["天乙贵人","太极贵人","德秀贵人","将星"])
    expect(r.taiMingShen.shenGong.shenSha).toEqual(["天乙贵人","太极贵人","德秀贵人","将星"])
  })

  it('命卦 / 星宿 / 司令', () => {
    expect(r.mingGua).toEqual({"name":"乾卦","group":"西四命"})
    expect(r.xingXiu).toBe('牛')
    expect(r.siLing).toBe('甲')
  })

  it('反推闭环：正排四柱 → 候选含本生辰', () => {
    const c = reverseFourPillars('乙丑', '己卯', '丙午', '癸巳', { ziShiSect: 'wenzhen' })
      .find((x) => x.solar.startsWith('1985-03-08'))
    expect(c).toBeTruthy()
    expect(c!.hh).toBeGreaterThanOrEqual(9)
    expect(c!.hh).toBeLessThan(11)
  })

  it('流钻取 · 2024 甲辰流年 → 十二流月首末', () => {
    const ln = r.daYun.flatMap((d) => d.liuNian).find((l) => l.year === 2024)!
    expect(ln.ganZhi).toBe('甲辰')
    const months = liuYue(ln.ganZhi, 2024)
    expect(months.length).toBe(12)
    expect(months[0]).toEqual({"term":"立春","month":2,"day":4,"ganZhi":"丙寅"})
    expect(months[11]).toEqual({"term":"小寒","month":1,"day":5,"ganZhi":"丁丑"})
    expect(months.map((m) => m.ganZhi)).toEqual(["丙寅","丁卯","戊辰","己巳","庚午","辛未","壬申","癸酉","甲戌","乙亥","丙子","丁丑"])
  })

  it('流钻取 · 2024 清明月流日：交节起、次节止', () => {
    const ds = liuRi(2024, '清明')
    expect(ds.length).toBe(32)
    expect(ds[0]).toEqual({"y":2024,"month":4,"day":4,"lunar":"廿六","ganZhi":"戊戌"})
    expect(ds[ds.length - 1]).toEqual({"y":2024,"month":5,"day":5,"lunar":"廿七","ganZhi":"己巳"})
  })

  it('流钻取 · 戊戌日流时 12 格（干支历制，子起前日 23:00）', () => {
    const shi = liuShi('戊戌')
    expect(shi.length).toBe(12)
    expect(shi[0]).toEqual({"label":"子","start":"23:00","ganZhi":"壬子"})
    expect(shi[5]).toEqual({"label":"巳","start":"09:00","ganZhi":"丁巳"})
    expect(shi[11]).toEqual({"label":"亥","start":"21:00","ganZhi":"癸亥"})
  })
})

describe('S2 晚子时两派（合成）· 1993-04-04 23:30 乾造', () => {
  it('wenzhen 派：日柱当天、时柱次日子干', () => {
    const r = computeChart({ clock: { y: 1993, m: 4, d: 4, hh: 23, mi: 30 }, gender: '乾', trueSolar: false })
    expect(P(r)).toBe('癸酉 乙卯 乙卯 戊子')
  })

  it('huanri 派：日柱换次日，时柱与 wenzhen 派同为次日子干', () => {
    const r = computeChart({ clock: { y: 1993, m: 4, d: 4, hh: 23, mi: 30 }, gender: '乾', trueSolar: false, ziShiSect: 'huanri' })
    expect(r.pillars.day).toBe('丙辰')
    expect(r.pillars.hour).toBe('戊子')
  })

  it('晚子反推闭环：wenzhen 四柱 → 候选含 1993-04-04 23:00（走月末回拨补偿分支）', () => {
    const c = reverseFourPillars('癸酉', '乙卯', '乙卯', '戊子', { ziShiSect: 'wenzhen' })
      .find((x) => x.solar.startsWith('1993-04-04 23:'))
    expect(c).toBeTruthy()
    expect(c!.hh).toBe(23)
  })
})

describe('真太阳时（合成）', () => {
  it('S3 · 1998-10-05 12:00 东经 116.407：时刻修正锁值', () => {
    const r = computeChart({ clock: { y: 1998, m: 10, d: 5, hh: 12, mi: 0 }, gender: '乾', lon: 116.407 })
    expect(r.trueSolarClock).toMatchObject({"y":1998,"m":10,"d":5,"hh":11,"mi":57})
    expect(P(r)).toBe('戊寅 辛酉 乙酉 壬午')
  })

  it('跨年 · 1990-01-01 00:05 东经 104.07（合成审查用例，非真实）：真太阳时退回 1989-12-31，birthYear 同基准', () => {
    const r = computeChart({ clock: { y: 1990, m: 1, d: 1, hh: 0, mi: 5 }, gender: '乾', lon: 104.07 })
    expect([r.trueSolarClock.y, r.trueSolarClock.m, r.trueSolarClock.d]).toEqual([1989, 12, 31])
    expect(r.birthYear).toBe(1989)
    expect(P(r)).toBe('己巳 丙子 乙丑 丁亥')
    expect(r.daYun[0].startYear).toBe(Number(r.qiYunDate.slice(0, 4)))
  })
})

describe('夏令时（合成）· 1988-07-15 11:30 dst', () => {
  it('dst 盘＝钟表减 1 小时盘（四柱逐柱一致，时支锁值）', () => {
    const a = computeChart({ clock: { y: 1988, m: 7, d: 15, hh: 11, mi: 30 }, gender: '坤', dst: true, trueSolar: false })
    const b = computeChart({ clock: { y: 1988, m: 7, d: 15, hh: 10, mi: 30 }, gender: '坤', trueSolar: false })
    expect(a.pillars).toEqual(b.pillars)
    expect(a.trueSolarClock.hh).toBe(10)
    expect(P(a)).toBe('戊辰 己未 辛未 癸巳')
    expect(a.detail.hour.branch).toBe('巳')
  })
})

describe('农历闰月（合成）· 2001 闰四月', () => {
  it('solarToLunar / lunarToSolar 往返', () => {
    expect(solarToLunar(2001, 6, 1)).toEqual({"y":2001,"m":-4,"d":10})
    expect(lunarToSolar(2001, -4, 10, 8, 0)).toMatchObject({"y":2001,"m":6,"d":1})
    expect(lunarMonthsOf(2001).length).toBe(13)
    expect(lunarDaysOf(2001, -4).length).toBe(29)
  })

  it('lunarLabel 闰月名', () => {
    const r = computeChart({ clock: { y: 2001, m: 6, d: 1, hh: 8, mi: 0 }, gender: '坤', trueSolar: false })
    expect(r.lunarLabel).toBe('2001年闰四月初十')
  })
})
