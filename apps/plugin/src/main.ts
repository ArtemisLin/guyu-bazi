/**
 * 谷雨八字 Obsidian 插件（v1 最小可用版）
 * 三栏工作台：盘面｜断案笔记｜AI（灰置占位）。盘面渲染复用 @bazi/view，与网页验证台同一份实现。
 * 移动端守卫：手机上只做只读降级提示，不注册视图、不报错（vault 经 remotely-save 同步到手机）。
 */
import { Notice, Platform, Plugin, TFile } from 'obsidian'
import { parseAnnotations, type DrillAnchor } from './anchor'
import { birthFromFrontmatter } from './note'
import { BaziSettingTab } from './settingsTab'
import { DEFAULT_SETTINGS, sanitizeSettings, type BaziSettings, type Birth } from './types'
import { BaziView, VIEW_TYPE } from './view'

export default class BaziPlugin extends Plugin {
  settings: BaziSettings = { ...DEFAULT_SETTINGS }

  async onload() {
    await this.loadSettings()
    this.addSettingTab(new BaziSettingTab(this.app, this))

    // 笔记内「打开盘面」按钮：渲染 ```bazi 代码块（阅读模式与实时预览都生效）。
    // 生辰单一数据源＝frontmatter，块内容仅作说明文字——移动端也注册，渲染成一句提示而非裸代码块。
    this.registerMarkdownCodeBlockProcessor('bazi', (_source, el, ctx) => {
      el.empty()
      const wrap = el.createDiv({ cls: 'bz-noteblock' })
      if (Platform.isMobile) {
        wrap.createSpan({ text: '谷雨八字盘面仅桌面端可用；生辰存于本笔记 frontmatter。' })
        return
      }
      const file = this.app.vault.getAbstractFileByPath(ctx.sourcePath)
      const b = file instanceof TFile ? birthFromFrontmatter(this.app.metadataCache.getFileCache(file)?.frontmatter) : null
      if (!b || !(file instanceof TFile)) {
        wrap.createSpan({ text: '未在本笔记 frontmatter 找到生辰（bazi 字段），无法排盘。' })
        return
      }
      wrap.createSpan({ text: `${b.gender === '乾' ? '乾造' : '坤造'} ${b.date} ${b.time}${b.place ? ` · ${b.place}` : ''}` })
      const btn = wrap.createEl('button', { cls: 'bz-btn bz-primary', text: '打开谷雨八字盘面' })
      btn.onclick = () => void this.openFromFile(file, b)
    })

    // 阅读模式下批注行（- ⏱ …）行尾加「⇄盘」：点了打开工作台并还原到批注时点
    this.registerMarkdownPostProcessor((el, ctx) => {
      if (Platform.isMobile) return
      el.querySelectorAll('li').forEach((li) => {
        const t = (li.textContent ?? '').trim()
        if (!t.startsWith('⏱')) return
        const parsed = parseAnnotations(`- ${t}`)
        if (!parsed.length) return
        const btn = li.createEl('button', { cls: 'bz-tl-jump', text: '⇄盘' })
        btn.onclick = () => {
          const file = this.app.vault.getAbstractFileByPath(ctx.sourcePath)
          if (!(file instanceof TFile)) return
          const b = birthFromFrontmatter(this.app.metadataCache.getFileCache(file)?.frontmatter)
          if (!b) return void new Notice('本笔记 frontmatter 无生辰，无法排盘')
          void this.openFromFile(file, b, parsed[0].anchor)
        }
      })
    })

    // 移动端守卫：优雅降级，不注册视图也不抛错
    if (Platform.isMobile) {
      this.addCommand({
        id: 'bazi-mobile-notice',
        name: '移动端说明（三栏工作台仅桌面端）',
        callback: () => new Notice('谷雨八字三栏工作台仅支持桌面端；手机上可正常阅读断案笔记。'),
      })
      return
    }

    this.registerView(VIEW_TYPE, (leaf) => new BaziView(leaf, this))
    this.addRibbonIcon('compass', '谷雨八字', () => void this.activateView())
    this.addCommand({ id: 'open-bazi-workbench', name: '打开工作台', callback: () => void this.activateView() })

    // 文件右键菜单：带生辰的笔记可直接开盘
    this.registerEvent(this.app.workspace.on('file-menu', (menu, file) => {
      if (!(file instanceof TFile) || file.extension !== 'md') return
      const b = birthFromFrontmatter(this.app.metadataCache.getFileCache(file)?.frontmatter)
      if (!b) return
      menu.addItem((i) => i.setTitle('在谷雨八字中打开盘面').setIcon('compass').onClick(() => void this.openFromFile(file, b)))
    }))
    this.addCommand({
      id: 'new-bazi-chart',
      name: '新盘（输入生辰）',
      callback: async () => {
        const view = await this.activateView()
        view?.openNewChartModal()
      },
    })
    this.addCommand({
      id: 'open-chart-from-note',
      name: '用当前笔记的生辰排盘',
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile()
        if (!file) return false
        const b = birthFromFrontmatter(this.app.metadataCache.getFileCache(file)?.frontmatter)
        if (!b) return false
        if (!checking) void this.openFromFile(file, b)
        return true
      },
    })
  }

  onunload() {
    // Obsidian 1.7+ 会自行清理本插件注册的视图，无需手动 detach
  }

  async loadSettings() {
    const raw = (await this.loadData()) as Partial<BaziSettings> | null
    this.settings = sanitizeSettings(raw ?? {})
  }
  async saveSettings() {
    await this.saveData(this.settings)
  }

  async activateView(): Promise<BaziView | null> {
    const { workspace } = this.app
    let leaf = workspace.getLeavesOfType(VIEW_TYPE)[0]
    if (!leaf) {
      leaf = workspace.getLeaf('tab')
      await leaf.setViewState({ type: VIEW_TYPE, active: true })
    }
    await workspace.revealLeaf(leaf)
    const v = leaf.view
    return v instanceof BaziView ? v : null
  }

  async openFromFile(file: TFile, b: Birth, anchor?: DrillAnchor) {
    const view = await this.activateView()
    if (!view) return
    view.loadCase(file.basename, b, file.path)
    if (anchor) view.restoreAnchor(anchor)
  }
}
