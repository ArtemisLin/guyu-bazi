/**
 * 三栏工作台视图（BaziView）：盘面｜断案笔记｜AI（灰置）。盘面渲染复用 @bazi/view，与网页验证台同一份实现。
 * 从 main.ts 拆出（2026-08-18，审查建议：main.ts 1200+ 行五类同文件）；main.ts 只留 Plugin 生命周期与命令注册。
 */
import { ItemView, MarkdownView, Notice, TFile, WorkspaceLeaf, sanitizeHTMLToDom, type App } from 'obsidian'
import type { PanelAnchors } from '@bazi/view'
import { anchorText, currentAnchor, formatAnnotationLine, parseAnnotations, restoreDrill, type DrillAnchor } from './anchor'
import { buildChart, chartPaneHtml, locateNow } from './chartPane'
import { AnnotateModal, DupCaseModal } from './modals'
import { NewChartModal } from './newChartModal'
import { appendAnnotation, appendConsult, createNote, findExistingCase, noteFilePath, noteTemplate, todayStamp, updateBirthFrontmatter } from './note'
import type { BaziSettings, Birth, ViewState } from './types'
import type BaziPlugin from './main'

export const VIEW_TYPE = 'guyu-bazi-view'

export class BaziView extends ItemView {
  private st: ViewState
  private anchors: PanelAnchors | null = null
  private chartEl!: HTMLElement
  private noteEl!: HTMLElement
  /** 中栏内嵌的原生 Markdown 编辑 leaf（live preview；游离于布局树外，须手动 detach） */
  private embedLeaf: WorkspaceLeaf | null = null

  constructor(leaf: WorkspaceLeaf, private plugin: BaziPlugin) {
    super(leaf)
    this.st = emptyState(plugin.settings)
  }

  getViewType() { return VIEW_TYPE }
  getDisplayText() { return this.st.caseName ? `谷雨 · ${this.st.caseName}` : '谷雨八字' }
  getIcon() { return 'compass' }

  private paneEls!: { chart: HTMLElement; note: HTMLElement; ai: HTMLElement }

  async onOpen() {
    const root = this.containerEl.children[1] as HTMLElement
    root.empty()
    root.addClass('bz-root')
    const ws = root.createDiv({ cls: 'bz-workspace' })
    type FoldKey = 'chartFold' | 'noteFold' | 'aiFold'

    // 每栏＝折叠竖条（折叠时显示，点击展开）＋栏头＋栏体；栏头带「−」折叠钮
    const mkPane = (cls: string, title: string, foldKey: FoldKey) => {
      const pane = ws.createDiv({ cls: `bz-pane ${cls}` })
      const foldbar = pane.createDiv({ cls: 'bz-foldbar', attr: { title: `展开「${title}」` } })
      foldbar.createSpan({ text: title })
      foldbar.onclick = () => {
        this.plugin.settings.panes[foldKey] = false
        void this.plugin.saveSettings()
        this.applyLayout()
      }
      const tab = pane.createDiv({ cls: 'bz-pane-tab' })
      tab.createSpan({ cls: 'bz-name', text: title })
      const foldBtn = () => {
        const b = tab.createEl('button', { cls: 'bz-btn bz-foldbtn', text: '−', attr: { title: `折叠「${title}」` } })
        b.onclick = () => {
          this.plugin.settings.panes[foldKey] = true
          void this.plugin.saveSettings()
          this.applyLayout()
        }
      }
      return { pane, tab, foldBtn }
    }

    // 左：盘面
    const A = mkPane('bz-pane-chart', '排盘', 'chartFold')
    // 版本号常驻栏头：用户据此自查「重载后看到的是不是新版」（消灭「以为没更新」，HANDOFF 坑2）
    A.tab.createSpan({ cls: 'chip bz-ver', text: `v${this.plugin.manifest.version}`, attr: { title: '谷雨八字插件版本；更新后需重载 Obsidian 才会变' } })
    A.tab.createDiv({ cls: 'bz-spacer' })
    const btnAnno = A.tab.createEl('button', { cls: 'bz-btn', text: '✍ 批注' })
    btnAnno.onclick = () => this.openAnnotateModal()
    const btnEdit = A.tab.createEl('button', { cls: 'bz-btn', text: '✎ 改生辰' })
    btnEdit.onclick = () => this.openEditBirthModal()
    const btnNew = A.tab.createEl('button', { cls: 'bz-btn', text: '＋新盘' })
    btnNew.onclick = () => this.openNewChartModal()
    A.foldBtn()
    this.chartEl = A.pane.createDiv({ cls: 'bz-pane-body' })

    const div1 = ws.createDiv({ cls: 'bz-divider', attr: { title: '拖动调整宽度' } })

    // 中：断案笔记
    const B = mkPane('bz-pane-note', '断案笔记', 'noteFold')
    B.tab.createDiv({ cls: 'bz-spacer' })
    B.tab.createSpan({ cls: 'chip', text: `存于 ${this.plugin.settings.folder}/` })
    B.foldBtn()
    this.noteEl = B.pane.createDiv({ cls: 'bz-pane-body' })

    const div2 = ws.createDiv({ cls: 'bz-divider', attr: { title: '拖动调整宽度' } })

    // 右：AI（灰置）
    const C = mkPane('bz-pane-ai', 'AI 副驾', 'aiFold')
    C.tab.createDiv({ cls: 'bz-spacer' })
    C.tab.createSpan({ cls: 'chip bz-warn-chip', text: '本期暂缓' })
    C.foldBtn()
    const body3 = C.pane.createDiv({ cls: 'bz-pane-body bz-ai' })
    body3.createDiv({ cls: 'bz-holdnote', text: 'AI 副驾按既定计划暂缓：先用这套工作台积累方法笔记与案例，够量了再接入——能算的不让 AI 猜。' })

    this.paneEls = { chart: A.pane, note: B.pane, ai: C.pane }
    const p = () => this.plugin.settings.panes
    // 分割线拖宽：div1 调笔记栏、div2 调 AI 栏；被调的栏折叠或已成弹性栏时拖动无效
    this.bindDivider(div1, 'noteW', () => p().noteFold || p().chartFold)
    this.bindDivider(div2, 'aiW', () => p().aiFold || (p().chartFold && p().noteFold))
    this.applyLayout()

    // 笔记外部被改（含批注写入）→ 中栏时间线自动刷新；就地编辑中不刷（自动保存也触发 modify，刷了会打断输入）
    this.registerEvent(this.app.vault.on('modify', (f) => {
      if (f.path === this.st.notePath && !this.st.editing) void this.renderNotePane()
    }))

    // 首开无案例：自动按电脑当前时间排今天的即时盘（对齐验证台「清空＝此时此刻」语义）
    if (!this.st.chart) this.loadInstant()
    else this.render()
  }

  /** 布局：折叠栏＝34px 竖条；未折叠的第一栏（排盘＞笔记＞AI）弹性吃满，其余按存储宽度 */
  private applyLayout() {
    const p = this.plugin.settings.panes
    const flexPane = !p.chartFold ? 'chart' : !p.noteFold ? 'note' : 'ai'
    const apply = (el: HTMLElement, name: string, fold: boolean, w: number) => {
      el.toggleClass('bz-folded', fold)
      el.toggleClass('bz-flex', !fold && flexPane === name)
      // 栏宽走 CSS 变量（--bz-w），样式规则在 styles.css：折叠 34px／弹性栏 1 1 320px／其余 0 0 var(--bz-w)
      el.setCssProps({ '--bz-w': `${w}px` })
    }
    apply(this.paneEls.chart, 'chart', p.chartFold, 0)
    apply(this.paneEls.note, 'note', p.noteFold, p.noteW)
    apply(this.paneEls.ai, 'ai', p.aiFold, p.aiW)
  }

  /** 进行中的分割线拖拽（document 级 mousemove/mouseup 只注册一次、随视图生命周期注销） */
  private drag: { div: HTMLElement; key: 'noteW' | 'aiW'; startX: number; startW: number } | null = null

  private bindDivider(div: HTMLElement, key: 'noteW' | 'aiW', disabled: () => boolean) {
    div.onmousedown = (e) => {
      if (disabled()) return
      e.preventDefault()
      this.drag = { div, key, startX: e.clientX, startW: this.plugin.settings.panes[key] }
      div.addClass('dragging')
    }
    if (this.dragBound) return
    this.dragBound = true
    this.registerDomEvent(document, 'mousemove', (ev) => {
      if (!this.drag) return
      this.plugin.settings.panes[this.drag.key] = Math.max(170, Math.min(900, this.drag.startW - (ev.clientX - this.drag.startX)))
      this.applyLayout()
    })
    this.registerDomEvent(document, 'mouseup', () => {
      if (!this.drag) return
      this.drag.div.removeClass('dragging')
      this.drag = null
      void this.plugin.saveSettings()
    })
  }
  private dragBound = false

  /** 即时盘：当下时刻、未知地、不落笔记 */
  private loadInstant() {
    const n = new Date()
    const p2 = (x: number) => String(x).padStart(2, '0')
    this.loadCase('即时盘', {
      date: `${n.getFullYear()}-${p2(n.getMonth() + 1)}-${p2(n.getDate())}`,
      time: `${p2(n.getHours())}:${p2(n.getMinutes())}`,
      gender: '坤',
      sect: this.plugin.settings.sect,
    }, null)
  }

  async onClose() {
    this.closeEmbeddedEditor()
  }

  /**
   * 中栏内嵌原生编辑器：new WorkspaceLeaf 是私有构造（Hover Editor 等插件的通行做法），
   * 版本升级可能失效——失败时回退纯文本编辑，不炸。
   */
  private async openEmbeddedEditor(container: HTMLElement, f: TFile): Promise<boolean> {
    try {
      const Ctor = WorkspaceLeaf as unknown as new (app: App) => WorkspaceLeaf
      const leaf = new Ctor(this.app)
      this.embedLeaf = leaf
      // containerEl 是运行时属性，公开 d.ts 未声明
      const leafEl = (leaf as unknown as { containerEl: HTMLElement }).containerEl
      container.appendChild(leafEl)
      leafEl.addClass('bz-embed-editor')
      await leaf.openFile(f, { state: { mode: 'source' } })
      // 成功判据（审查修复 2026-08-18）：Obsidian 升级最可能的失效形态不是抛错而是「构造成功但渲染空白」——
      // view 不是 MarkdownView 或容器里没长出编辑器 DOM 就视为失败，走纯文本回退，不给用户留死面板
      const rendered = leaf.view instanceof MarkdownView && !!leafEl.querySelector('.cm-editor, .markdown-source-view')
      if (!rendered) {
        console.warn('[谷雨八字] 内嵌编辑器未渲染出编辑区（Obsidian 版本变化？），回退纯文本模式')
        this.closeEmbeddedEditor()
        return false
      }
      return true
    } catch (e) {
      console.error('[谷雨八字] 内嵌编辑器初始化失败，回退纯文本模式', e)
      this.closeEmbeddedEditor()
      return false
    }
  }

  private closeEmbeddedEditor() {
    // 游离 leaf 的 detach() 只摘 view，不会把 containerEl 从我们 appendChild 的位置移走——手动清，
    // 否则失败回退时纯文本框上方会留一条空的带边框壳（审查核验 2026-08-18）
    const leafEl = (this.embedLeaf as unknown as { containerEl?: HTMLElement } | null)?.containerEl
    this.embedLeaf?.detach()
    leafEl?.remove()
    this.embedLeaf = null
  }

  loadCase(name: string, b: Birth, notePath: string | null) {
    this.closeEmbeddedEditor()
    this.st = emptyState(this.plugin.settings)
    this.st.caseName = name
    this.st.birth = b
    this.st.notePath = notePath
    try {
      this.st.chart = buildChart(b, this.plugin.settings.trueSolar)
      locateNow(this.st, this.st.chart)
    } catch (e) {
      new Notice(`排盘失败：${e instanceof Error ? e.message : String(e)}`)
      this.st.chart = undefined
    }
    this.render()
  }

  openNewChartModal() {
    new NewChartModal(this.app, this.plugin, (name, b, extra) => void this.onNewChart(name, b, extra)).open()
  }

  /** 生辰输错的补救：改生辰重排盘，并把新生辰写回笔记 frontmatter（不改案例名与文件） */
  openEditBirthModal() {
    if (!this.st.chart && !this.st.birth.date) return void new Notice('还没有盘——先「＋新盘」')
    new NewChartModal(this.app, this.plugin, (_name, b) => void this.onEditBirth(b), {
      name: this.st.caseName || '未命名',
      birth: this.st.birth,
    }).open()
  }

  private async onEditBirth(b: Birth) {
    const dup = findExistingCase(this.app, b)
    if (dup && dup.path !== this.st.notePath)
      new Notice(`注意：同生辰已有案例「${dup.basename}」`)
    this.st.birth = b
    try {
      this.st.chart = buildChart(b, this.plugin.settings.trueSolar)
      locateNow(this.st, this.st.chart)
    } catch (e) {
      new Notice(`排盘失败：${e instanceof Error ? e.message : String(e)}`)
      this.st.chart = undefined
    }
    this.render()
    if (this.st.chart && this.st.notePath) {
      const f = this.app.vault.getAbstractFileByPath(this.st.notePath)
      if (f instanceof TFile) {
        const p = this.st.chart.pillars
        try {
          await updateBirthFrontmatter(this.app, f, b, [p.year, p.month, p.day, p.hour])
          new Notice('生辰已修改并写回笔记 frontmatter')
        } catch (e) {
          // 写回失败必须明说：盘面（内存）已是新生辰、笔记（磁盘）还是旧的，下次重开会回到改前
          new Notice(`盘面已按新生辰重排，但写回笔记 frontmatter 失败：${e instanceof Error ? e.message : String(e)}——请打开笔记手动核对生辰`, 10000)
        }
      }
    }
  }

  /** 笔记→盘：把批注锚还原成钻取选中状态 */
  restoreAnchor(a: DrillAnchor) {
    if (!this.st.chart) return
    const msg = restoreDrill(this.st, this.st.chart, a)
    this.renderChart()
    new Notice(msg)
  }

  /**
   * 盘→笔记：批注当前选中的年/月/日/时。写入失败时批语连同原锚回填重开 Modal，绝不丢字、锚不漂移
   * （途中 loadCase 会重置钻取状态，重开时必须用首次计算的锚——审查核验修正，2026-08-11）。
   */
  openAnnotateModal(initialText = '', presetAnchor?: DrillAnchor) {
    const c = this.st.chart
    if (!c) return void new Notice('先排盘再批注')
    if (!this.st.notePath && this.st.caseName === '即时盘')
      return void new Notice('即时盘不落笔记——用「＋新盘」建案例后再批注')
    const a = presetAnchor ?? currentAnchor(this.st, c)
    const label = anchorText(a, c.birthYear)
    new AnnotateModal(this.app, label, async (text) => {
      try {
        // 纯文本回退编辑中：Modal 弹出时 textarea 已失焦保存，退出编辑避免旧文覆盖批注；
        // 内嵌原生编辑器实时写盘且同文件多视图自动同步，无需退出
        if (this.st.editing && !this.embedLeaf) this.st.editing = false
        if (!this.st.notePath) await this.onNewChart(this.st.caseName || '未命名', this.st.birth)
        const f = this.st.notePath ? this.app.vault.getAbstractFileByPath(this.st.notePath) : null
        if (!(f instanceof TFile)) {
          new Notice('没有对应笔记，批注未写入——批语已保留在重新打开的弹窗里')
          this.openAnnotateModal(text, a)
          return
        }
        await appendAnnotation(this.app, f, formatAnnotationLine(a, text))
        new Notice(`已批注：${label}`)
      } catch (e) {
        new Notice(`批注写入失败：${e instanceof Error ? e.message : String(e)}——批语已保留在重新打开的弹窗里`)
        this.openAnnotateModal(text, a)
      }
    }, initialText).open()
  }

  /**
   * 同生辰重复检测（docs/00 规格项）：命中时弹三选对话——同一人复诊打开已有（Q4 裁决保留为首选），
   * 双胞胎等同生辰不同人可「仍要新建」；复诊分节改为显式选项、不再静默追加（审查修复 2026-08-11）。
   * 返回的 Promise 在用户做完选择、后续动作完成后 resolve（批注等待建笔记的链路依赖它）。
   */
  private onNewChart(name: string, b: Birth, extra?: { subFolder?: string; tags?: string[] }): Promise<void> {
    return new Promise((resolve) => {
      const dup = findExistingCase(this.app, b)
      if (!dup)
        return void this.createCase(name, b, extra)
          .catch((e) => new Notice(`建笔记失败：${e instanceof Error ? e.message : String(e)}`))
          .finally(resolve) // 意外抛错也必须 resolve，批注流程 await 它、不能悬挂
      new DupCaseModal(this.app, dup.basename, {
        openExisting: async () => {
          this.loadCase(dup.basename, b, dup.path)
          await appendConsult(this.app, dup, `${todayStamp()} 复诊`)
          new Notice(`已打开「${dup.basename}」并在断语下追加今日复诊分节`)
        },
        createNew: () => this.createCase(name, b, extra),
      }, resolve).open()
    })
  }

  private async createCase(name: string, b: Birth, extra?: { subFolder?: string; tags?: string[] }) {
    this.loadCase(name, b, null)
    if (!this.st.chart) return
    const p = this.st.chart.pillars
    const folder = extra?.subFolder ? `${this.plugin.settings.folder}/${extra.subFolder}` : this.plugin.settings.folder
    const path = noteFilePath(folder, this.plugin.settings.fileTemplate, name)
    if (this.app.vault.getAbstractFileByPath(path)) {
      new Notice(`已有同名笔记：${path}——换个案例名，或直接打开那篇笔记`)
      return
    }
    try {
      const file = await createNote(this.app, path, noteTemplate(name, b, [p.year, p.month, p.day, p.hour], extra?.tags ?? []))
      this.st.notePath = file.path
      new Notice(`已建断案笔记：${file.path}`)
      this.render()
    } catch (e) {
      new Notice(`建笔记失败：${e instanceof Error ? e.message : String(e)}`)
    }
  }

  /** 全量：盘面＋笔记栏（换案例/建笔记/改生辰时用） */
  render() {
    this.renderChart()
    void this.renderNotePane()
    // 标题随案例名变化：Obsidian 会在 getDisplayText 变化时自行刷新页签
  }

  /** 只重绘盘面：钻取/折叠/图钉等盘内交互不动笔记栏（笔记内容没变，重建时间线是纯浪费，且会打断中栏编辑） */
  renderChart() {
    if (!this.chartEl) return
    const { html, anchors } = chartPaneHtml(this.st)
    this.anchors = anchors
    // Obsidian 官方 sanitizeHTMLToDom（DOMPurify）挂载：渲染层是本插件自产的受控 HTML（外部来源字段已 esc()），
    // 过一遍 sanitizer 满足社区审核 no-unsanitized 规则；data-* 与 class 均保留，事件仍由 bindChart 事后绑定
    this.chartEl.empty()
    this.chartEl.appendChild(sanitizeHTMLToDom(html))
    this.bindChart()
  }

  /** 中栏＝批注时间线：笔记里的每条 ⏱ 批注都是可点的时间锚，点了盘面还原到该时点 */
  private async renderNotePane() {
    const el = this.noteEl
    // 编辑中不重建（docs/00 #68）：守卫必须在 el.empty() 之前——
    // 否则盘面任意点击（render→renderNotePane）会先摧毁内嵌编辑器/纯文本编辑区再早退，
    // 用户被卡在只剩案例头的死面板里（审查修复 2026-08-11 高危 #2）
    if (this.st.editing && (this.embedLeaf || el.querySelector('.bz-edit-ta'))) return
    el.empty()
    if (!this.st.chart) {
      el.createDiv({ cls: 'bz-empty', text: '排盘后这里会显示批注时间线。' })
      return
    }
    const head = el.createDiv({ cls: 'bz-fm' })
    head.createDiv({ cls: 'bz-kv', text: `${this.st.caseName}｜${this.st.birth.gender === '乾' ? '乾造' : '坤造'}｜${this.st.birth.date} ${this.st.birth.time}` })
    const p = this.st.chart.pillars
    head.createDiv({ cls: 'bz-kv bz-dim', text: `四柱 ${p.year} ${p.month} ${p.day} ${p.hour}` })

    if (!this.st.notePath) {
      if (this.st.caseName === '即时盘') {
        el.createDiv({ cls: 'bz-empty', text: '这是按当前时刻排的即时盘，不落笔记。看客户盘请点「＋新盘」。' })
        return
      }
      const btn = el.createEl('button', { cls: 'bz-btn bz-primary', text: '建断案笔记' })
      btn.onclick = () => void this.onNewChart(this.st.caseName || '未命名', this.st.birth)
      return
    }
    const f = this.app.vault.getAbstractFileByPath(this.st.notePath)
    if (!(f instanceof TFile)) return

    const bar = el.createDiv({ cls: 'bz-notebar' })
    if (this.st.editing) {
      const done = bar.createEl('button', { cls: 'bz-btn bz-primary', text: '完成' })
      done.onclick = () => {
        this.closeEmbeddedEditor()
        this.st.editing = false
        void this.renderNotePane()
      }
      // 首选：内嵌原生 Markdown 编辑器（live preview，与打开 md 文档所见完全一致，自动保存）
      if (await this.openEmbeddedEditor(el, f)) {
        bar.createSpan({ cls: 'bz-savedhint', text: 'Obsidian 原生编辑 · 实时自动保存' })
        return
      }
      // 回退：纯文本编辑（frontmatter 保护不动，防抖自动保存）
      const hint = bar.createSpan({ cls: 'bz-savedhint', text: '纯文本模式 · 自动保存' })
      const full = await this.app.vault.read(f)
      const fmMatch = full.match(/^---\n[\s\S]*?\n---\n?/)
      const fmText = fmMatch?.[0] ?? ''
      const ta = el.createEl('textarea', { cls: 'bz-edit-ta' })
      ta.value = full.slice(fmText.length)
      let timer: number | null = null
      const save = async () => {
        timer = null
        // frontmatter 落盘时现读现拼（原子）：编辑中「改生辰」会更新 frontmatter，
        // 缓存进入编辑时的旧头再拼会把它静默回滚（审查核验发现的回归，2026-08-11）
        await this.app.vault.process(f, (cur) => (cur.match(/^---\n[\s\S]*?\n---\n?/)?.[0] ?? '') + ta.value)
        hint.setText(`已保存 ${new Date().toLocaleTimeString('zh-CN', { hour12: false })}`)
      }
      ta.oninput = () => {
        hint.setText('输入中…')
        if (timer !== null) window.clearTimeout(timer)
        timer = window.setTimeout(() => void save(), 800)
      }
      ta.onblur = () => {
        if (timer !== null) {
          window.clearTimeout(timer)
          void save()
        }
      }
      const oldDone = done.onclick
      done.onclick = async (ev) => {
        if (timer !== null) {
          window.clearTimeout(timer)
          await save()
        }
        oldDone?.call(done, ev)
      }
      ta.focus()
      return
    }
    const edit = bar.createEl('button', { cls: 'bz-btn bz-primary', text: '✎ 在此编辑' })
    edit.onclick = () => {
      this.st.editing = true
      void this.renderNotePane()
    }
    const add = bar.createEl('button', { cls: 'bz-btn', text: '追加复诊分节' })
    add.onclick = async () => {
      await appendConsult(this.app, f, `${todayStamp()} 复诊`)
      new Notice('已在「断语」下追加今日分节')
    }
    const open = bar.createEl('button', { cls: 'bz-btn', text: '在编辑器打开' })
    open.onclick = async () => {
      await this.app.workspace.getLeaf('split', 'vertical').openFile(f)
    }

    const annos = parseAnnotations(await this.app.vault.cachedRead(f))
    el.createDiv({ cls: 'bz-tlhead', text: `人生节点 · 批注时间线（${annos.length} 条）` })
    const tl = el.createDiv({ cls: 'bz-tl' })
    if (!annos.length) {
      tl.createDiv({ cls: 'bz-empty', text: '还没有批注。在盘面点选年/月/日后，点左栏上方「✍ 批注」——批语会写进笔记，这里出现可点的时间卡，点卡片盘面就还原到那个时点。' })
      return
    }
    const by = this.st.chart.birthYear
    for (const an of annos) {
      const item = tl.createDiv({ cls: 'bz-tli' })
      item.createDiv({ cls: 'bz-tli-a', text: `⏱ ${anchorText(an.anchor, by)}` })
      item.createDiv({ cls: 'bz-tli-t', text: an.text })
      item.setAttribute('aria-label', '点击把盘面还原到此时点')
      item.onclick = () => this.restoreAnchor(an.anchor)
    }
  }

  /** 盘面栏事件：全量重渲后重绑（与验证台同架构） */
  private bindChart() {
    const el = this.chartEl
    const re = () => this.renderChart()
    const num = (t: HTMLElement, k: string) => Number(t.dataset[k])

    el.querySelectorAll<HTMLElement>('[data-dy]').forEach((n) => n.onclick = () => {
      this.st.dy = num(n, 'dy'); this.st.ln = 0; this.st.my = null; this.st.ri = null; this.st.si = null; this.st.cat = 'sui'; re()
    })
    el.querySelectorAll<HTMLElement>('[data-ln]').forEach((n) => n.onclick = () => {
      this.st.ln = num(n, 'ln'); this.st.my = null; this.st.ri = null; this.st.si = null; this.st.cat = 'sui'; re()
    })
    el.querySelectorAll<HTMLElement>('[data-my]').forEach((n) => n.onclick = () => {
      const i = num(n, 'my')
      this.st.my = this.st.my === i ? null : i; this.st.ri = null; this.st.si = null
      if (this.st.my !== null && this.st.cat !== 'ji') this.st.cat = 'yue'
      re()
    })
    el.querySelectorAll<HTMLElement>('[data-ri]').forEach((n) => n.onclick = () => {
      const i = num(n, 'ri')
      this.st.ri = this.st.ri === i ? null : i; this.st.si = null
      if (this.st.ri !== null && !['xun', 'rg', 'rz'].includes(this.st.cat)) this.st.cat = 'rg'
      re()
      // 限定在本视图内查：用户「拆分标签页」开出第二个工作台时不能滚错面板
      el.querySelector<HTMLElement>('#lrpanel')?.scrollIntoView({ block: 'nearest' })
    })
    el.querySelectorAll<HTMLElement>('[data-si]').forEach((n) => n.onclick = () => {
      const i = num(n, 'si'); this.st.si = this.st.si === i ? null : i; re()
    })
    el.querySelectorAll<HTMLElement>('[data-pv]').forEach((n) => n.onclick = () => {
      this.st.cat = n.dataset.pv as ViewState['cat']; re()
    })
    el.querySelectorAll<HTMLElement>('[data-act]').forEach((n) => n.onclick = () => {
      switch (n.dataset.act) {
        case 'tms': this.st.tms = !this.st.tms; break
        case 'f-ri': this.st.my = null; this.st.ri = null; this.st.si = null; break
        case 'f-si': this.st.ri = null; this.st.si = null; break
      }
      re()
    })
    const byId = (id: string) => el.querySelector<HTMLElement>(`#${id}`)
    const ppin = byId('b-ppin'); if (ppin) ppin.onclick = () => { this.st.pin = this.st.pin ? null : this.anchors; re() }
    const fpn = byId('f-pn'); if (fpn) fpn.onclick = () => { this.st.panelFolded = !this.st.panelFolded; re() }
    const fss = byId('f-ss'); if (fss) fss.onclick = () => { this.st.overviewFolded = !this.st.overviewFolded; re() }
    const fcs = byId('f-cs'); if (fcs) fcs.onclick = () => { this.st.csFold = !this.st.csFold; re() }
  }
}

function emptyState(s: BaziSettings): ViewState {
  return {
    caseName: '',
    birth: { date: '', time: '', gender: '坤', sect: s.sect },
    notePath: null,
    dy: 0, ln: 0, my: null, ri: null, si: null,
    tms: false,
    cat: 'sui', pin: null, panelFolded: false,
    overviewFolded: s.overviewFolded,
    csFold: true,
    editing: false,
  }
}
