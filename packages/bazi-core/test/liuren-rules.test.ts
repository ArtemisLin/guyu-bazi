/**
 * 六壬动态神煞规则测试 — 独立双通道转译之【测试通道】（docs/10 §〇-3 纪律）。
 *
 * 通道隔离声明：
 * - 本文件全部期望值只从 reference/shensha-diaoyan-20260731.json 的
 *   result.liuren.families[].items[].qifa（古籍逐位全表原文）逐条转录；
 * - 未读 docs/11、未读 src/liurenRegistry.ts 的表数据部分（那是另一条转译通道，
 *   两边靠本测试 diff 互相纠错）；LIUREN_RULES 仅用于按 id 取规则对象喂给被测 API；
 * - 逐位表直接抄 qifa 原文（如大耗「子年午、丑年未…」逐条），不做口诀速算公式推导。
 *   qifa 只给「岁后N辰」类逐位规则＋首例锚点的（病符/岁虎），按原文逐位数出全表并在注释标明。
 *
 * 口径取舍（qifa 有多口径时取「高置信/六壬大全」侧，转录依据见各表注释）：
 * - sanhe12 三合十二煞：JSON 条目名「将前十二神」，按其 note 与六壬大全卷一歌诀
 *   『劫杀灾杀岁杀知，天杀月杀地杀齐。亡神将星扳鞍是，驿马六厄华盖驰』换算五个异名位
 *   （将前系天煞未/指背申/咸池酉/月煞戌/息神卯 → 三合系岁煞/天煞/月煞/地煞/六厄），
 *   自三合绝位起劫煞顺行，逐位与 qifa 全表（申子辰年＝将星子…亡神亥 等四表）对齐。
 * - suiQian12 岁前十二神：序＝JSON notes『太岁太阳丧门太阴官符死符岁破龙德白虎福德吊客病符』，
 *   逐位锚点全部来自 JSON 原文：丧门=岁前二（子年寅）、官符=岁前四、死符=岁前五（与小耗同位）、
 *   岁破=岁前六（大耗=太岁对冲）、白虎=岁前八、吊客=岁后二（子年戌）、病符=岁后一（子年亥）。
 - wenChangLr 文昌：2026-07-31 双通道 diff 仲裁——首发名单（docs/11:91）＝高置信「文昌贵人」表
 *   （甲巳乙午丙戊申丁己酉庚亥辛子壬寅癸卯，JSON confidence:high，与原局文昌同表），动态按流日干起；
 *   「文星（六壬版）」（甲乙亥…，medium、后三组单源）不在首发名单，等用户裁决——本文件初稿曾误取文星表，
 *   经回源仲裁改为文昌高置信表（正是双通道要抓的映射错误，通道纪律未破：期望仍逐位转录自 JSON qifa 原文）。
 * - xunQi 旬奇：甲子·甲戌旬丑、甲申·甲午旬子、甲辰·甲寅旬亥。
 * - jieLu 截路空亡：干表主口径 甲己申酉、乙庚午未、丙辛辰巳、丁壬寅卯、戊癸戌亥。
 */
import { describe, expect, it } from 'vitest'
import { liurenPanel, resolveLiurenRing, resolveLiurenRule } from '../src/liurenPanel'
import type { LiurenSection } from '../src/liurenPanel'
import { LIUREN_RULES } from '../src/liurenRegistry'
import type { LiurenRule } from '../src/liurenRegistry'

const sorted = (a: string[]) => [...a].sort()

/** 按 id 取规则对象（仅此用途，不读其表数据） */
const R = (id: string): LiurenRule => {
  const r = LIUREN_RULES.find((x) => x.id === id)
  if (!r) throw new Error(`注册表缺规则 ${id}`)
  return r
}

/** 支→合法配干锚（甲子乙丑丙寅丁卯戊辰己巳庚午辛未壬申癸酉甲戌乙亥） */
const GZ: Record<string, string> = {
  子: '甲子', 丑: '乙丑', 寅: '丙寅', 卯: '丁卯', 辰: '戊辰', 巳: '己巳',
  午: '庚午', 未: '辛未', 申: '壬申', 酉: '癸酉', 戌: '甲戌', 亥: '乙亥',
}
/** 干→合法锚干支 */
const SG: Record<string, string> = {
  甲: '甲子', 乙: '乙丑', 丙: '丙寅', 丁: '丁卯', 戊: '戊辰',
  己: '己巳', 庚: '庚午', 辛: '辛未', 壬: '壬申', 癸: '癸酉',
}

type Tbl = Record<string, string | string[]>
const arr = (v: string | string[]): string[] => (typeof v === 'string' ? [v] : v)

/** 逐位比对：锚集合由 anchor 函数把表键映射成合法干支串 */
const check = (id: string, table: Tbl, anchor: (key: string) => string) => {
  for (const [key, want] of Object.entries(table)) {
    expect(sorted(resolveLiurenRule(R(id), anchor(key))), `${id}@${key}`).toEqual(sorted(arr(want)))
  }
}
const checkBranch = (id: string, table: Tbl) => check(id, table, (k) => GZ[k])
const checkStem = (id: string, table: Tbl) => check(id, table, (k) => SG[k])
/** 键本身就是完整干支锚（旬类） */
const checkGz = (id: string, table: Tbl) => check(id, table, (k) => k)

// ════════ 契约 id 存在性（红阶段诊断） ════════

const ALL_IDS = [
  'suiQian12', 'sanhe12', 'daHao', 'xiaoHao', 'huangFan', 'baoWei', 'bingFu', 'suiHu',
  'tianMu', 'tianEr', 'tianXiJi', 'xiShen', 'siFeiZhi', 'jiGu', 'jiGua', 'heSan', 'sangChe', 'guanShen', 'tianZhuan', 'diZhuan',
  'yueDeLr', 'shengQi', 'siQi', 'tianZhao', 'muMen', 'chengShen', 'shengXin', 'tianMaYue', 'tianWu', 'huangShu', 'tianSheDyn',
  'xueZhi', 'xueJi', 'yueYan', 'wangWang', 'yuePo', 'sanQiu', 'wuMu',
  'xunKongDyn', 'xunYi', 'xunQi', 'jieLu',
  'riLu', 'riDeLr', 'yangRenLr', 'wenChangLr', 'fuXingLr', 'zhiFu', 'ganYi',
  'zhiMa', 'zhiXing', 'zhiChong', 'zhiPo', 'zhiHai', 'poSui', 'zhiYi',
]

describe('六壬规则注册表 · 契约 id', () => {
  it('56 条契约 id 全部存在', () => {
    for (const id of ALL_IDS) {
      expect(LIUREN_RULES.some((r) => r.id === id), id).toBe(true)
    }
  })
})

// ════════ 一、逐位全表比对 ════════

describe('岁族 · 逐位全表（锚＝流年支）', () => {
  it('daHao 大耗＝太岁对冲（qifa 子年午、丑年未…逐条原文）', () => {
    checkBranch('daHao', {
      子: '午', 丑: '未', 寅: '申', 卯: '酉', 辰: '戌', 巳: '亥',
      午: '子', 未: '丑', 申: '寅', 酉: '卯', 戌: '辰', 亥: '巳',
    })
  })

  it('xiaoHao 小耗＝岁前五辰（qifa 子年巳、丑年午…逐条原文）', () => {
    checkBranch('xiaoHao', {
      子: '巳', 丑: '午', 寅: '未', 卯: '申', 辰: '酉', 巳: '戌',
      午: '亥', 未: '子', 申: '丑', 酉: '寅', 戌: '卯', 亥: '辰',
    })
  })

  it('huangFan 黄幡＝三合墓辰（qifa 寅午戌年戌、申子辰年辰、巳酉丑年丑、亥卯未年未）', () => {
    checkBranch('huangFan', {
      子: '辰', 丑: '丑', 寅: '戌', 卯: '未', 辰: '辰', 巳: '丑',
      午: '戌', 未: '未', 申: '辰', 酉: '丑', 戌: '戌', 亥: '未',
    })
  })

  it('baoWei 豹尾＝黄幡对冲（qifa 寅午戌年辰、申子辰年戌、巳酉丑年未、亥卯未年丑）', () => {
    checkBranch('baoWei', {
      子: '戌', 丑: '未', 寅: '辰', 卯: '丑', 辰: '戌', 巳: '未',
      午: '辰', 未: '丑', 申: '戌', 酉: '未', 戌: '辰', 亥: '丑',
    })
  })

  it('bingFu 病符＝岁后一辰（qifa 子年亥、丑年子，逐位后退一支数出全表）', () => {
    checkBranch('bingFu', {
      子: '亥', 丑: '子', 寅: '丑', 卯: '寅', 辰: '卯', 巳: '辰',
      午: '巳', 未: '午', 申: '未', 酉: '申', 戌: '酉', 亥: '戌',
    })
  })

  it('suiHu 岁虎＝岁后四辰（qifa 子年申、丑年酉，逐位后退四支数出全表）', () => {
    checkBranch('suiHu', {
      子: '申', 丑: '酉', 寅: '戌', 卯: '亥', 辰: '子', 巳: '丑',
      午: '寅', 未: '卯', 申: '辰', 酉: '巳', 戌: '午', 亥: '未',
    })
  })
})

describe('季族 · 四季代表月支（春寅／夏巳／秋申／冬亥）', () => {
  it('tianMu 天目：春辰、夏未、秋戌、冬丑', () => {
    checkBranch('tianMu', { 寅: '辰', 巳: '未', 申: '戌', 亥: '丑' })
  })
  it('tianEr 天耳＝天目对冲：春戌、夏丑、秋辰、冬未', () => {
    checkBranch('tianEr', { 寅: '戌', 巳: '丑', 申: '辰', 亥: '未' })
  })
  it('tianXiJi 天喜(季)：春戌、夏丑、秋辰、冬未（四时养宫，与天耳同位）', () => {
    checkBranch('tianXiJi', { 寅: '戌', 巳: '丑', 申: '辰', 亥: '未' })
  })
  it('xiShen 戏神：春巳、夏子、秋酉、冬辰', () => {
    checkBranch('xiShen', { 寅: '巳', 巳: '子', 申: '酉', 亥: '辰' })
  })
  it('siFeiZhi 四废(支版)：春酉、夏子、秋卯、冬午', () => {
    checkBranch('siFeiZhi', { 寅: '酉', 巳: '子', 申: '卯', 亥: '午' })
  })
  it('jiGu 孤辰(季)：春巳、夏申、秋亥、冬寅', () => {
    checkBranch('jiGu', { 寅: '巳', 巳: '申', 申: '亥', 亥: '寅' })
  })
  it('jiGua 寡宿(季)：春丑、夏辰、秋未、冬戌', () => {
    checkBranch('jiGua', { 寅: '丑', 巳: '辰', 申: '未', 亥: '戌' })
  })
  it('heSan 喝散：春巳、夏申、秋亥、冬寅（与孤辰同位）', () => {
    checkBranch('heSan', { 寅: '巳', 巳: '申', 申: '亥', 亥: '寅' })
  })
  it('sangChe 丧车：春酉、夏子、秋卯、冬午（与四废同位）', () => {
    checkBranch('sangChe', { 寅: '酉', 巳: '子', 申: '卯', 亥: '午' })
  })
  it('guanShen 关神：春丑、夏辰、秋未、冬戌（与寡宿同位）', () => {
    checkBranch('guanShen', { 寅: '丑', 巳: '辰', 申: '未', 亥: '戌' })
  })
  it('tianZhuan 天转：春乙卯、夏丙午、秋辛酉、冬壬子（判日柱干支）', () => {
    checkBranch('tianZhuan', { 寅: '乙卯', 巳: '丙午', 申: '辛酉', 亥: '壬子' })
  })
  it('diZhuan 地转：春辛卯、夏戊午、秋癸酉、冬丙子（判日柱干支）', () => {
    checkBranch('diZhuan', { 寅: '辛卯', 巳: '戊午', 申: '癸酉', 亥: '丙子' })
  })
})

describe('月族 · 12 月支全表（正月＝寅…腊月＝丑）', () => {
  it('yueDeLr 月德(六壬)：巳寅亥申三轮（正月巳、二月寅、三月亥、四月申周而复始）', () => {
    checkBranch('yueDeLr', {
      寅: '巳', 卯: '寅', 辰: '亥', 巳: '申', 午: '巳', 未: '寅',
      申: '亥', 酉: '申', 戌: '巳', 亥: '寅', 子: '亥', 丑: '申',
    })
  })

  it('shengQi 生气：qifa 全表 正子二丑三寅四卯五辰六巳七午八未九申十酉冬戌腊亥', () => {
    checkBranch('shengQi', {
      寅: '子', 卯: '丑', 辰: '寅', 巳: '卯', 午: '辰', 未: '巳',
      申: '午', 酉: '未', 戌: '申', 亥: '酉', 子: '戌', 丑: '亥',
    })
  })

  it('siQi 死气＝生气对冲，正月起午顺行十二', () => {
    checkBranch('siQi', {
      寅: '午', 卯: '未', 辰: '申', 巳: '酉', 午: '戌', 未: '亥',
      申: '子', 酉: '丑', 戌: '寅', 亥: '卯', 子: '辰', 丑: '巳',
    })
  })

  it('tianZhao 天诏：正月起亥顺行十二（正亥、二子、三丑…）', () => {
    checkBranch('tianZhao', {
      寅: '亥', 卯: '子', 辰: '丑', 巳: '寅', 午: '卯', 未: '辰',
      申: '巳', 酉: '午', 戌: '未', 亥: '申', 子: '酉', 丑: '戌',
    })
  })

  it('muMen 墓门：亥申巳寅三轮（正月亥、二月申、三月巳、四月寅周而复始）', () => {
    checkBranch('muMen', {
      寅: '亥', 卯: '申', 辰: '巳', 巳: '寅', 午: '亥', 未: '申',
      申: '巳', 酉: '寅', 戌: '亥', 亥: '申', 子: '巳', 丑: '寅',
    })
  })

  it('chengShen 成神：巳申亥寅三轮（正月巳、二月申、三月亥、四月寅周而复始）', () => {
    checkBranch('chengShen', {
      寅: '巳', 卯: '申', 辰: '亥', 巳: '寅', 午: '巳', 未: '申',
      申: '亥', 酉: '寅', 戌: '巳', 亥: '申', 子: '亥', 丑: '寅',
    })
  })

  it('shengXin 圣心：qifa 全表 正亥二巳三子四午五丑六未七寅八申九卯十酉冬辰腊戌', () => {
    checkBranch('shengXin', {
      寅: '亥', 卯: '巳', 辰: '子', 巳: '午', 午: '丑', 未: '未',
      申: '寅', 酉: '申', 戌: '卯', 亥: '酉', 子: '辰', 丑: '戌',
    })
  })

  it('tianMaYue 天马(流月)：正午二申三戌四子五寅六辰，周而复始（午顺六阳）', () => {
    checkBranch('tianMaYue', {
      寅: '午', 卯: '申', 辰: '戌', 巳: '子', 午: '寅', 未: '辰',
      申: '午', 酉: '申', 戌: '戌', 亥: '子', 子: '寅', 丑: '辰',
    })
  })

  it('tianWu 天巫：正月起辰顺行十二', () => {
    checkBranch('tianWu', {
      寅: '辰', 卯: '巳', 辰: '午', 巳: '未', 午: '申', 未: '酉',
      申: '戌', 酉: '亥', 戌: '子', 亥: '丑', 子: '寅', 丑: '卯',
    })
  })

  it('huangShu 皇书：春寅、夏巳、秋申、冬亥（按月建所属季）', () => {
    checkBranch('huangShu', { 寅: '寅', 巳: '巳', 申: '申', 亥: '亥' })
  })

  it('tianSheDyn 天赦：春戊寅、夏甲午、秋戊申、冬甲子（判流日干支全合）', () => {
    checkBranch('tianSheDyn', { 寅: '戊寅', 巳: '甲午', 申: '戊申', 亥: '甲子' })
  })

  it('xueZhi 血支：正月起丑顺行十二', () => {
    checkBranch('xueZhi', {
      寅: '丑', 卯: '寅', 辰: '卯', 巳: '辰', 午: '巳', 未: '午',
      申: '未', 酉: '申', 戌: '酉', 亥: '戌', 子: '亥', 丑: '子',
    })
  })

  it('xueJi 血忌：qifa 全表 正丑二未三寅四申五卯六酉七辰八戌九巳十亥冬午腊子', () => {
    checkBranch('xueJi', {
      寅: '丑', 卯: '未', 辰: '寅', 巳: '申', 午: '卯', 未: '酉',
      申: '辰', 酉: '戌', 戌: '巳', 亥: '亥', 子: '午', 丑: '子',
    })
  })

  it('yueYan 月厌：正月起戌逆行十二（正戌、二酉、三申…）', () => {
    checkBranch('yueYan', {
      寅: '戌', 卯: '酉', 辰: '申', 巳: '未', 午: '午', 未: '巳',
      申: '辰', 酉: '卯', 戌: '寅', 亥: '丑', 子: '子', 丑: '亥',
    })
  })

  it('wangWang 往亡：qifa 全表 正寅二巳三申四亥五卯六午七酉八子九辰十未冬戌腊丑', () => {
    checkBranch('wangWang', {
      寅: '寅', 卯: '巳', 辰: '申', 巳: '亥', 午: '卯', 未: '午',
      申: '酉', 酉: '子', 戌: '辰', 亥: '未', 子: '戌', 丑: '丑',
    })
  })

  it('yuePo 月破＝月建对冲（qifa 寅月申、卯月酉…）', () => {
    checkBranch('yuePo', {
      寅: '申', 卯: '酉', 辰: '戌', 巳: '亥', 午: '子', 未: '丑',
      申: '寅', 酉: '卯', 戌: '辰', 亥: '巳', 子: '午', 丑: '未',
    })
  })

  it('sanQiu 三丘：春丑、夏辰、秋戌、冬未（按月建所属季）', () => {
    // 2026-08-02 终案（用户亲授起法，推翻此前全部文献口径）：三丘＝四季长生之墓——
    // 春木长生亥(水)→水墓辰；夏火长生寅(木)→木墓未；秋金长生巳(火)→火墓戌；冬水长生申(金)→金墓丑。
    // app 夏＝未、冬＝丑 两锚均吻合（docs/12 L2/L7）。
    checkBranch('sanQiu', { 寅: '辰', 巳: '未', 申: '戌', 亥: '丑' })
  })

  it('wuMu 五墓＝三丘对冲：春未、夏戌、秋丑、冬辰（四季五行墓库）', () => {
    checkBranch('wuMu', { 寅: '未', 巳: '戌', 申: '丑', 亥: '辰' })
  })
})

describe('旬族 · 六旬各一代表干支', () => {
  // 代表锚（已核对旬首）：甲子∈甲子旬、乙亥∈甲戌旬、丙戌∈甲申旬、丙申∈甲午旬、丁未∈甲辰旬、戊午∈甲寅旬
  it('xunKongDyn 旬空：甲子旬戌亥、甲戌旬申酉、甲申旬午未、甲午旬辰巳、甲辰旬寅卯、甲寅旬子丑', () => {
    checkGz('xunKongDyn', {
      甲子: ['戌', '亥'], 乙亥: ['申', '酉'], 丙戌: ['午', '未'],
      丙申: ['辰', '巳'], 丁未: ['寅', '卯'], 戊午: ['子', '丑'],
    })
  })

  it('xunYi 旬仪＝旬首之支：甲子旬子、甲戌旬戌、甲申旬申、甲午旬午、甲辰旬辰、甲寅旬寅', () => {
    checkGz('xunYi', {
      甲子: '子', 乙亥: '戌', 丙戌: '申', 丙申: '午', 丁未: '辰', 戊午: '寅',
    })
  })

  it('xunQi 旬奇：甲子·甲戌旬丑、甲申·甲午旬子、甲辰·甲寅旬亥', () => {
    checkGz('xunQi', {
      甲子: '丑', 乙亥: '丑', 丙戌: '子', 丙申: '子', 丁未: '亥', 戊午: '亥',
    })
  })

  it('jieLu 截路空亡（干表）：甲己申酉、乙庚午未、丙辛辰巳、丁壬寅卯、戊癸戌亥', () => {
    checkStem('jieLu', {
      甲: ['申', '酉'], 己: ['申', '酉'], 乙: ['午', '未'], 庚: ['午', '未'],
      丙: ['辰', '巳'], 辛: ['辰', '巳'], 丁: ['寅', '卯'], 壬: ['寅', '卯'],
      戊: ['戌', '亥'], 癸: ['戌', '亥'],
    })
  })
})

describe('日干族 · 10 干全表', () => {
  it('riLu 日禄：甲寅乙卯、丙戊巳、丁己午、庚申辛酉、壬亥癸子', () => {
    checkStem('riLu', {
      甲: '寅', 乙: '卯', 丙: '巳', 丁: '午', 戊: '巳',
      己: '午', 庚: '申', 辛: '酉', 壬: '亥', 癸: '子',
    })
  })

  it('riDeLr 日德(六壬)：甲己日寅、乙庚日申、丙辛日巳、丁壬日亥、戊癸日巳', () => {
    checkStem('riDeLr', {
      甲: '寅', 己: '寅', 乙: '申', 庚: '申', 丙: '巳',
      辛: '巳', 丁: '亥', 壬: '亥', 戊: '巳', 癸: '巳',
    })
  })

  it('yangRenLr 羊刃(六壬)＝禄前一位：卯辰午未午未酉戌子丑', () => {
    checkStem('yangRenLr', {
      甲: '卯', 乙: '辰', 丙: '午', 丁: '未', 戊: '午',
      己: '未', 庚: '酉', 辛: '戌', 壬: '子', 癸: '丑',
    })
  })

  it('wenChangLr 文昌＝甲巳乙午丙戊申丁己酉庚亥辛子壬寅癸卯（高置信，与原局同表）', () => {
    checkStem('wenChangLr', {
      甲: '巳', 乙: '午', 丙: '申', 丁: '酉', 戊: '申',
      己: '酉', 庚: '亥', 辛: '子', 壬: '寅', 癸: '卯',
    })
  })

  it('fuXingLr 福星(六壬)：六壬大全干表 子丑子子未未丑丑巳巳', () => {
    checkStem('fuXingLr', {
      甲: '子', 乙: '丑', 丙: '子', 丁: '子', 戊: '未',
      己: '未', 庚: '丑', 辛: '丑', 壬: '巳', 癸: '巳',
    })
  })

  it('zhiFu 直符(飞符)：甲巳乙辰丙卯丁寅戊丑、己午庚未辛申壬酉癸戌', () => {
    checkStem('zhiFu', {
      甲: '巳', 乙: '辰', 丙: '卯', 丁: '寅', 戊: '丑',
      己: '午', 庚: '未', 辛: '申', 壬: '酉', 癸: '戌',
    })
  })

  it('ganYi 干仪(日仪)：甲午起逆行至己丑，庚未起顺行至癸戌', () => {
    checkStem('ganYi', {
      甲: '午', 乙: '巳', 丙: '辰', 丁: '卯', 戊: '寅',
      己: '丑', 庚: '未', 辛: '申', 壬: '酉', 癸: '戌',
    })
  })
})

describe('日支族 · 12 支全表', () => {
  it('zhiMa 支马：申子辰日寅、寅午戌日申、巳酉丑日亥、亥卯未日巳', () => {
    checkBranch('zhiMa', {
      子: '寅', 丑: '亥', 寅: '申', 卯: '巳', 辰: '寅', 巳: '亥',
      午: '申', 未: '巳', 申: '寅', 酉: '亥', 戌: '申', 亥: '巳',
    })
  })

  it('zhiXing 支刑：qifa 全表（子→亥）卯戌巳子辰申午丑寅酉未亥', () => {
    checkBranch('zhiXing', {
      子: '卯', 丑: '戌', 寅: '巳', 卯: '子', 辰: '辰', 巳: '申',
      午: '午', 未: '丑', 申: '寅', 酉: '酉', 戌: '未', 亥: '亥',
    })
  })

  it('zhiChong 支冲＝对宫：子午、丑未、寅申、卯酉、辰戌、巳亥', () => {
    checkBranch('zhiChong', {
      子: '午', 丑: '未', 寅: '申', 卯: '酉', 辰: '戌', 巳: '亥',
      午: '子', 未: '丑', 申: '寅', 酉: '卯', 戌: '辰', 亥: '巳',
    })
  })

  it('zhiPo 支破：qifa 全表（子→亥）酉辰亥午丑申卯戌巳子未寅', () => {
    checkBranch('zhiPo', {
      子: '酉', 丑: '辰', 寅: '亥', 卯: '午', 辰: '丑', 巳: '申',
      午: '卯', 未: '戌', 申: '巳', 酉: '子', 戌: '未', 亥: '寅',
    })
  })

  it('zhiHai 支害：子未、丑午、寅巳、卯辰、申亥、酉戌相害', () => {
    checkBranch('zhiHai', {
      子: '未', 丑: '午', 寅: '巳', 卯: '辰', 辰: '卯', 巳: '寅',
      午: '丑', 未: '子', 申: '亥', 酉: '戌', 戌: '酉', 亥: '申',
    })
  })

  it('poSui 破碎煞：四仲(子午卯酉)见巳、四孟(寅申巳亥)见酉、四季(辰戌丑未)见丑', () => {
    checkBranch('poSui', {
      子: '巳', 午: '巳', 卯: '巳', 酉: '巳',
      寅: '酉', 申: '酉', 巳: '酉', 亥: '酉',
      辰: '丑', 戌: '丑', 丑: '丑', 未: '丑',
    })
  })

  it('zhiYi 支仪：子日午起逆行（子午丑巳寅辰卯卯辰寅巳丑），午日未起顺行（午未…亥子）', () => {
    checkBranch('zhiYi', {
      子: '午', 丑: '巳', 寅: '辰', 卯: '卯', 辰: '寅', 巳: '丑',
      午: '未', 未: '申', 申: '酉', 酉: '戌', 戌: '亥', 亥: '子',
    })
  })
})

// ════════ 二、ring 全序 ════════

describe('ring 全序', () => {
  // 岁前十二神：太岁＝流年支起顺行，序＝太岁太阳丧门太阴官符死符岁破龙德白虎福德吊客病符
  // （JSON 原文锚：丧门岁前二·子年寅、官符岁前四、死符岁前五、岁破岁前六＝太岁冲、白虎岁前八、吊客岁后二·子年戌、病符岁后一·子年亥）
  it('suiQian12 @子：太岁子顺行十二', () => {
    expect(resolveLiurenRing(R('suiQian12'), '甲子')).toEqual([
      { branch: '子', name: '太岁' }, { branch: '丑', name: '太阳' }, { branch: '寅', name: '丧门' },
      { branch: '卯', name: '太阴' }, { branch: '辰', name: '官符' }, { branch: '巳', name: '死符' },
      { branch: '午', name: '岁破' }, { branch: '未', name: '龙德' }, { branch: '申', name: '白虎' },
      { branch: '酉', name: '福德' }, { branch: '戌', name: '吊客' }, { branch: '亥', name: '病符' },
    ])
  })

  it('suiQian12 @巳：太岁巳顺行十二', () => {
    expect(resolveLiurenRing(R('suiQian12'), '己巳')).toEqual([
      { branch: '巳', name: '太岁' }, { branch: '午', name: '太阳' }, { branch: '未', name: '丧门' },
      { branch: '申', name: '太阴' }, { branch: '酉', name: '官符' }, { branch: '戌', name: '死符' },
      { branch: '亥', name: '岁破' }, { branch: '子', name: '龙德' }, { branch: '丑', name: '白虎' },
      { branch: '寅', name: '福德' }, { branch: '卯', name: '吊客' }, { branch: '辰', name: '病符' },
    ])
  })

  // 三合十二煞：六壬大全名序 劫灾岁天月地亡将攀驿六厄华盖，自三合绝位起劫煞顺行。
  // 逐位换算自 qifa 将前全表＋note 五异名位（例申子辰：将星子攀鞍丑岁驿寅息神卯华盖辰劫煞巳灾煞午[天煞→岁煞]未[指背→天煞]申[咸池→月煞]酉[月煞→地煞]戌亡神亥）
  it('sanhe12 @申（申子辰局，劫煞起巳）', () => {
    expect(resolveLiurenRing(R('sanhe12'), '壬申')).toEqual([
      { branch: '巳', name: '劫煞' }, { branch: '午', name: '灾煞' }, { branch: '未', name: '岁煞' },
      { branch: '申', name: '天煞' }, { branch: '酉', name: '月煞' }, { branch: '戌', name: '地煞' },
      { branch: '亥', name: '亡神' }, { branch: '子', name: '将星' }, { branch: '丑', name: '攀鞍' },
      { branch: '寅', name: '驿马' }, { branch: '卯', name: '六厄' }, { branch: '辰', name: '华盖' },
    ])
  })

  it('sanhe12 @巳（巳酉丑局，劫煞起寅）', () => {
    expect(resolveLiurenRing(R('sanhe12'), '己巳')).toEqual([
      { branch: '寅', name: '劫煞' }, { branch: '卯', name: '灾煞' }, { branch: '辰', name: '岁煞' },
      { branch: '巳', name: '天煞' }, { branch: '午', name: '月煞' }, { branch: '未', name: '地煞' },
      { branch: '申', name: '亡神' }, { branch: '酉', name: '将星' }, { branch: '戌', name: '攀鞍' },
      { branch: '亥', name: '驿马' }, { branch: '子', name: '六厄' }, { branch: '丑', name: '华盖' },
    ])
  })

  it('sanhe12 @午（寅午戌局，劫煞起亥）', () => {
    expect(resolveLiurenRing(R('sanhe12'), '庚午')).toEqual([
      { branch: '亥', name: '劫煞' }, { branch: '子', name: '灾煞' }, { branch: '丑', name: '岁煞' },
      { branch: '寅', name: '天煞' }, { branch: '卯', name: '月煞' }, { branch: '辰', name: '地煞' },
      { branch: '巳', name: '亡神' }, { branch: '午', name: '将星' }, { branch: '未', name: '攀鞍' },
      { branch: '申', name: '驿马' }, { branch: '酉', name: '六厄' }, { branch: '戌', name: '华盖' },
    ])
  })

  it('sanhe12 @卯（亥卯未局，劫煞起申）', () => {
    expect(resolveLiurenRing(R('sanhe12'), '丁卯')).toEqual([
      { branch: '申', name: '劫煞' }, { branch: '酉', name: '灾煞' }, { branch: '戌', name: '岁煞' },
      { branch: '亥', name: '天煞' }, { branch: '子', name: '月煞' }, { branch: '丑', name: '地煞' },
      { branch: '寅', name: '亡神' }, { branch: '卯', name: '将星' }, { branch: '辰', name: '攀鞍' },
      { branch: '巳', name: '驿马' }, { branch: '午', name: '六厄' }, { branch: '未', name: '华盖' },
    ])
  })
})

// ════════ 三、三个锚的手推全盘 ════════

const line = (secs: LiurenSection[], id: string) =>
  secs.flatMap((s) => s.lines).find((l) => l.ruleIds.includes(id))!
const bar = (secs: LiurenSection[], id: string) =>
  secs.flatMap((s) => s.bars ?? []).find((b) => b.ruleId === id)!
const posOf = (secs: LiurenSection[], id: string) => sorted(line(secs, id).pos)

describe('liurenPanel(liunian, 乙巳)', () => {
  // 手推：流年支巳。岁前十二神＝太岁巳顺行（岁破亥、死符戌、白虎丑）；三合十二煞＝巳酉丑局劫煞起寅。
  // 大耗＝巳年亥（岁冲）、小耗＝巳年戌（岁前五）、黄幡＝巳酉丑年丑（三合墓）、豹尾＝黄幡冲未、
  // 病符＝岁后一辰、巳年辰、岁虎＝岁后四辰、巳年丑。
  const secs = liurenPanel('liunian', '乙巳')

  it('节标题与 bars 结构', () => {
    expect(secs.length).toBe(1)
    expect(secs[0].title).toBe('岁煞盘 · 以流年支巳起')
    expect(secs[0].bars?.length).toBe(2)
    expect(sorted((secs[0].bars ?? []).map((b) => b.prefix))).toEqual(sorted(['流年太岁', '流年三合']))
    expect(bar(secs, 'suiQian12').prefix).toBe('流年太岁')
    expect(bar(secs, 'sanhe12').prefix).toBe('流年三合')
  })

  it('suiQian12 bar：首槽＝巳太岁，槽序顺行', () => {
    const b = bar(secs, 'suiQian12')
    expect(b.slots.length).toBe(12)
    expect(b.slots[0]).toMatchObject({ branch: '巳', name: '太岁' })
    expect(b.slots[6]).toMatchObject({ branch: '亥', name: '岁破' })
  })

  it('sanhe12 bar：首槽＝寅劫煞（巳酉丑局绝位起）', () => {
    const b = bar(secs, 'sanhe12')
    expect(b.slots.length).toBe(12)
    expect(b.slots[0]).toMatchObject({ branch: '寅', name: '劫煞' })
    expect(b.slots[7]).toMatchObject({ branch: '酉', name: '将星' })
  })

  it('岁族关键行 pos（6 条非 ring 行全断）', () => {
    expect(posOf(secs, 'daHao'), 'daHao@巳').toEqual(['亥'])
    expect(posOf(secs, 'xiaoHao'), 'xiaoHao@巳').toEqual(['戌'])
    expect(posOf(secs, 'huangFan'), 'huangFan@巳').toEqual(['丑'])
    expect(posOf(secs, 'baoWei'), 'baoWei@巳').toEqual(['未'])
    expect(posOf(secs, 'bingFu'), 'bingFu@巳').toEqual(['辰'])
    expect(posOf(secs, 'suiHu'), 'suiHu@巳').toEqual(['丑'])
  })

  it('合并语义：大耗＝岁破同位、ring 槽徽标', () => {
    expect(line(secs, 'daHao').mergeNote, 'daHao mergeNote').toContain('岁破')
    const b = bar(secs, 'suiQian12')
    const slotByName = (n: string) => b.slots.find((s) => s.name === n)!
    expect(slotByName('岁破').coNames.join(''), '岁破槽').toContain('大耗')
    expect(slotByName('死符').coNames.join(''), '死符槽').toContain('小耗')
    expect(slotByName('白虎').coNames.join(''), '白虎槽').toContain('岁虎')
  })
})

describe('liurenPanel(liuyue, 丙戌)', () => {
  // 手推：流月支戌＝九月、秋季。
  // 月序类（正月寅…九月戌＝第 8 位，0 起）：月德＝巳寅亥申轮第 8→巳；生气正子顺行第 8→申；死气正午→寅；
  // 天诏正亥→未；墓门亥申巳寅轮→亥；成神巳申亥寅轮→巳；圣心 qifa 全表九卯；天马午申戌子寅辰轮九戌；
  // 天巫正辰顺行→子；血支正丑顺行→酉；血忌 qifa 九巳；月厌正戌逆行→寅；往亡 qifa 九辰；月破＝戌冲辰。
  // 季类（秋）：皇书申、天赦戊申、三丘戌、五墓辰；天目戌、天耳/天喜辰、戏神酉、四废/丧车卯、
  // 孤辰/喝散亥、寡宿/关神未、天转辛酉、地转癸酉。
  const secs = liurenPanel('liuyue', '丙戌')

  it('两节标题', () => {
    expect(secs.length).toBe(2)
    expect(secs[0].title).toBe('月煞盘 · 以流月支戌起')
    expect(secs[1].title).toBe('季煞 · 秋季通用（申酉戌三月同）')
  })

  it('月族关键行 pos（14 条）', () => {
    expect(posOf(secs, 'yueDeLr'), 'yueDeLr@戌').toEqual(['巳'])
    expect(posOf(secs, 'shengQi'), 'shengQi@戌').toEqual(['申'])
    expect(posOf(secs, 'siQi'), 'siQi@戌').toEqual(['寅'])
    expect(posOf(secs, 'tianZhao'), 'tianZhao@戌').toEqual(['未'])
    expect(posOf(secs, 'muMen'), 'muMen@戌').toEqual(['亥'])
    expect(posOf(secs, 'chengShen'), 'chengShen@戌').toEqual(['巳'])
    expect(posOf(secs, 'shengXin'), 'shengXin@戌').toEqual(['卯'])
    expect(posOf(secs, 'tianMaYue'), 'tianMaYue@戌').toEqual(['戌'])
    expect(posOf(secs, 'tianWu'), 'tianWu@戌').toEqual(['子'])
    expect(posOf(secs, 'huangShu'), 'huangShu@戌').toEqual(['申'])
    expect(posOf(secs, 'xueZhi'), 'xueZhi@戌').toEqual(['酉'])
    expect(posOf(secs, 'xueJi'), 'xueJi@戌').toEqual(['巳'])
    expect(posOf(secs, 'yueYan'), 'yueYan@戌').toEqual(['寅'])
    expect(posOf(secs, 'wangWang'), 'wangWang@戌').toEqual(['辰'])
  })

  it('月族：月破／三丘／五墓／天赦', () => {
    expect(posOf(secs, 'yuePo'), 'yuePo@戌').toEqual(['辰'])
    expect(posOf(secs, 'sanQiu'), 'sanQiu@戌').toEqual(['戌'])
    expect(posOf(secs, 'wuMu'), 'wuMu@戌').toEqual(['丑'])
    expect(posOf(secs, 'tianSheDyn'), 'tianSheDyn@戌').toEqual(['戊申'])
    expect(line(secs, 'tianSheDyn').judge, 'tianShe 判流日').toContain('流日')
  })

  it('季族关键行 pos', () => {
    expect(posOf(secs, 'tianMu'), 'tianMu@秋').toEqual(['戌'])
    expect(posOf(secs, 'tianEr'), 'tianEr@秋').toEqual(['辰'])
    expect(posOf(secs, 'xiShen'), 'xiShen@秋').toEqual(['酉'])
    expect(posOf(secs, 'siFeiZhi'), 'siFeiZhi@秋').toEqual(['卯'])
    expect(posOf(secs, 'jiGu'), 'jiGu@秋').toEqual(['亥'])
    expect(posOf(secs, 'jiGua'), 'jiGua@秋').toEqual(['未'])
    expect(posOf(secs, 'tianZhuan'), 'tianZhuan@秋').toEqual(['辛酉'])
    expect(posOf(secs, 'diZhuan'), 'diZhuan@秋').toEqual(['癸酉'])
  })

  it('合并语义：天喜(季)并入天耳行，无独立行', () => {
    const all = secs.flatMap((s) => s.lines)
    expect(all.every((l) => l.ruleIds[0] !== 'tianXiJi'), 'tianXiJi 不出独立行').toBe(true)
    const er = line(secs, 'tianEr')
    expect(er.ruleIds, '天耳行含 tianXiJi').toContain('tianXiJi')
    expect(er.label, '天耳行 label').toContain('天喜')
  })

  it('合并语义：喝散→孤辰、丧车→四废、关神→寡宿', () => {
    const all = secs.flatMap((s) => s.lines)
    for (const id of ['heSan', 'sangChe', 'guanShen']) {
      expect(all.every((l) => l.ruleIds[0] !== id), `${id} 不出独立行`).toBe(true)
    }
    expect(line(secs, 'jiGu').ruleIds, '孤辰行含喝散').toContain('heSan')
    expect(line(secs, 'siFeiZhi').ruleIds, '四废行含丧车').toContain('sangChe')
    expect(line(secs, 'jiGua').ruleIds, '寡宿行含关神').toContain('guanShen')
  })
})

describe('liurenPanel(liuri, 甲子)', () => {
  // 手推：流日干甲、支子、甲子∈甲子旬（甲子〜癸酉，空戌亥）。
  // 干族：日禄甲寅、日德甲己寅、羊刃甲卯、文昌甲巳、福星甲子、直符甲巳、干仪甲午。
  // 支族：支马申子辰日寅、支刑子刑卯、支冲子午、支破子酉、支害子未、破碎四仲见巳、支仪子日午。
  // 旬族：旬空戌亥、旬仪＝旬首支子、旬奇甲子旬丑、截路甲己申酉。
  const secs = liurenPanel('liuri', '甲子')

  it('三节标题', () => {
    expect(secs.length).toBe(3)
    expect(secs[0].title).toBe('日干煞盘 · 以流日干甲起')
    expect(secs[1].title).toBe('日支煞盘 · 以流日支子起')
    expect(secs[2].title).toBe('旬煞 · 甲子旬（甲子〜癸酉）')
  })

  it('日干族关键行 pos（7 条全断）', () => {
    expect(posOf(secs, 'riLu'), 'riLu@甲').toEqual(['寅'])
    expect(posOf(secs, 'riDeLr'), 'riDeLr@甲').toEqual(['寅'])
    expect(posOf(secs, 'yangRenLr'), 'yangRenLr@甲').toEqual(['卯'])
    expect(posOf(secs, 'wenChangLr'), 'wenChangLr@甲').toEqual(['巳'])
    expect(posOf(secs, 'fuXingLr'), 'fuXingLr@甲').toEqual(['子'])
    expect(posOf(secs, 'zhiFu'), 'zhiFu@甲').toEqual(['巳'])
    expect(posOf(secs, 'ganYi'), 'ganYi@甲').toEqual(['午'])
  })

  it('日支族关键行 pos（7 条全断）', () => {
    expect(posOf(secs, 'zhiMa'), 'zhiMa@子').toEqual(['寅'])
    expect(posOf(secs, 'zhiXing'), 'zhiXing@子').toEqual(['卯'])
    expect(posOf(secs, 'zhiChong'), 'zhiChong@子').toEqual(['午'])
    expect(posOf(secs, 'zhiPo'), 'zhiPo@子').toEqual(['酉'])
    expect(posOf(secs, 'zhiHai'), 'zhiHai@子').toEqual(['未'])
    expect(posOf(secs, 'poSui'), 'poSui@子').toEqual(['巳'])
    expect(posOf(secs, 'zhiYi'), 'zhiYi@子').toEqual(['午'])
  })

  it('旬族关键行 pos（4 条全断）', () => {
    expect(posOf(secs, 'xunKongDyn'), 'xunKongDyn@甲子').toEqual(['亥', '戌'].sort())
    expect(posOf(secs, 'xunYi'), 'xunYi@甲子').toEqual(['子'])
    expect(posOf(secs, 'xunQi'), 'xunQi@甲子').toEqual(['丑'])
    expect(posOf(secs, 'jieLu'), 'jieLu@甲').toEqual(['申', '酉'].sort())
  })
})
