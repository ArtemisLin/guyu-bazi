/** 批注录入弹窗＋同生辰三选对话（从 main.ts 拆出，2026-08-18） */
import { Modal, Notice, Setting, type App } from 'obsidian'

export class AnnotateModal extends Modal {
  private text: string
  constructor(app: App, private label: string, private onSubmit: (text: string) => void, initial = '') {
    super(app)
    this.text = initial
  }

  onOpen() {
    const { contentEl } = this
    contentEl.createEl('h3', { text: '批注此时点' })
    contentEl.createDiv({ cls: 'bz-anno-label', text: `⏱ ${this.label}` })
    const ta = contentEl.createEl('textarea', {
      cls: 'bz-anno-ta',
      attr: { rows: '5', placeholder: '批语……（此年/月/日发生了什么、断了什么、应验如何）' },
    })
    ta.value = this.text
    ta.oninput = () => (this.text = ta.value)
    new Setting(contentEl).addButton((b) => b.setButtonText('写入笔记').setCta().onClick(() => {
      if (!this.text.trim()) return void new Notice('批语为空')
      this.close()
      this.onSubmit(this.text.trim())
    }))
    ta.focus()
  }

  onClose() {
    this.contentEl.empty()
  }
}

// ───────────────────────── 同生辰三选 ─────────────────────────

/**
 * 同生辰命中的三选对话（审查修复 2026-08-11）：
 * 同一人复诊＝打开已有＋追加复诊分节（docs/00 Q4 裁决，首选）；
 * 双胞胎等同生辰不同人＝仍要新建；取消＝什么都不做。
 * onDone 在动作完成后调用一次（Esc/点外关闭也算取消）。
 */
export class DupCaseModal extends Modal {
  private settled = false
  constructor(
    app: App,
    private existingName: string,
    private actions: { openExisting: () => Promise<void>; createNew: () => Promise<void> },
    private onDone: () => void,
  ) {
    super(app)
  }

  onOpen() {
    const { contentEl } = this
    contentEl.createEl('h3', { text: '同生辰已有案例' })
    contentEl.createDiv({
      cls: 'bz-anno-label',
      text: `「${this.existingName}」与本次录入的生辰完全相同。同一人复诊请打开已有笔记；双胞胎等同生辰不同人可另建新案例（案例名须与已有笔记不同）。`,
    })
    const run = (fn?: () => Promise<void>) => {
      this.settled = true
      this.close()
      if (fn)
        void fn()
          .catch((e) => new Notice(`操作失败：${e instanceof Error ? e.message : String(e)}`))
          .finally(() => this.onDone()) // 无论成败都通知等待方，不悬挂
      else this.onDone()
    }
    new Setting(contentEl)
      .addButton((b) => b.setButtonText('打开已有（追加今日复诊）').setCta().onClick(() => run(this.actions.openExisting)))
      .addButton((b) => b.setButtonText('仍要新建（同生辰另案）').onClick(() => run(this.actions.createNew)))
      .addButton((b) => b.setButtonText('取消').onClick(() => run()))
  }

  onClose() {
    this.contentEl.empty()
    if (!this.settled) {
      this.settled = true
      this.onDone()
    }
  }
}
