/**
 * 断案笔记读写：笔记即数据库——frontmatter 存生辰，重开笔记可原样重现盘面。
 * 一人多次咨询＝同一篇笔记往下追加分节（docs/00 Q4），绝不新建。
 */
import { TFolder, normalizePath, type App, type TFile } from 'obsidian'
import type { Birth } from './types'

export const FM_KEY = 'bazi'
/**
 * bazi 块格式版本（docs/13 持久化格式契约）。读取端不校验 v（旧笔记无 v＝v1 语义）；
 * 将来字段语义变化时 bump 并在 birthFromFrontmatter 按 v 分支迁移，禁止静默改含义。
 */
export const FM_VERSION = 1

/**
 * YAML 标量：普通中文/字母数字裸写（人读顺眼），含 YAML 特殊结构（「: 」「 #」、首字符 -?:[]{}&*!|>'"%@` 等、
 * 首尾空白、布尔/null/纯数字字面量）时用双引号 JSON 转义——案例名/标签手拼进 frontmatter 曾无转义，
 * 「张三: 复诊」会让整段 frontmatter 解析失败、笔记生辰读不出（审查修复 2026-08-18，docs/13 §1）。
 */
export function yamlStr(s: string): string {
  const needs = s === ''
    || /^[\s\-?:,[\]{}#&*!|>'"%@`]/.test(s)
    || /:\s|:$|\s#|[[\]{}"'\\]|[\r\n\t]/.test(s)
    || /\s$/.test(s)
    || /^(true|false|null|yes|no|on|off|~)$/i.test(s)
    || /^[+-]?(\d[\d_]*\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s)
    || /^[+-]?0[xo]/i.test(s)
    || /^[+-]?\.(inf|nan)$/i.test(s)
  return needs ? JSON.stringify(s) : s
}

/** 笔记骨架：命主档案＋人生节点时间线＋断语（docs/00 决策 3） */
export function noteTemplate(caseName: string, b: Birth, pillars: string[], tags: string[] = []): string {
  const fm = [
    '---',
    `案例名: ${yamlStr(caseName)}`,
    `${FM_KEY}:`,
    `  v: ${FM_VERSION}`,
    `  date: "${b.date}"`,
    `  time: "${b.time}"`,
    `  gender: "${b.gender}"`,
    `  sect: "${b.sect}"`,
    b.place ? `  place: ${JSON.stringify(b.place)}` : null,
    b.lon !== undefined ? `  lon: ${b.lon}` : null,
    b.dst ? '  dst: true' : null,
    `四柱: "${pillars.join(' ')}"`,
    tags.length ? `标签:\n${tags.map((t) => `  - ${yamlStr(t)}`).join('\n')}` : '标签: []',
    '---',
  ].filter((x) => x !== null).join('\n')
  return `${fm}

\`\`\`bazi
生辰存于上方 frontmatter；谷雨八字插件会把此块渲染为「打开盘面」按钮，请勿删除。
\`\`\`

## 命主档案

- 家庭：
- 伴侣：
- 子女：
- 事业：
- 情感：

## 人生节点

<!-- 批注由盘面「✍ 批注」按钮写入，格式：- ⏱ 年份干支｜节气月｜月/日 —— 批语；点批注可还原盘面 -->

## 断语

### ${todayStamp()} 首次

`
}

export function todayStamp(): string {
  const d = new Date()
  const p2 = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
}

/** 从 frontmatter 还原生辰；缺字段或格式不符返回 null（不猜） */
export function birthFromFrontmatter(fm: Record<string, unknown> | undefined): Birth | null {
  const raw = fm?.[FM_KEY] as Record<string, unknown> | undefined
  if (!raw) return null
  const asStr = (v: unknown): string => (typeof v === 'string' ? v : '')
  const date = asStr(raw.date)
  const time = asStr(raw.time)
  const gender = asStr(raw.gender)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null
  if (gender !== '乾' && gender !== '坤') return null
  const sect = raw.sect === 'huanri' ? 'huanri' : 'wenzhen'
  const lon = typeof raw.lon === 'number' ? raw.lon : undefined
  const place = typeof raw.place === 'string' && raw.place ? raw.place : undefined
  const dst = raw.dst === true ? true : undefined
  return { date, time, gender, sect, lon, place, dst }
}

/** 同生辰重复检测（docs/00 规格项）：扫全库 frontmatter，返回已有笔记 */
export function findExistingCase(app: App, b: Birth): TFile | null {
  for (const f of app.vault.getMarkdownFiles()) {
    const fm = app.metadataCache.getFileCache(f)?.frontmatter
    const got = birthFromFrontmatter(fm)
    if (got && got.date === b.date && got.time === b.time && got.gender === b.gender) return f
  }
  return null
}

export function noteFilePath(folder: string, template: string, caseName: string): string {
  const base = (template || '{案例名}').replace('{案例名}', caseName).replace(/[\\/:*?"<>|]/g, '_')
  return normalizePath(`${folder}/${base}.md`)
}

/** 建笔记；文件夹（含多层子路径）不存在则逐级自建。返回落盘文件 */
export async function createNote(app: App, path: string, content: string): Promise<TFile> {
  const parts = path.split('/')
  let dir = ''
  for (const seg of parts.slice(0, -1)) {
    dir = dir ? `${dir}/${seg}` : seg
    if (!app.vault.getAbstractFileByPath(dir)) await app.vault.createFolder(dir)
  }
  return app.vault.create(path, content)
}

/** 根文件夹下全部后代子文件夹（相对路径）——用户自建，不预设分类 */
export function listSubfolders(app: App, root: string): string[] {
  const base = app.vault.getAbstractFileByPath(normalizePath(root))
  const out: string[] = []
  const walk = (folder: TFolder, prefix: string) => {
    for (const ch of folder.children)
      if (ch instanceof TFolder) {
        const rel = prefix ? `${prefix}/${ch.name}` : ch.name
        out.push(rel)
        walk(ch, rel)
      }
  }
  if (base instanceof TFolder) walk(base, '')
  return out.sort()
}

/** 根文件夹下所有笔记已用过的标签（快捷 chips 的数据源）。命理标签用独立「标签」键（用户裁决不与 Obsidian 原生 tags 混用）；读取兼容早期误写的 tags 键 */
export function collectTags(app: App, root: string): string[] {
  const set = new Set<string>()
  const prefix = normalizePath(root) + '/'
  for (const f of app.vault.getMarkdownFiles()) {
    if (!f.path.startsWith(prefix)) continue
    const fm: Record<string, unknown> | undefined = app.metadataCache.getFileCache(f)?.frontmatter
    for (const key of ['tags', '标签']) {
      const v = fm?.[key]
      const arr = Array.isArray(v) ? v : typeof v === 'string' ? v.split(/[,，、\s]+/) : []
      for (const t of arr) {
        const c = String(t).replace(/^#/, '').trim()
        if (c) set.add(c)
      }
    }
  }
  return [...set].sort()
}

/**
 * 在「## 断语」下追加一节（一人多次咨询同笔记追加，不新建）。
 * Vault.process 原子读改写：与内嵌编辑器防抖落盘并发时不互相覆盖（审查修复 2026-08-11，appendAnnotation 同）。
 */
export async function appendConsult(app: App, file: TFile, title: string): Promise<void> {
  const heading = `### ${title}`
  await app.vault.process(file, (text) =>
    text.includes(heading) ? text : `${text.replace(/\s*$/, '')}\n\n${heading}\n\n`)
}

/** 生辰改错补救：把新生辰与四柱写回 frontmatter（重开笔记按新生辰重现盘面） */
export async function updateBirthFrontmatter(app: App, file: TFile, b: Birth, pillars: string[]): Promise<void> {
  await app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
    fm[FM_KEY] = {
      v: FM_VERSION,
      date: b.date,
      time: b.time,
      gender: b.gender,
      sect: b.sect,
      ...(b.place ? { place: b.place } : {}),
      ...(b.lon !== undefined ? { lon: b.lon } : {}),
      ...(b.dst ? { dst: true } : {}),
    }
    fm['四柱'] = pillars.join(' ')
  })
}

/**
 * 纯函数：把批注行插进全文「## 人生节点」节末（无节则文末补节）。
 * 返回新文本与锚行行号（0-based，全文坐标含 frontmatter）——就地批注要用行号定位光标（docs/00 #79）。
 * 磁盘路径（appendAnnotation）与内嵌编辑器缓冲区路径共用本函数，插入逻辑单源。
 */
export function insertAnnotationLine(text: string, line: string): { text: string; lineNo: number; hadSection: boolean } {
  const lines = text.split('\n')
  const h = lines.findIndex((l) => /^##\s*人生节点/.test(l))
  if (h < 0) {
    const nt = `${text.replace(/\s*$/, '')}\n\n## 人生节点\n\n${line}\n`
    return { text: nt, lineNo: nt.split('\n').length - 2, hadSection: false }
  }
  let end = lines.length
  for (let i = h + 1; i < lines.length; i++)
    if (/^##\s/.test(lines[i])) {
      end = i
      break
    }
  let ins = end
  while (ins > h + 1 && lines[ins - 1].trim() === '') ins--
  lines.splice(ins, 0, line)
  return { text: lines.join('\n'), lineNo: ins, hadSection: true }
}

/** 批注行写进「## 人生节点」节末（原子读改写，见 appendConsult 注）；返回锚行行号供光标定位 */
export async function appendAnnotation(app: App, file: TFile, line: string): Promise<number> {
  let lineNo = 0
  await app.vault.process(file, (text) => {
    const r = insertAnnotationLine(text, line)
    lineNo = r.lineNo
    return r.text
  })
  return lineNo
}
