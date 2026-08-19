/** 设置页（从 main.ts 拆出，2026-08-18） */
import { PluginSettingTab, Setting, type App } from 'obsidian'
import { CATS } from '@bazi/view'
import { DEFAULT_SETTINGS } from './types'
import type BaziPlugin from './main'

export class BaziSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: BaziPlugin) { super(app, plugin) }

  display() {
    const { containerEl } = this
    containerEl.empty()
    new Setting(containerEl).setName(`谷雨八字 v${this.plugin.manifest.version}`).setDesc('更新插件后须重载 Obsidian（Cmd+Q 重启或命令面板「重新加载」），版本号变了才是新版。').setDisabled(true)
    new Setting(containerEl).setName('断案笔记文件夹').addText((t) => t.setValue(this.plugin.settings.folder).onChange(async (v) => {
      this.plugin.settings.folder = v.trim() || DEFAULT_SETTINGS.folder
      await this.plugin.saveSettings()
    }))
    new Setting(containerEl).setName('文件名模板').setDesc('{案例名} 为占位符').addText((t) => t.setValue(this.plugin.settings.fileTemplate).onChange(async (v) => {
      this.plugin.settings.fileTemplate = v.trim() || DEFAULT_SETTINGS.fileTemplate
      await this.plugin.saveSettings()
    }))
    new Setting(containerEl).setName('真太阳时').setDesc('开启后按出生地经度换算（未填经度则不修正）').addToggle((t) => t.setValue(this.plugin.settings.trueSolar).onChange(async (v) => {
      this.plugin.settings.trueSolar = v
      await this.plugin.saveSettings()
    }))
    new Setting(containerEl).setName('晚子时默认规则').addDropdown((d) => d
      .addOption('wenzhen', '不换日（默认）').addOption('huanri', '换日')
      .setValue(this.plugin.settings.sect).onChange(async (v) => {
        this.plugin.settings.sect = v as 'wenzhen' | 'huanri'
        await this.plugin.saveSettings()
      }))
    new Setting(containerEl).setName('神煞总览默认收起').addToggle((t) => t.setValue(this.plugin.settings.overviewFolded).onChange(async (v) => {
      this.plugin.settings.overviewFolded = v
      await this.plugin.saveSettings()
    }))
    new Setting(containerEl).setName('动态神煞类别').setDesc(`共 ${CATS.length} 类：${CATS.map((c) => c.label).join('、')}`).setDisabled(true)
    // 应急恢复入口：用户不靠 agent 也能找到成品下载与步骤（docs/14）
    const bk = new Setting(containerEl).setName('备份与应急恢复')
    bk.descEl.createSpan({ text: '断案笔记＝普通 Markdown，靠 remotely-save 同步备份（请定期手动同步一次看有无报错）。插件成品在 GitHub Releases：' })
    bk.descEl.createEl('a', { text: 'github.com/ArtemisLin/guyu-bazi/releases', href: 'https://github.com/ArtemisLin/guyu-bazi/releases' })
    bk.descEl.createSpan({ text: '，下载 zip 解压到 vault/.obsidian/plugins/guyu-bazi/ 后重载即可恢复；完整步骤见仓库 docs/14-应急恢复指南.md。' })
  }
}
