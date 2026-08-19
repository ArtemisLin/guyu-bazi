// 由 scripts/gen-public-tests.mjs 生成于引擎 v0.1.0——期望值为引擎锁值（防回归），出处链见私仓黄金测试。
// 公开仓 overlay（sync-public.mjs 会用本文件覆盖 apps/plugin/tools/smoke.mjs）；全部生辰均为合成（虚构），不对应任何真实人物；请勿手改，改动会被下次生成覆盖。
// 插件冒烟：不启动 Obsidian，直接用 happy-dom + esbuild 打包纯渲染层，
// 验证「生辰 → 盘面 HTML」这条链在插件代码里跑得通（chartPane 与 note 两个模块）。
// 用法：node tools/smoke.mjs
import { build } from 'esbuild'
import { Window } from 'happy-dom'

const bundle = (await build({
  stdin: {
    contents: `
      import { buildChart, chartPaneHtml, locateNow, jieQiWarn } from './src/chartPane'
      import { noteTemplate, birthFromFrontmatter, noteFilePath, yamlStr } from './src/note'
      import { anchorText, currentAnchor, formatAnnotationLine, parseAnnotations, restoreDrill } from './src/anchor'
      import { sanitizeSettings, DEFAULT_SETTINGS } from './src/types'
      import { appendAnnotation, appendConsult } from './src/note'
      import { mkState } from './tools/state'   // ViewState 构造器在 .ts 里受 tsc 检查（类型漂移 typecheck 即红）
      import { JIAZI, lunarDaysOf, lunarMonthsOf, lunarToSolar, reverseDayOptions, reverseFourPillars, reverseHourOptions, reverseMonthOptions, solarToLunar } from '@bazi/core'
      globalThis.BZ = { buildChart, chartPaneHtml, locateNow, jieQiWarn, noteTemplate, birthFromFrontmatter, noteFilePath, yamlStr,
        anchorText, currentAnchor, formatAnnotationLine, parseAnnotations, restoreDrill, sanitizeSettings, DEFAULT_SETTINGS, mkState, appendAnnotation, appendConsult,
        JIAZI, lunarDaysOf, lunarMonthsOf, lunarToSolar, reverseDayOptions, reverseFourPillars, reverseHourOptions, reverseMonthOptions, solarToLunar }
    `,
    resolveDir: '.',
    loader: 'ts',
  },
  bundle: true,
  format: 'iife',
  target: 'es2020',
  platform: 'browser',
  write: false,
  // 冒烟不跑 Obsidian，给它一个最小桩（只有 note.ts 用到的 normalizePath）
  plugins: [{
    name: 'obsidian-stub',
    setup(b) {
      b.onResolve({ filter: /^obsidian$/ }, () => ({ path: 'obsidian', namespace: 'stub' }))
      b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
        contents: `export const normalizePath = (p) => p.replace(/\\\\/g, "/").replace(/\\/{2,}/g, "/").replace(/^\\/|\\/$/g, "")
export class TFolder {}`,
        loader: 'js',
      }))
    },
  }],
})).outputFiles[0].text

const window = new Window({ url: 'https://localhost/' })
window.eval(bundle)
const BZ = window.BZ

let failed = 0
const ok = (cond, name) => {
  console.log(`${cond ? '✓' : '✗ FAIL'} ${name}`)
  if (!cond) failed++
}

// 合成主样本（坤造 1986-09-12 09:30）——虚构生辰，不对应任何真实人物
const birth = { date: '1986-09-12', time: '09:30', gender: '坤', sect: 'wenzhen' }
const chart = BZ.buildChart(birth, true)
// 期望值＝scripts/gen-public-tests.mjs 用已验收引擎产出的锁值「丙寅 丁酉 己未 己巳」，插件必须与之逐字一致
{
  const p = [chart.pillars.year, chart.pillars.month, chart.pillars.day, chart.pillars.hour].join(' ')
  ok(p === '丙寅 丁酉 己未 己巳', `主样本四柱与引擎锁值一致（${p}）`)
}

const st = BZ.mkState(birth, chart)
BZ.locateNow(st, chart)
const r = BZ.chartPaneHtml(st)
const h = r.html

ok(h.includes('坤造') && h.includes('日主'), '头部信息条')
ok(h.includes('class="grid"') && h.includes('主星') && h.includes('神煞'), '明细表九行')
ok(h.includes('大运（20 步）') && h.includes('data-dy=') && h.includes('data-ln='), '大运/流年条可点')
ok(h.includes('动态神煞') && h.includes('岁煞盘 · 以流年支'), '动态神煞面板默认岁煞')
ok(!h.includes('六壬'), '全页无「六壬」字样')
ok(!h.includes('已验收') && !h.includes('验证模式'), '验证 UI 已撤（全量核验后不再显示徽标）')
ok(/lrp[^>]*><i>年<\/i>/.test(h) && h.includes('<i>月</i>') && h.includes('<i>日</i>'), '年/月/日三柱条')
ok(h.includes('神煞总览（原局起）'), '神煞总览（默认收起）')
ok(r.anchors !== null && r.anchors.nian.gz.length === 2, '返回三锚快照供图钉用')

// 空盘态
const empty = BZ.chartPaneHtml({ ...st, chart: undefined })
ok(empty.html.includes('还没有盘面') && empty.anchors === null, '无盘时给出引导文案')

// 切类别
for (const [cat, mark] of [['ji', '季煞 ·'], ['yue', '月煞盘 ·'], ['xun', '旬煞 ·'], ['rg', '日干煞盘 ·'], ['rz', '日支煞盘 ·']]) {
  const out = BZ.chartPaneHtml({ ...st, cat }).html
  ok(out.includes(mark), `切到 ${mark.replace(' ·', '')} 类别`)
}

// 交节警示：立春前后（1986 立春在 2/4；合成探针日期）
ok(BZ.jieQiWarn({ date: '1986-02-04', time: '12:00', gender: '坤', sect: 'wenzhen' }).includes('贴近交节'), '交节当日给出警示')
ok(BZ.jieQiWarn(birth) === '', '远离交节不误报')

// 笔记
const tpl = BZ.noteTemplate('样本A', birth, [chart.pillars.year, chart.pillars.month, chart.pillars.day, chart.pillars.hour], ['客户', '富人'])
ok(tpl.startsWith('---') && tpl.includes('bazi:') && tpl.includes('date: "1986-09-12"'), 'frontmatter 存生辰')
ok(/bazi:\n  v: 1\n  date:/.test(tpl), 'bazi 块带格式版本 v: 1（docs/13 契约）')
ok(BZ.birthFromFrontmatter({ bazi: { v: 1, date: '1986-09-12', time: '09:30', gender: '坤', sect: 'wenzhen' } })?.date === '1986-09-12' && BZ.birthFromFrontmatter({ bazi: { date: '1986-09-12', time: '09:30', gender: '坤' } })?.date === '1986-09-12', '有 v/无 v（旧笔记）都能还原')
ok(tpl.includes('四柱: "丙寅 丁酉 己未 己巳"'), '笔记记录四柱')
ok(tpl.includes('## 命主档案') && tpl.includes('## 人生节点') && tpl.includes('## 断语'), '笔记三段骨架')
ok(tpl.includes('```bazi'), '笔记模板带「打开盘面」按钮块')
ok(tpl.includes('标签:') && tpl.includes('- 客户') && tpl.includes('- 富人') && !tpl.includes('tags:'), '标签写入独立「标签」键（不混用 Obsidian 原生 tags）')
ok(BZ.noteTemplate('x', birth, ['a','b','c','d']).includes('标签: []'), '无标签时「标签」为空数组')
// YAML 转义（审查修复）：普通名裸写、危险名加引号；含冒号空格/井号/引号的案例名与标签不再写坏 frontmatter
ok(BZ.yamlStr('张三') === '张三' && BZ.yamlStr('富人·高格局') === '富人·高格局', '普通案例名/标签裸写')
ok(BZ.yamlStr('张三: 二婚 #问情') === '"张三: 二婚 #问情"' && BZ.yamlStr('-李四') === '"-李四"' && BZ.yamlStr('说"话"') === '"说\\"话\\""' && BZ.yamlStr('2024') === '"2024"' && BZ.yamlStr('yes') === '"yes"', '危险案例名（冒号空格/井号/首连字符/引号/纯数字/yes）加引号转义')
{
  const t2 = BZ.noteTemplate('张三: 二婚', birth, ['a','b','c','d'], ['富人', '已应验: 是'])
  ok(t2.includes('案例名: "张三: 二婚"') && t2.includes('  - 富人') && t2.includes('  - "已应验: 是"'), '危险案例名/标签写入 frontmatter 已转义')
}
const back = BZ.birthFromFrontmatter({ bazi: { date: '1986-09-12', time: '09:30', gender: '坤', sect: 'wenzhen' } })
ok(back && back.date === birth.date && back.gender === '坤', 'frontmatter 可还原生辰（重开笔记重现盘面）')
ok(BZ.birthFromFrontmatter({ bazi: { date: 'bad', time: 'x', gender: '坤' } }) === null, '坏 frontmatter 返回 null 不猜')
ok(BZ.noteFilePath('八字剧本集', '{案例名}', '张三') === '八字剧本集/张三.md', '笔记路径按模板生成')
ok(BZ.noteFilePath('八字剧本集', '{案例名}', 'a/b:c') === '八字剧本集/a_b_c.md', '文件名非法字符被替换')

// 批注/复诊写入的纯文本逻辑（Vault.process 原子回调）：用假 vault 桩验证三分支（有节节末/无节补节/复诊去重）
{
  const mkVault = (text) => ({ text, app: null })
  const fakeApp = (v) => ({ vault: { process: async (_f, fn) => { v.text = fn(v.text); return v.text } } })
  const v1 = mkVault('---\nx: 1\n---\n\n## 命主档案\n\n- 家庭：\n\n## 人生节点\n\n<!-- 说明 -->\n\n## 断语\n\n### 2026-08-01 首次\n\n')
  await BZ.appendAnnotation(fakeApp(v1), {}, '- ⏱ 2026丙午 —— 第一条')
  await BZ.appendAnnotation(fakeApp(v1), {}, '- ⏱ 2027丁未 —— 第二条')
  const seg = v1.text.slice(v1.text.indexOf('## 人生节点'), v1.text.indexOf('## 断语'))
  ok(seg.includes('<!-- 说明 -->\n- ⏱ 2026丙午 —— 第一条\n- ⏱ 2027丁未 —— 第二条') && v1.text.indexOf('第二条') < v1.text.indexOf('## 断语'), '批注依次追加到「人生节点」节末、不越界进「断语」')
  const v2 = mkVault('# 别的笔记\n\n正文')
  await BZ.appendAnnotation(fakeApp(v2), {}, '- ⏱ 2026丙午 —— x')
  ok(v2.text.endsWith('\n\n## 人生节点\n\n- ⏱ 2026丙午 —— x\n'), '无「人生节点」节时文末补节')
  const v3 = mkVault('## 断语\n\n### 2026-08-01 首次\n')
  await BZ.appendConsult(fakeApp(v3), {}, '2026-08-18 复诊')
  await BZ.appendConsult(fakeApp(v3), {}, '2026-08-18 复诊')
  ok((v3.text.match(/### 2026-08-18 复诊/g) || []).length === 1 && v3.text.endsWith('### 2026-08-18 复诊\n\n'), '复诊分节追加且同日不重复')
}

// 批注锚：盘⇄笔记双向往返（2026-08-05 用户核心需求）
{
  const a0 = BZ.currentAnchor(st, chart)
  ok(a0.y >= 1986 && a0.yGz.length === 2 && !a0.term, `未钻取时锚＝流年级（${a0.y}${a0.yGz}）`)
  // 笔记行 → 盘：还原到 2026 小暑月 8/2 流日（8/2 在小暑月 7/7~8/6 内）
  const st2 = { ...st }
  const msg = BZ.restoreDrill(st2, chart, { y: 2026, yGz: '丙午', term: '小暑', tGz: '乙未', m: 8, d: 2, dGz: '戊申' })
  ok(msg.includes('流日 8/2'), `批注锚还原到流日（${msg}）`)
  ok(st2.my !== null && st2.ri !== null && st2.si === null, '还原后钻取状态：月/日选中、时未选')
  // 盘 → 笔记行：还原后的盘提取的锚必须与批注一致（真往返）
  const a2 = BZ.currentAnchor(st2, chart)
  ok(a2.y === 2026 && a2.term === '小暑' && a2.m === 8 && a2.d === 2 && a2.dGz === '戊申', '还原后的盘提取锚与批注逐字一致')
  const line = BZ.formatAnnotationLine(a2, '这天有喜\n第二行')
  ok(line.startsWith('- ⏱ 2026丙午｜小暑乙未｜8/2戊申 —— '), `批注行格式（${line.slice(0, 30)}…）`)
  const parsed = BZ.parseAnnotations(`前面别的内容\n${line}\n- 普通列表项不受影响`)
  ok(parsed.length === 1 && parsed[0].anchor.term === '小暑' && parsed[0].text === '这天有喜；第二行', '批注行解析（多行批语压一行）')
  ok(BZ.parseAnnotations('- ⏱ 乱写的锚 —— x').length === 0, '坏锚行不解析不报错')
  ok(BZ.restoreDrill({ ...st }, chart, { y: 1200, yGz: '' }).includes('未找到'), '超大运范围年份明确告知')
  // 渲染层：还原后的盘面确实选中了对应格
  const h2 = BZ.chartPaneHtml(st2).html
  ok(h2.includes('流月 小暑') && h2.includes('流日 8/2'), '还原后明细表出现流月/流日列')
  // 锚描述：先公历后干支（2026-08-05 用户裁决）
  const at = BZ.anchorText(a2, 1986)
  ok(at.startsWith('2026年8月2日 · 丙午年 小暑乙未月 戊申日'), `锚描述先公历后干支（${at}）`)
  ok(at.includes('（41岁）'), '锚描述带虚岁')
  const atY = BZ.anchorText({ y: 2026, yGz: '丙午' }, 1986)
  ok(atY === '2026年 · 丙午年（41岁）', `年级锚描述（${atY}）`)
}

// 真太阳时按出生地经度校准：东经 116.407（公开地标值，不关联任何人）→ 主样本真太阳时 09:19（引擎锁值）
{
  const c = BZ.buildChart({ date: '1986-09-12', time: '09:30', gender: '坤', sect: 'wenzhen', place: '北京市·东城区', lon: 116.407 }, true)
  const ts = `${String(c.trueSolarClock.hh).padStart(2, '0')}:${String(c.trueSolarClock.mi).padStart(2, '0')}`
  ok(ts === '09:19', `出生地经度校准真太阳时（${ts}）`)
  const off = BZ.buildChart({ date: '1986-09-12', time: '09:30', gender: '坤', sect: 'wenzhen' }, true)
  ok(off.trueSolarClock.hh === 9 && off.trueSolarClock.mi === 30, '未选出生地不修正')
}

// 四柱反推录入的数据链（v0.1.9 弹窗逐柱下拉消费的正是这四个函数）：主样本 丙寅 丁酉 己未 己巳 → 1986-09-12 巳时
{
  ok(BZ.JIAZI.length === 60 && BZ.JIAZI[0] === '甲子' && BZ.JIAZI[59] === '癸亥', '年柱下拉＝60 甲子全表')
  const mo = BZ.reverseMonthOptions('丙寅')
  ok(mo.length === 12 && mo[0] === '庚寅' && mo[7] === '丁酉', `丙寅年月柱五虎遁（${mo[0]}起，第8位${mo[7]}）`)
  ok(BZ.reverseDayOptions('丙寅', '丁酉').includes('己未'), '丙寅年丁酉月日柱扫描含己未')
  const ho = BZ.reverseHourOptions('己未')
  ok(ho.includes('己巳') && ho[12] === '丙子（晚）', '己未日时柱五鼠遁（含己巳，晚子＝丙子）')
  ok(BZ.reverseHourOptions('己未', { ziShiSect: 'huanri' }).length === 12, '换日派时柱无晚子死选项')
  const hit = BZ.reverseFourPillars('丙寅', '丁酉', '己未', '己巳', { ziShiSect: 'wenzhen' })
    .find((c) => c.solar.startsWith('1986-09-12'))
  ok(hit && hit.hh >= 9 && hit.hh < 11, `四柱反推候选含主样本生辰（${hit ? hit.solar : '未命中'}）`)
}

// 十二长生总表（v0.1.13）：默认折叠，展开＝8 行火土同宫合并表（与引擎星运同源）
{
  ok(!BZ.chartPaneHtml(st).html.includes('csgrid'), '十二长生总表默认折叠')
  const h3 = BZ.chartPaneHtml({ ...st, csFold: false }).html
  ok(h3.includes('csgrid') && h3.includes('id="f-cs"'), '展开后渲染总表与收起按钮')
  ok(h3.includes('长生') && h3.split('csg lab').length - 1 === 8, '总表 8 行（丙戊/丁己合并）')
}

// 农历录入链（v0.1.10 弹窗）：切 tab 预填＝solarToLunar，排盘换算＝lunarToSolar（合成闰月样本 2001 闰四月）
{
  const ld = BZ.solarToLunar(2001, 6, 1)
  ok(ld.y === 2001 && ld.m === -4 && ld.d === 10, `solarToLunar＝闰四月初十（${ld.y}/${ld.m}/${ld.d}）`)
  const sv = BZ.lunarToSolar(2001, -4, 10, 10, 0)
  ok(sv.y === 2001 && sv.m === 6 && sv.d === 1, '闰四月初十 → 2001-06-01（往返一致）')
  ok(BZ.lunarMonthsOf(2001).length === 13 && BZ.lunarDaysOf(2001, -4).length === 29, '闰年 13 月、闰四月 29 日')
}

// 设置加载校验（docs/13 §5，v0.1.16）：坏 data.json 回默认、合法值原样、未知键丢弃、settingsVersion 恒 1
{
  const S = BZ.sanitizeSettings
  ok(JSON.stringify(S({})) === JSON.stringify(BZ.DEFAULT_SETTINGS), '空 data.json → 全默认')
  const bad = S({ folder: 42, panes: { noteW: 'abc', aiW: null, chartFold: 'yes' }, sect: 'weird', trueSolar: 'true', verified: {} })
  ok(bad.folder === '八字剧本集' && bad.panes.noteW === 380 && bad.panes.aiW === 260 && bad.panes.chartFold === false && bad.sect === 'wenzhen' && bad.trueSolar === true && !('verified' in bad), '坏类型/未知键 → 回默认/丢弃，布局不会拿到 NaN')
  const good = S({ folder: '客户', sect: 'huanri', panes: { noteW: 500, aiW: 5000, noteFold: true } })
  ok(good.folder === '客户' && good.sect === 'huanri' && good.panes.noteW === 500 && good.panes.aiW === 900 && good.panes.noteFold === true && good.settingsVersion === 1, '合法值保留、越界宽度夹到 170–900、版本恒 1')
}
// yamlStr 补漏：0x/0o/.inf/.nan 在 YAML core schema 下会变数字，须加引号
ok(BZ.yamlStr('0x1f') === '"0x1f"' && BZ.yamlStr('.inf') === '".inf"' && BZ.yamlStr('-.NaN') === '"-.NaN"' && BZ.yamlStr('0o17') === '"0o17"', 'yamlStr：0x/0o/.inf/.nan 加引号')

// —— 审查修复回归（2026-08-11，v0.1.15）——

// 高3：frontmatter 外来字符串（place）拼 innerHTML 前必须转义
{
  const evil = { ...birth, place: '<img src=x onerror=alert(1)>' }
  const eh = BZ.chartPaneHtml({ ...st, birth: evil }).html
  ok(!eh.includes('<img src=x') && eh.includes('&lt;img'), '恶意 place 被 HTML 转义，不进 DOM')
}

// 高4：夏令时排盘＝钟表减 1 小时（1988-07-15 在 4/10–9/11 窗内）；frontmatter dst 往返
{
  const a = BZ.buildChart({ date: '1988-07-15', time: '11:30', gender: '坤', sect: 'wenzhen', dst: true }, true)
  const b = BZ.buildChart({ date: '1988-07-15', time: '10:30', gender: '坤', sect: 'wenzhen' }, true)
  ok(JSON.stringify(a.pillars) === JSON.stringify(b.pillars), 'dst 排盘四柱＝减 1 小时钟表盘')
  ok(BZ.chartPaneHtml({ ...st, birth: { ...birth, date: '1988-07-15', time: '11:30', dst: true }, chart: a }).html.includes('夏令时'), '盘头显示夏令时徽标')
  const tplDst = BZ.noteTemplate('夏令时案', { ...birth, dst: true }, ['a', 'b', 'c', 'd'])
  ok(tplDst.includes('dst: true'), 'frontmatter 写入 dst 标志')
  const backDst = BZ.birthFromFrontmatter({ bazi: { date: '1988-07-15', time: '11:30', gender: '坤', sect: 'wenzhen', dst: true } })
  ok(backDst && backDst.dst === true, 'frontmatter 还原 dst（重开笔记同盘）')
}

// 高1：跨年真太阳时盘的虚岁/大运基准＝引擎 birthYear（真太阳时年）
{
  const c = BZ.buildChart({ date: '1990-01-01', time: '00:05', gender: '乾', sect: 'wenzhen', lon: 104.07 }, true)
  ok(c.birthYear === 1989 && c.daYun[0].startYear === Number(c.qiYunDate.slice(0, 4)), `跨年盘 birthYear=1989、首运年与交运日期同基准（${c.qiYunDate} vs ${c.daYun[0].startYear}）`)
}

// 中3：wenzhen 派晚子四柱反推补偿（上游反查月末回拨丢晚子解的兜底）——合成晚子样本
{
  const r = BZ.reverseFourPillars('癸酉', '乙卯', '乙卯', '戊子', { ziShiSect: 'wenzhen' })
  ok(r.some((c) => c.solar.startsWith('1993-04-04 23:')), '晚子生辰 1993-04-04 23:00 可反推回本人')
}

console.log(failed ? `\n${failed} 项失败` : '\n插件冒烟全部通过')
process.exit(failed ? 1 : 0)
