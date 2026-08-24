# GuYu BaZi（谷雨八字）

**A BaZi (Four Pillars of Destiny, 四柱八字) charting workbench for Obsidian, built for professional practitioners.**

Chart, read, and record — in one three-pane workspace: an interactive chart pane, a case-note pane whose notes live in your vault as plain Markdown, and two-way annotations that link moments on the chart to life events in your notes.

## Features

- **Deterministic chart engine** — four pillars with hidden stems, ten gods, twelve life-stages, void branches and nayin; true solar time correction by birthplace longitude (3,000+ China county coordinates built in); the 1986–1991 China DST confirmation; both late-Zi-hour schools (day unchanged / day advanced).
- **Luck cycles & drill-down** — 20 decade cycles, minor cycles (小运), and year → solar-term month → day → hour drill-down, each column joining the detail grid with its own shensha.
- **Shensha, thoroughly** — 55+ natal shensha plus a 131-rule dynamic shensha panel (year/season/month/xun/day-stem/day-branch perspectives), every rule sourced from classical texts and locked by tests.
- **Notes are the database** — each case is a Markdown note; the birth data lives in frontmatter, so reopening a note reproduces its chart exactly. No proprietary storage, ever.
- **Two-way annotations** — annotate the currently drilled chart position and it lands in the note as a timestamped line; click any annotation to restore the chart to that exact drill state.
- **Three input modes** — Gregorian, lunar (leap months supported), and reverse lookup from four pillars.
- **Fully offline** — zero network requests, zero telemetry. Your clients' birth data never leaves your vault. (The plugin reads note frontmatter across your vault locally — that is how duplicate-chart detection and tag suggestions work.)

The workbench UI is in Chinese, matching the practice domain of its users.

## Install

- **Community plugins** (pending review): search for "GuYu BaZi" in Obsidian → Settings → Community plugins.
- **Manual**: download `main.js`, `manifest.json`, `styles.css` from the [latest release](https://github.com/ArtemisLin/guyu-bazi/releases) into `<vault>/.obsidian/plugins/guyu-bazi/`, then reload Obsidian.

## Quick start

1. Click the compass icon in the ribbon (or run the "打开工作台" command) to open the workbench.
2. Click **＋新盘** to enter a birth (Gregorian / lunar / four-pillar reverse), pick a birthplace for true-solar-time correction, and chart it — a case note is created in `八字剧本集/`.
3. Drill into a year / month / day / hour, then click **✍ 批注** to write an annotation anchored to that moment. Click annotation cards in the middle pane to jump the chart back.

The persistent note format (frontmatter fields, annotation line grammar) is documented in [docs/13](docs/13-持久化格式契约.md) and is guaranteed backward-compatible.

**Note**: the three-pane workbench is desktop-only; on mobile your case notes remain fully readable as ordinary Markdown.

## Development

npm-workspaces monorepo: `packages/bazi-core` (pure TS chart engine, zero Obsidian deps), `packages/bazi-view` (shared HTML renderer), `apps/plugin` (the Obsidian shell). `npm ci && npm run check` runs typechecks, the engine test suite, and plugin smoke tests. Engine rule values are locked by an extensive verified test suite; synthetic fixtures in this repo pin the verified engine's outputs (provenance lives in the maintainers' calibration archive).

## License

[AGPL-3.0-only](LICENSE). Bundles [tyme4ts](https://github.com/6tail/tyme4ts) (MIT) and derives shensha rule tables from [chxb/shensha](https://github.com/chxb/shensha) (MIT) — see [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

---

### 中文简介

谷雨八字：命理师的一体化解读工作台（Obsidian 插件）。三栏：排盘｜断案笔记｜批注时间线。确定性排盘引擎（四柱明细、真太阳时经度修正、1986–1991 夏令时确认、晚子时两派）、大运小运与流年→流月→流日→流时钻取、原局 55+ 神煞＋动态神煞 131 条（岁/季/月/旬/日干/日支六视角）、公历/农历/四柱反推三种录入。**笔记即数据库**：生辰存于 frontmatter，重开笔记原样重现盘面；**批注双向联动**：盘面钻到哪级批到哪级，点批注卡片盘面回到那个时点。完全离线、零联网、零遥测——客户生辰不出你的库。工作台仅桌面端；手机上笔记照常可读。
