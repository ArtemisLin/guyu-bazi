// 谷雨八字插件打包：esbuild → CommonJS 单文件 main.js，并把三件套拷进 vault 插件目录。
// vault 路径经 BAZI_VAULT 环境变量或仓库根 .vault-path 文件（gitignored）配置。
import { build, context } from 'esbuild'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const watch = process.argv.includes('--watch')
const rollbackIdx = process.argv.indexOf('--rollback')
// vault 路径来源（优先级）：BAZI_VAULT 环境变量 → 仓库根 .vault-path 文件（gitignored，一行绝对路径）。
// 个人路径不进 tracked 文件（docs/00 #77 公开前提）；两者都没有时构建照常、跳过装库。
function localVaultPath() {
  try {
    const p = readFileSync(join('..', '..', '.vault-path'), 'utf8').trim()
    return p || null
  } catch { return null }
}
const VAULT = process.env.BAZI_VAULT || localVaultPath() || ''
const OUT_DIR = join(VAULT, '.obsidian/plugins/guyu-bazi')
// 2026-08-05 改名前的旧安装目录：迁移设置后清除
const LEGACY_DIR = join(VAULT, '.obsidian/plugins/bazi-workbench')

/** Obsidian 运行时提供、绝不能打进包里的模块 */
const EXTERNAL = [
  'obsidian', 'electron', '@codemirror/autocomplete', '@codemirror/collab', '@codemirror/commands',
  '@codemirror/language', '@codemirror/lint', '@codemirror/search', '@codemirror/state', '@codemirror/view',
  '@lezer/common', '@lezer/highlight', '@lezer/lr',
  'node:fs', 'node:path', 'node:os', 'node:crypto', 'fs', 'path', 'os', 'crypto',
]

const opts = {
  entryPoints: ['src/main.ts'],
  bundle: true,
  format: 'cjs',
  target: 'es2020',
  platform: 'browser',
  external: EXTERNAL,
  outfile: 'dist/main.js',
  sourcemap: watch ? 'inline' : false,
  minify: !watch,
  logLevel: 'info',
  // banner 不会被 minify 剥掉——第三方 MIT 版权声明放这里（tyme4ts 整库打包在内；完整清单见仓库 THIRD-PARTY-NOTICES.md）
  banner: { js: '/* 谷雨八字 (guyu-bazi) © 2026 artemislin — AGPL-3.0-only (see LICENSE). 由 apps/plugin 构建，勿手改。Bundles tyme4ts (MIT, Copyright (c) 2024 6tail, https://github.com/6tail/tyme4ts); shensha rules derived from chxb/shensha (MIT). See THIRD-PARTY-NOTICES.md */' },
}

/** 已装进 vault 的 manifest 版本（未装过返回 null） */
function installedVersion() {
  const f = join(OUT_DIR, 'manifest.json')
  if (!existsSync(f)) return null
  try { return JSON.parse(readFileSync(f, 'utf8')).version ?? null } catch { return null }
}

/**
 * 装库前把 vault 里现有三件套备份到 apps/plugin/dist/backup/<旧版本>_<时间戳>/（dist 已 gitignore，不进仓库也不同步到手机）。
 * **每次**装库都备份（同版本重装/dev 也备——否则已发布的正式包会被 WIP 覆盖而无处找回），只保留最近 10 份。
 * 回滚＝npm run rollback（缺省装回最近一份备份＝撤销上一次装库；带版本号则装回该版本最近的备份）＋重载 Obsidian。
 */
const KEEP_BACKUPS = 10
function stamp() {
  const d = new Date(), p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}
function backupInstalled() {
  const ver = installedVersion()
  if (!ver) return
  const files = ['main.js', 'manifest.json', 'styles.css']
  if (!files.every((f) => existsSync(join(OUT_DIR, f)))) return
  const dir = join('dist', 'backup', `${ver}_${stamp()}`)
  mkdirSync(dir, { recursive: true })
  for (const f of files) copyFileSync(join(OUT_DIR, f), join(dir, f))
  console.log(`✓ 已备份 vault 内当前 v${ver} → ${dir}（回滚：npm run rollback）`)
  // 只留最近 KEEP_BACKUPS 份
  const all = listBackups()
  for (const b of all.slice(KEEP_BACKUPS)) rmSync(join('dist', 'backup', b.name), { recursive: true, force: true })
}
/** 备份目录列表，新→旧（目录名 <ver>_<stamp>；兼容早期无时间戳的 <ver> 目录） */
function listBackups() {
  const root = join('dist', 'backup')
  if (!existsSync(root)) return []
  return readdirSync(root)
    .map((name) => {
      const m = name.match(/^(\d+\.\d+\.\d+)(?:_(\d{8}-\d{6}))?$/)
      return m ? { name, ver: m[1], stamp: m[2] ?? '00000000-000000' } : null
    })
    .filter((b) => b && ['main.js', 'manifest.json', 'styles.css'].every((f) => existsSync(join(root, b.name, f))))
    .sort((a, b) => (a.stamp < b.stamp ? 1 : a.stamp > b.stamp ? -1 : cmpVer(b.ver, a.ver)))
}

function install() {
  if (!VAULT || !existsSync(VAULT)) {
    console.warn(`⚠ 未配置 vault（设 BAZI_VAULT 或在仓库根放 .vault-path 文件），跳过安装${VAULT ? `：${VAULT}` : ''}`)
    return
  }
  const newVer = JSON.parse(readFileSync('manifest.json', 'utf8')).version
  const oldVer = installedVersion()
  // 版本门禁：忘 bump 是老毛病（HANDOFF §0 节奏靠人肉记）——非 watch 构建同版本重装大声警告，倒退拒装
  if (oldVer && oldVer !== newVer && cmpVer(newVer, oldVer) < 0) {
    console.error(`✗ 拒绝安装：manifest ${newVer} 低于已装 ${oldVer}（要回滚请用 npm run rollback）`)
    process.exit(1)
  }
  if (!watch && oldVer === newVer) console.warn(`⚠ manifest 版本仍是 ${newVer}，与已装相同——发版前记得 bump（用户靠界面版本号判断有没有更新）`)
  syncPackageVersion()
  backupInstalled()
  mkdirSync(OUT_DIR, { recursive: true })
  copyFileSync('dist/main.js', join(OUT_DIR, 'main.js'))
  copyFileSync('manifest.json', join(OUT_DIR, 'manifest.json'))
  copyFileSync('styles.css', join(OUT_DIR, 'styles.css'))
  // 首次安装：优先迁移旧目录的设置，否则留一个空 data.json
  const dataFile = join(OUT_DIR, 'data.json')
  const legacyData = join(LEGACY_DIR, 'data.json')
  if (!existsSync(dataFile)) writeFileSync(dataFile, existsSync(legacyData) ? readFileSync(legacyData) : '{}')
  if (existsSync(LEGACY_DIR)) {
    rmSync(LEGACY_DIR, { recursive: true, force: true })
    console.log('✓ 已迁移设置并清理旧目录 bazi-workbench')
  }
  console.log(`✓ 已安装 v${newVer} 到 ${OUT_DIR}${oldVer && oldVer !== newVer ? `（原 v${oldVer}）` : ''}`)
}

function cmpVer(a, b) {
  const pa = a.split('.').map(Number), pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d) return d
  }
  return 0
}

/** npm run rollback [版本]：装回最近一份备份（＝撤销上一次装库）；给版本号则装回该版本最近的备份。三件齐全才动手 */
function rollback(target) {
  if (!VAULT || !existsSync(VAULT)) { console.error('✗ 未配置 vault（设 BAZI_VAULT 或仓库根 .vault-path）'); process.exit(1) }
  const all = listBackups()
  if (!all.length) { console.error('✗ 没有可用备份（dist/backup/ 下无三件齐全的目录）'); process.exit(1) }
  const pick = target ? all.find((b) => b.ver === target) : all[0]
  if (!pick) { console.error(`✗ 找不到版本 ${target} 的备份，可用：${[...new Set(all.map((b) => b.ver))].join(', ')}`); process.exit(1) }
  const src = join('dist', 'backup', pick.name)
  mkdirSync(OUT_DIR, { recursive: true })
  for (const f of ['main.js', 'manifest.json', 'styles.css']) copyFileSync(join(src, f), join(OUT_DIR, f))
  console.log(`✓ 已回滚到 v${pick.ver}（备份 ${pick.name} → ${OUT_DIR}）——请重载 Obsidian`)
}

if (rollbackIdx >= 0) {
  rollback(process.argv[rollbackIdx + 1])
} else if (watch) {
  const ctx = await context({
    ...opts,
    plugins: [{ name: 'install', setup: (b) => b.onEnd((r) => { if (!r.errors.length) install() }) }],
  })
  await ctx.watch()
  console.log('watch 中……改代码即自动重装，Obsidian 里 Ctrl/Cmd+R 重载')
} else {
  mkdirSync('dist', { recursive: true })
  await build(opts)
  // 目录审核的 Build verification 在仓库根 dist/ 找 main.js——三件套同步拷一份（根 dist/ 已 gitignore）
  const rootDist = join('..', '..', 'dist')
  mkdirSync(rootDist, { recursive: true })
  copyFileSync('dist/main.js', join(rootDist, 'main.js'))
  copyFileSync('manifest.json', join(rootDist, 'manifest.json'))
  copyFileSync('styles.css', join(rootDist, 'styles.css'))
  install()
}

/**
 * manifest.json 是版本唯一来源：构建时把 package.json、根 package-lock.json 里本包的 version，
 * 以及 versions.json（Obsidian 社区市场要求的「版本→minAppVersion」表）同步过去，防漂移。
 */
function syncPackageVersion() {
  const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'))
  const mv = manifest.version
  // versions.json：追加本版本→minAppVersion（已有同键且值相同则不动）
  const vj = existsSync('versions.json') ? JSON.parse(readFileSync('versions.json', 'utf8')) : {}
  if (vj[mv] !== manifest.minAppVersion) {
    vj[mv] = manifest.minAppVersion
    writeFileSync('versions.json', JSON.stringify(vj, null, 2) + '\n')
    console.log(`✓ versions.json 已登记 ${mv} → minAppVersion ${manifest.minAppVersion}`)
  }
  const pkgText = readFileSync('package.json', 'utf8')
  if (JSON.parse(pkgText).version !== mv) {
    writeFileSync('package.json', pkgText.replace(/"version":\s*"[^"]*"/, `"version": "${mv}"`))
    console.log(`✓ package.json version 已同步为 manifest 的 ${mv}`)
  }
  // 公开仓（根有 manifest.json——Obsidian 目录只读根目录）：同步根 manifest/versions
  const rootManifest = join('..', '..', 'manifest.json')
  if (existsSync(rootManifest)) {
    writeFileSync(rootManifest, readFileSync('manifest.json'))
    writeFileSync(join('..', '..', 'versions.json'), readFileSync('versions.json'))
  }
  const lockPath = join('..', '..', 'package-lock.json')
  if (existsSync(lockPath)) {
    const lockText = readFileSync(lockPath, 'utf8')
    // 只改 packages["apps/plugin"] 段里的 version 一行，保持其余字节不动
    const re = /("apps\/plugin":\s*\{\s*"name":\s*"@bazi\/plugin",\s*"version":\s*")([^"]*)(")/
    const m = lockText.match(re)
    if (m && m[2] !== mv) {
      writeFileSync(lockPath, lockText.replace(re, `$1${mv}$3`))
      console.log(`✓ package-lock.json 内 apps/plugin version 已同步为 ${mv}`)
    }
  }
}
