/** 新盘/改生辰录入弹窗（从 main.ts 拆出，2026-08-18；只依赖 plugin.settings 与 onSubmit 回调） */
import { Modal, Notice, Setting, type App, type ButtonComponent } from 'obsidian'
import { JIAZI, formatClock, inChinaDst, lunarDaysOf, lunarMonthsOf, lunarToSolar, reverseDayOptions, reverseFourPillars, reverseHourOptions, reverseMonthOptions, shiftClockMinutes, solarToLunar, toTrueSolar, type ClockTime, type ReverseCandidate } from '@bazi/core'
import { REGIONS, regionCoord, wxName } from '@bazi/view'
import { collectTags, listSubfolders } from './note'
import type { Birth } from './types'
import type BaziPlugin from './main'

/**
 * 新盘/改生辰录入：对齐验证台的形态（用户 2026-08-05 明确要求）——
 * 年/月/日/时/分全下拉、出生地省/市/区县三级联动（用于真太阳时校准，不是仅作记录）、
 * 真太阳时实时预览；不提供手填经度（用户不懂经纬度，docs/00 #16）。
 */
export class NewChartModal extends Modal {
  private name = ''
  // 构造器里 prefill/当前时刻两支都会赋值（Object.assign 一支 TS 推不出，用 ! 声明）
  private y!: number
  private m!: number
  private d!: number
  private hh = 12
  private mi = 0
  private gender: '乾' | '坤' = '坤'
  private pi = 0
  private ci = 0
  private ai = 0
  private sect: 'wenzhen' | 'huanri'
  /** 钟表时为夏令时读数（1986–1991 窗口内才显示确认项；出窗自动清零） */
  private dst = false
  private dstRow?: HTMLDivElement
  /** 改生辰：原 place 无法在地名库三级匹配（行政区划变动等）——弹窗警示；用户不改选则保留原 place/lon 写回 */
  private placeLost = false
  private placeTouched = false
  private preview!: HTMLElement
  private daySel!: HTMLSelectElement

  // 录入方式（对齐验证台）：农历直接转公历排盘；四柱反推逐柱渐进选择，点中候选自动填回公历模式
  private entryMode: '公历' | '农历' | '四柱' = '公历'
  private lun = { y: 1990, m: 1, d: 1 }
  private sz = { y: '', m: '', d: '', h: '' }
  private cands: ReverseCandidate[] | null = null
  private dayMemo: { key: string; opts: string[] } | null = null
  private dateSection!: HTMLDivElement
  private submitBtn?: ButtonComponent
  /** 年份网格弹层开合（1801–2099 长列表的替代，docs/00 #62） */
  private yearPop = false
  /** 四柱干支网格弹层：当前打开的是哪一柱（''＝都关） */
  private gzPop: '' | 'y' | 'm' | 'd' | 'h' = ''

  private subFolder = ''
  private newFolder = ''
  private tagSel = new Set<string>()
  private tagInput = ''

  constructor(
    app: App,
    private plugin: BaziPlugin,
    private onSubmit: (name: string, b: Birth, extra?: { subFolder?: string; tags?: string[] }) => void,
    private prefill?: { name: string; birth: Birth },
  ) {
    super(app)
    this.sect = prefill?.birth.sect ?? plugin.settings.sect
    const now = new Date()
    if (prefill) {
      this.name = prefill.name
      const [y, m, d] = prefill.birth.date.split('-').map(Number)
      const [hh, mi] = prefill.birth.time.split(':').map(Number)
      Object.assign(this, { y, m, d, hh, mi })
      this.gender = prefill.birth.gender
      this.dst = prefill.birth.dst ?? false
      // 出生地按名称回填三级索引：三级全中才算命中——部分命中会静默落到错误区县（错经度比不修正更糟）
      const segs = (prefill.birth.place ?? '').split('·')
      let matched = false
      if (segs.length === 3) {
        const pi = REGIONS.findIndex((p) => p.n === segs[0])
        const ci = pi >= 0 ? REGIONS[pi].c.findIndex((c) => c.n === segs[1]) : -1
        const ai = ci >= 0 ? REGIONS[pi].c[ci].a.findIndex((a) => a.n === segs[2]) : -1
        if (ai >= 0) {
          this.pi = pi + 1
          this.ci = ci
          this.ai = ai
          matched = true
        }
      }
      this.placeLost = !!prefill.birth.place && !matched
    } else {
      this.y = now.getFullYear()
      this.m = now.getMonth() + 1
      this.d = now.getDate()
      this.hh = now.getHours()
      this.mi = now.getMinutes()
    }
  }

  private sel(parent: HTMLElement, opts: Array<[number, string]>, cur: number, onChange: (v: number) => void): HTMLSelectElement {
    const s = parent.createEl('select', { cls: 'bz-msel' })
    for (const [v, label] of opts) {
      const o = s.createEl('option', { text: label })
      o.value = String(v)
      if (v === cur) o.selected = true
    }
    s.onchange = () => onChange(Number(s.value))
    return s
  }

  /** 干支逐字按五行着色（晚子项「（晚）」后缀灰显小字） */
  private gzText(el: HTMLElement, gz: string) {
    for (const ch of gz.slice(0, 2)) el.createSpan({ cls: `wx-${wxName(ch)}`, text: ch })
    if (gz.length > 2) el.createSpan({ cls: 'bz-gz-suffix', text: gz.slice(2) })
  }

  /**
   * 四柱干支选择器：按钮＋网格弹层（60 甲子 10 个/行共 6 行，逐字五行着色），
   * 替代原生 60 项竖排长下拉（看花眼且 option 无法着色，2026-08-20 用户截图反馈）。
   * 弹层挂 .bz-mrow（position:relative）「右」缘向左展开——Obsidian .setting-item-control 是
   * justify-content:flex-end，四柱行收缩贴右，锚左缘会右溢弹窗 ~276px（审查实测）。
   * 重选当前值只收弹层不触发 onChange（原生 select 同值不发 change；无条件触发会级联清空后柱与候选）。
   */
  private gzPicker(parent: HTMLElement, key: 'y' | 'm' | 'd' | 'h', placeholder: string, opts: string[], cur: string, onChange: (v: string) => void, disabled = false) {
    const wrap = parent.createSpan({ cls: `bz-gzpick${disabled ? ' disabled' : ''}` })
    const btn = wrap.createEl('button', { cls: `bz-gzbtn${cur ? '' : ' empty'}` })
    if (cur) this.gzText(btn, cur)
    else btn.setText(placeholder)
    btn.disabled = disabled
    btn.onclick = () => { this.gzPop = this.gzPop === key ? '' : key; this.renderDateSection() }
    if (this.gzPop !== key || disabled) return
    const pop = wrap.createDiv({ cls: 'bz-gzpop' })
    const perRow = opts.length > 20 ? 10 : 6
    for (let i = 0; i < opts.length; i += perRow) {
      const rowEl = pop.createDiv({ cls: 'bz-gzrow' })
      for (const o of opts.slice(i, i + perRow)) {
        const c = rowEl.createEl('button', { cls: `bz-gzcell${o === cur ? ' on' : ''}` })
        this.gzText(c, o)
        c.onclick = () => { this.gzPop = ''; o === cur ? this.renderDateSection() : onChange(o) }
      }
    }
  }

  /** 日柱可选集缓存（年柱+月柱+流派 → 扫描一次，同验证台） */
  private dayOptions(): string[] {
    const key = `${this.sz.y}|${this.sz.m}|${this.sect}`
    if (this.dayMemo?.key !== key) this.dayMemo = { key, opts: reverseDayOptions(this.sz.y, this.sz.m, { ziShiSect: this.sect }) }
    return this.dayMemo.opts
  }

  private daysInMonth(): number {
    return new Date(this.y, this.m, 0).getDate()
  }

  private refreshDays() {
    const n = this.daysInMonth()
    if (this.d > n) this.d = n
    this.daySel.empty()
    for (let d = 1; d <= n; d++) {
      const o = this.daySel.createEl('option', { text: `${d}日` })
      o.value = String(d)
      if (d === this.d) o.selected = true
    }
  }

  private coord(): { lng: number; lat: number } | null {
    return regionCoord(this.pi, this.ci, this.ai)
  }

  /** 原 place 匹配失败且用户未改选出生地：写回与预览都保留原 place/lon（宁可留原值，不静默失校准） */
  private keepOrigPlace(): boolean {
    return !!this.prefill && this.placeLost && !this.placeTouched
  }

  /** 当前录入方式的有效公历钟表时（四柱模式无；农历越界返回 null） */
  private effectiveClock(): ClockTime | null {
    if (this.entryMode === '公历') return { y: this.y, m: this.m, d: this.d, hh: this.hh, mi: this.mi }
    if (this.entryMode === '农历') return this.lunarSolar()
    return null
  }

  /** 真太阳时预览文案（含夏令时减 1 小时与「原出生地经度」兜底） */
  private trueSolarText(clock0: ClockTime): string {
    const clock = this.dst && inChinaDst(clock0) ? shiftClockMinutes(clock0, -60) : clock0
    const pl = this.coord()
    if (pl) return `真太阳时：${formatClock(toTrueSolar(clock, pl.lng))} ｜ 北纬${pl.lat.toFixed(3)} 东经${pl.lng.toFixed(3)}`
    const origLon = this.prefill?.birth.lon
    if (this.keepOrigPlace() && origLon !== undefined)
      return `真太阳时：${formatClock(toTrueSolar(clock, origLon))}（按原出生地经度）`
    return '真太阳时：（出生地不详）'
  }

  /** 夏令时确认项：仅当有效日期落在 1986–1991 中国夏令时区间时出现；出窗自动清零防陈旧标志 */
  private renderDstRow() {
    if (!this.dstRow) return
    this.dstRow.empty()
    const clock = this.effectiveClock()
    if (!clock || !inChinaDst(clock)) {
      this.dst = false
      return
    }
    const lab = this.dstRow.createDiv({ cls: 'bz-dstrow' }).createEl('label')
    const cb = lab.createEl('input', { type: 'checkbox' })
    cb.checked = this.dst
    cb.onchange = () => {
      this.dst = cb.checked
      this.refreshPreview()
    }
    lab.appendText(' 该日期在 1986–1991 年中国夏令时区间：出生记录若是夏令时钟表（拨快 1 小时），勾选后按标准时排盘（自动减 1 小时）')
  }

  /** 农历 → 公历换算（录入区与提交共用；越界返回 null，1801–2099 全站承诺） */
  private lunarSolar(): { y: number; m: number; d: number; hh: number; mi: number } | null {
    const sv = lunarToSolar(this.lun.y, this.lun.m, this.lun.d, this.hh, this.mi)
    return sv.y < 1801 || sv.y > 2099 ? null : sv
  }

  /** 排盘按钮：四柱模式禁用（须先选候选）；农历越界禁用（同验证台） */
  private updateSubmitState() {
    this.submitBtn?.setDisabled(this.entryMode === '四柱' || (this.entryMode === '农历' && !this.lunarSolar()))
  }

  private refreshPreview() {
    this.renderDstRow()
    if (!this.preview) return
    if (this.entryMode === '四柱') {
      this.preview.setText('真太阳时：点中候选生辰、填回公历模式后计算')
      return
    }
    if (this.entryMode === '农历') {
      const sv = lunarToSolar(this.lun.y, this.lun.m, this.lun.d, this.hh, this.mi)
      const p2 = (n: number) => String(n).padStart(2, '0')
      const solar = `对应公历 ${sv.y}-${p2(sv.m)}-${p2(sv.d)} ${p2(sv.hh)}:${p2(sv.mi)}`
      if (sv.y < 1801 || sv.y > 2099) {
        this.preview.setText(`${solar} ——超出 1801–2099，无法排盘`)
      } else {
        this.preview.setText(`${solar} ｜ ${this.trueSolarText(sv)}`)
      }
      this.updateSubmitState()
      return
    }
    this.preview.setText(this.trueSolarText({ y: this.y, m: this.m, d: this.d, hh: this.hh, mi: this.mi }))
  }

  /** 年份选择：按钮＋网格弹层（10 年/行、整十加粗、打开定位当前年），替代 299 项长下拉 */
  private yearPicker(parent: HTMLElement, cur: number, onChange: (v: number) => void) {
    const wrap = parent.createSpan({ cls: 'bz-yearpick' })
    const btn = wrap.createEl('button', { cls: 'bz-yearbtn', text: `${cur}年` })
    btn.onclick = () => { this.yearPop = !this.yearPop; this.renderDateSection() }
    if (!this.yearPop) return
    const pop = wrap.createDiv({ cls: 'bz-yearpop' })
    for (let dec = 1800; dec < 2100; dec += 10) {
      const row = pop.createDiv({ cls: 'bz-yearrow' })
      for (let y = dec; y < dec + 10; y++) {
        if (y < 1801 || y > 2099) { row.createSpan({ cls: 'bz-yearcell' }); continue }
        const c = row.createEl('button', { cls: `bz-yearcell${y % 10 === 0 ? ' dec' : ''}${y === cur ? ' on' : ''}`, text: String(y) })
        c.onclick = () => { this.yearPop = false; onChange(y) }
      }
    }
    const onCell = pop.querySelector('.bz-yearcell.on') as HTMLElement | null
    if (onCell) pop.scrollTop = Math.max(0, onCell.offsetTop - pop.clientHeight / 2)
  }

  private setMode(mode: '公历' | '农历' | '四柱') {
    if (mode === this.entryMode) return
    const prev = this.entryMode
    this.yearPop = false
    this.gzPop = ''
    // 「两 tab 同一生辰」双向成立：切出农历先把换算结果回写公历（否则往返会静默重置所选农历日期），
    // 切入农历再从公历派生预填；1801 年下界钳到正月初一
    if (prev === '农历') {
      const sv = this.lunarSolar()
      if (sv) Object.assign(this, { y: sv.y, m: sv.m, d: sv.d, hh: sv.hh, mi: sv.mi })
    }
    this.entryMode = mode
    if (mode === '农历') {
      const ld = solarToLunar(this.y, this.m, this.d)
      this.lun = ld.y < 1801 ? { y: 1801, m: 1, d: 1 } : ld
    }
    this.renderDateSection()
    this.refreshPreview()
  }

  /** 生辰录入区（公历下拉／农历转换／四柱反推逐柱选择）；切换录入方式、逐柱联动、候选变化都整段重绘 */
  private renderDateSection() {
    const el = this.dateSection
    el.empty()
    const ms = new Setting(el).setName('录入方式')
    const seg = ms.controlEl.createDiv({ cls: 'bz-seg' })
    for (const [key, label] of [['公历', '公历'], ['农历', '农历'], ['四柱', '四柱反推']] as Array<['公历' | '农历' | '四柱', string]>) {
      const b = seg.createEl('button', { text: label, cls: key === this.entryMode ? 'on' : '' })
      b.onclick = () => this.setMode(key)
    }
    const hours = Array.from({ length: 24 }, (_, i) => [i, `${i}时`] as [number, string])
    const minutes = Array.from({ length: 60 }, (_, i) => [i, `${i}分`] as [number, string])
    if (this.entryMode === '公历') {
      const dt = new Setting(el).setClass('bz-row-wide').setName('公历生辰').setDesc('钟表时（北京时间）')
      const row = dt.controlEl.createDiv({ cls: 'bz-mrow' })
      this.yearPicker(row, this.y, (v) => { this.y = v; this.renderDateSection(); this.refreshPreview() })
      this.sel(row, Array.from({ length: 12 }, (_, i) => [i + 1, `${i + 1}月`] as [number, string]), this.m, (v) => { this.m = v; this.refreshDays(); this.refreshPreview() })
      this.daySel = this.sel(row, [], this.d, (v) => { this.d = v; this.refreshPreview() })
      this.refreshDays()
      this.sel(row, hours, this.hh, (v) => { this.hh = v; this.refreshPreview() })
      this.sel(row, minutes, this.mi, (v) => { this.mi = v; this.refreshPreview() })
    } else if (this.entryMode === '农历') {
      const months = lunarMonthsOf(this.lun.y)
      if (!months.some((mo) => mo.month === this.lun.m)) this.lun.m = Math.abs(this.lun.m)
      const dayNames = lunarDaysOf(this.lun.y, this.lun.m)
      if (this.lun.d > dayNames.length) this.lun.d = dayNames.length
      const dt = new Setting(el).setClass('bz-row-wide').setName('农历生辰').setDesc('钟表时（北京时间）；晚子 23 时按当天日期填')
      const row = dt.controlEl.createDiv({ cls: 'bz-mrow' })
      this.yearPicker(row, this.lun.y, (v) => { this.lun.y = v; this.renderDateSection(); this.refreshPreview() })
      this.sel(row, months.map((mo) => [mo.month, mo.name] as [number, string]), this.lun.m, (v) => { this.lun.m = v; this.renderDateSection(); this.refreshPreview() })
      this.sel(row, dayNames.map((n, i) => [i + 1, n] as [number, string]), this.lun.d, (v) => { this.lun.d = v; this.refreshPreview() })
      this.sel(row, hours, this.hh, (v) => { this.hh = v; this.refreshPreview() })
      this.sel(row, minutes, this.mi, (v) => { this.mi = v; this.refreshPreview() })
    } else {
      const dt = new Setting(el).setClass('bz-row-wide').setName('四柱').setDesc('从年柱依次选到时柱')
      const row = dt.controlEl.createDiv({ cls: 'bz-mrow' })
      const upd = (patch: Partial<{ y: string; m: string; d: string; h: string }>) => {
        Object.assign(this.sz, patch)
        this.cands = null
        this.renderDateSection()
      }
      this.gzPicker(row, 'y', '年柱', JIAZI, this.sz.y, (v) => upd({ y: v, m: '', d: '', h: '' }))
      this.gzPicker(row, 'm', '月柱', this.sz.y ? reverseMonthOptions(this.sz.y) : [], this.sz.m, (v) => upd({ m: v, d: '', h: '' }), !this.sz.y)
      this.gzPicker(row, 'd', '日柱', this.sz.m ? this.dayOptions() : [], this.sz.d, (v) => upd({ d: v, h: '' }), !this.sz.m)
      this.gzPicker(row, 'h', '时柱', this.sz.d ? reverseHourOptions(this.sz.d, { ziShiSect: this.sect }) : [], this.sz.h, (v) => upd({ h: v }), !this.sz.d)
      // 四柱选齐即自动反推（1801–2099 全范围扫描毫秒级，无须手动触发）。原「查找生辰」按钮已删：
      // 其 --bz-accent 变量只在 .bz-root 下有定义，弹窗里背景失效＋白字近乎隐形，用户不知道要点它（2026-08-20 用户截图）
      if (this.sz.y && this.sz.m && this.sz.d && this.sz.h && this.cands === null)
        this.cands = reverseFourPillars(this.sz.y, this.sz.m, this.sz.d, this.sz.h.replace('（晚）', ''), { ziShiSect: this.sect })
      el.createDiv({ cls: 'bz-szhint', text: `查找范围 1801–2099，四柱选齐自动列出候选生辰；点中候选自动填回公历。${
        this.sect === 'huanri' ? '换日派晚子＝次日日柱＋子时（候选列次日 0 点）。' : ''}` })
      if (this.cands) {
        const box = el.createDiv({ cls: 'bz-cands' })
        if (!this.cands.length) box.createDiv({ cls: 'bz-cand bz-cand-none', text: '此四柱组合在 1801–2099 年间无对应生辰——检查干支搭配，或换晚子时流派试试' })
        for (const c of this.cands) {
          const item = box.createDiv({ cls: 'bz-cand' })
          item.createSpan({ text: `阳历 ${c.solar}` })
          item.createSpan({ cls: 'bz-cand-lunar', text: `农历 ${c.lunar}` })
          item.createSpan({ cls: 'bz-cand-use', text: '用此生辰 →' })
          item.onclick = () => {
            Object.assign(this, { y: c.y, m: c.m, d: c.d, hh: c.hh, mi: c.mi })
            // 反推候选是标准时刻：清掉可能残留的夏令时勾选，防再减一小时
            this.dst = false
            this.entryMode = '公历'
            this.renderDateSection()
            this.refreshPreview()
          }
        }
      }
    }
    // 夏令时确认项挂在录入区末尾：公历/农历日期落在 1986–1991 夏令时区间才出现
    this.dstRow = el.createDiv()
    this.renderDstRow()
    this.updateSubmitState()
  }

  onOpen() {
    this.modalEl.addClass('bz-modal')
    const { contentEl } = this
    // 年份网格弹层：点弹层外任意处关闭。只摘弹层节点、不整段重绘——
    // 重绘会把正被点击的控件换掉，导致这一下点击被吞（tab/下拉要点两次）
    contentEl.addEventListener('pointerdown', (e) => {
      if (this.yearPop && !(e.target as HTMLElement).closest('.bz-yearpick')) {
        this.yearPop = false
        this.dateSection.querySelector('.bz-yearpop')?.remove()
      }
      if (this.gzPop && !(e.target as HTMLElement).closest('.bz-gzpick:not(.disabled)')) {
        this.gzPop = ''
        this.dateSection.querySelector('.bz-gzpop')?.remove()
      }
    }, { capture: true })
    contentEl.createEl('h3', { text: this.prefill ? '修改生辰' : '新盘' })
    if (this.prefill) {
      new Setting(contentEl).setName('案例名').setDesc('改生辰不改案例名与笔记文件').addText((t) => t.setValue(this.name).setDisabled(true))
    } else {
      new Setting(contentEl).setName('案例名').addText((t) => t.setPlaceholder('如：张三').onChange((v) => (this.name = v.trim())))
    }

    this.dateSection = contentEl.createDiv()
    this.renderDateSection()

    new Setting(contentEl).setName('性别').addDropdown((d) => d.addOption('坤', '坤造（女）').addOption('乾', '乾造（男）').setValue(this.gender).onChange((v) => (this.gender = v as '乾' | '坤')))

    // 出生地三级联动：用于真太阳时校准
    const pl = new Setting(contentEl).setName('出生地').setDesc('用于真太阳时校准')
    if (this.placeLost)
      pl.setDesc(`⚠ 原出生地「${this.prefill?.birth.place ?? ''}」无法在地名库匹配（可能行政区划变动）——请重新选择；不改选则保留原出生地与经度继续用于真太阳时`)
    const prow = pl.controlEl.createDiv({ cls: 'bz-mrow' })
    let citySel!: HTMLSelectElement
    let areaSel!: HTMLSelectElement
    const fillCities = () => {
      citySel.empty()
      areaSel.empty()
      if (this.pi === 0) return
      const p = REGIONS[this.pi - 1]
      p.c.forEach((c, i) => {
        const o = citySel.createEl('option', { text: c.n })
        o.value = String(i)
        if (i === this.ci) o.selected = true
      })
      fillAreas()
    }
    const fillAreas = () => {
      areaSel.empty()
      if (this.pi === 0) return
      const c = REGIONS[this.pi - 1].c[this.ci]
      c.a.forEach((a, i) => {
        const o = areaSel.createEl('option', { text: a.n })
        o.value = String(i)
        if (i === this.ai) o.selected = true
      })
    }
    const provs: Array<[number, string]> = [[0, '未知地（默认：北京时间）']]
    REGIONS.forEach((p, i) => provs.push([i + 1, p.n]))
    this.sel(prow, provs, this.pi, (v) => { this.placeTouched = true; this.pi = v; this.ci = 0; this.ai = 0; fillCities(); this.refreshPreview() })
    citySel = prow.createEl('select', { cls: 'bz-msel' })
    citySel.onchange = () => { this.placeTouched = true; this.ci = Number(citySel.value); this.ai = 0; fillAreas(); this.refreshPreview() }
    areaSel = prow.createEl('select', { cls: 'bz-msel' })
    areaSel.onchange = () => { this.placeTouched = true; this.ai = Number(areaSel.value); this.refreshPreview() }
    fillCities()

    new Setting(contentEl).setName('晚子时').addDropdown((d) => d
      .addOption('wenzhen', '不换日（日柱当天＋时柱次日子干，默认）')
      .addOption('huanri', '换日（日柱算次日）')
      .setValue(this.sect).onChange((v) => {
        this.sect = v as 'wenzhen' | 'huanri'
        // 换流派改变日柱扫描窗口与反推结果：无论当前哪种录入方式都清候选、复核已选柱
        // （公历模式下改完再切回四柱，陈旧候选/失效日柱会静默排出与所录四柱矛盾的盘）
        this.cands = null
        if (this.sz.d && !this.dayOptions().includes(this.sz.d)) { this.sz.d = ''; this.sz.h = '' }
        if (this.sect === 'huanri' && this.sz.h.includes('（晚）')) this.sz.h = ''
        if (this.entryMode === '四柱') this.renderDateSection()
      }))

    // 存入文件夹＋标签（仅新盘；分工原则：文件夹管归属、标签管特征）
    if (!this.prefill) {
      const root = this.plugin.settings.folder
      const fs = new Setting(contentEl).setName('存入').setDesc(`${root}/ 下，子文件夹自建`)
      let newInput: HTMLInputElement
      fs.addDropdown((d) => {
        d.addOption('', '（根目录）')
        for (const sub of listSubfolders(this.app, root)) d.addOption(sub, sub + '/')
        d.addOption('__new__', '＋ 新建子文件夹…')
        d.setValue('').onChange((v) => {
          this.subFolder = v
          newInput.toggleClass('bz-hidden', v !== '__new__')
          if (v === '__new__') newInput.focus()
        })
      })
      newInput = fs.controlEl.createEl('input', { cls: 'bz-newfolder bz-hidden', attr: { placeholder: '子文件夹名，如 客户' } })
      newInput.oninput = () => (this.newFolder = newInput.value.trim())

      const ts = new Setting(contentEl).setName('标签').setDesc('特征可叠加，归属用文件夹')
      const known = collectTags(this.app, root)
      if (known.length) {
        const chips = ts.controlEl.createDiv({ cls: 'bz-tagchips' })
        for (const t of known) {
          const c = chips.createSpan({ cls: 'bz-tagchip', text: t })
          c.onclick = () => {
            if (this.tagSel.has(t)) this.tagSel.delete(t)
            else this.tagSel.add(t)
            c.toggleClass('on', this.tagSel.has(t))
          }
        }
      }
      const ti = ts.controlEl.createEl('input', { cls: 'bz-newfolder', attr: { placeholder: '新标签，逗号分隔' } })
      ti.oninput = () => (this.tagInput = ti.value)
    }

    this.preview = contentEl.createDiv({ cls: 'bz-mpreview' })
    this.refreshPreview()

    new Setting(contentEl).addButton((b) => {
      this.submitBtn = b
      b.setButtonText(this.prefill ? '保存并重排盘' : '排盘').setCta().onClick(() => this.submit())
      this.updateSubmitState()
    })
  }

  private submit() {
    if (this.entryMode === '农历') {
      const sv = this.lunarSolar()
      if (!sv) return void new Notice('对应公历超出 1801–2099，无法排盘')
      Object.assign(this, { y: sv.y, m: sv.m, d: sv.d, hh: sv.hh, mi: sv.mi })
    }
    const p2 = (n: number) => String(n).padStart(2, '0')
    const pl = this.coord()
    let place = this.pi > 0
      ? `${REGIONS[this.pi - 1].n}·${REGIONS[this.pi - 1].c[this.ci].n}·${REGIONS[this.pi - 1].c[this.ci].a[this.ai].n}`
      : undefined
    let lon = pl?.lng
    // 原 place 匹配失败且用户未改选：保留原值写回，不静默抹掉出生地与真太阳时校准
    if (this.keepOrigPlace() && this.pi === 0) {
      place = this.prefill?.birth.place
      lon = this.prefill?.birth.lon
    }
    const clock = { y: this.y, m: this.m, d: this.d, hh: this.hh, mi: this.mi }
    const subFolder = (this.subFolder === '__new__' ? this.newFolder : this.subFolder).replace(/^\/+|\/+$/g, '')
    const tags = [...this.tagSel, ...this.tagInput.split(/[,，、\s]+/)]
      .map((t) => t.replace(/^#/, '').trim())
      .filter((t, i, a) => t && a.indexOf(t) === i)
    this.close()
    this.onSubmit(this.name || '未命名', {
      date: `${this.y}-${p2(this.m)}-${p2(this.d)}`,
      time: `${p2(this.hh)}:${p2(this.mi)}`,
      gender: this.gender,
      sect: this.sect,
      place,
      lon,
      // 双保险：日期已改出夏令时窗时即使标志残留也不带出
      dst: this.dst && inChinaDst(clock) ? true : undefined,
    }, this.prefill ? undefined : { subFolder: subFolder || undefined, tags })
  }

  onClose() { this.contentEl.empty() }
}
