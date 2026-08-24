// 发版：git tag → GitHub Release（只附 main.js/manifest.json/styles.css 三件套，docs/00 #80）。
// 目的＝任何时刻 GitHub 上都有一份「用户不靠 agent 也能下载安装」的成品（docs/14 应急恢复指南）。
// 用法：先 commit＋push，再  npm run release   （工作区必须干净、manifest 版本必须未发过）
import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const sh = (cmd, opts = {}) => execSync(cmd, { stdio: opts.quiet ? 'pipe' : 'inherit', encoding: 'utf8', ...opts })
const ver = JSON.parse(readFileSync('manifest.json', 'utf8')).version
// Obsidian 官方要求 Release tag 与 manifest version 逐字符相同（无 v 前缀）——docs/00 #77
const tag = ver

if (sh('git status --porcelain', { quiet: true }).trim()) {
  console.error('✗ 工作区有未提交改动，先 commit＋push 再发版')
  process.exit(1)
}
// 无条件重新生产构建：dist/main.js 可能是 watch 留下的未压缩 WIP 或 bump 前的旧包（.gitignore 管不到它）——
// 发出去的成品必须就是 HEAD 源码。构建会顺带装进本机 vault，与发版语义一致（发的就是用的）。
sh('node esbuild.config.mjs')
// 只传三件套：Obsidian 目录只认 main.js/manifest.json/styles.css，额外附件（如 zip）会被审核点名 extra files

const tags = sh('git tag', { quiet: true }).split('\n')
const head = sh('git rev-parse HEAD', { quiet: true }).trim()
if (tags.includes(tag)) {
  // 版本已发过：tag 必须就指向 HEAD，否则是忘 bump——拒发，不许 --clobber 覆盖成「tag 指旧 commit、附件是新代码」
  const at = sh(`git rev-parse ${tag}^{}`, { quiet: true }).trim()
  if (at !== head) {
    console.error(`✗ ${tag} 已存在且指向 ${at.slice(0, 7)}，HEAD 是 ${head.slice(0, 7)}——版本已发过，请 bump manifest 后再发`)
    process.exit(1)
  }
} else {
  sh(`git tag -a ${tag} -m "谷雨八字 ${tag}"`)
  console.log(`✓ git tag ${tag}`)
}
sh(`git push origin ${tag}`)

let hasRelease = false
try { sh(`gh release view ${tag}`, { quiet: true }); hasRelease = true } catch { /* 无则创建 */ }
const notes = `谷雨八字 ${tag}。安装/恢复：下载 main.js / manifest.json / styles.css 三个文件放进 <vault>/<配置目录>/plugins/guyu-bazi/，重载 Obsidian。详见仓库 docs/14-应急恢复指南.md。`
if (hasRelease) {
  sh(`gh release upload ${tag} dist/main.js manifest.json styles.css --clobber`)
  console.log(`✓ Release ${tag} 附件已更新`)
} else {
  sh(`gh release create ${tag} dist/main.js manifest.json styles.css --title "谷雨八字 ${tag}" --notes "${notes}"`)
  console.log(`✓ Release ${tag} 已创建`)
}
