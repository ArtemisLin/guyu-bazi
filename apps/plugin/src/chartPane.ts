/**
 * 盘面栏渲染：全部复用 @bazi/view 共享层（与网页验证台同一份实现），
 * 本文件只负责「把 ViewState 翻成共享层的入参」＋岁运条这类壳内布局。
 */
import { computeChart, formatClock, shiftClockMinutes, suiYunDetail, type ChartResult } from '@bazi/core'
import { JulianDay, SolarDay } from 'tyme4ts'
import { drillChain } from './anchor'
import {
  ZONE, esc, gz2, liurenPanelHtml, pillarRows, shenShaGroups, todayGZ, wangBar, wxGZ,
  type PanelAnchors, type PillarCol,
} from '@bazi/view'
import type { Birth, ViewState } from './types'

export function buildChart(b: Birth, trueSolar: boolean): ChartResult {
  const [y, m, d] = b.date.split('-').map(Number)
  const [hh, mi] = b.time.split(':').map(Number)
  const useSolar = trueSolar && b.lon !== undefined
  return computeChart({
    clock: { y, m, d, hh, mi },
    gender: b.gender,
    ziShiSect: b.sect,
    ...(b.dst ? { dst: true } : {}),
    ...(useSolar ? { lon: b.lon, trueSolar: true } : { trueSolar: false }),
  })
}

/** 排盘后把大运/流年定位到今年（与验证台同逻辑） */
export function locateNow(st: ViewState, c: ChartResult): void {
  const now = new Date().getFullYear()
  if (now < c.daYun[0].startYear && c.preYun.liuNian.length) {
    st.dy = -1
    st.ln = Math.max(0, c.preYun.liuNian.findIndex((l) => l.year === now))
  } else {
    st.dy = Math.max(0, c.daYun.findIndex((dy) => now >= dy.startYear && now < dy.startYear + 10))
    st.ln = Math.max(0, c.daYun[st.dy]?.liuNian.findIndex((l) => l.year === now) ?? 0)
  }
  st.my = null
  st.ri = null
  st.si = null
  st.pin = null
}

/**
 * 交节临近警示（docs/00 规格项）：出生时刻距最近的「节」在 ±24h 内则提示核对时辰。
 * 只看节（isJie）不看气——月柱只在交节时换。
 */
export function jieQiWarn(b: Birth): string {
  const [y0, m0, d0] = b.date.split('-').map(Number)
  const [hh0, mi0] = b.time.split(':').map(Number)
  // dst＝对钟表读数本身的修正：先减 1 小时再算距节，否则贴节 dst 盘的「已交/未交」方向会与盘面月柱矛盾
  // （经度真太阳时不进此函数是既有设计——按钟表时提醒核对；dst 性质不同，审查核验修正 2026-08-11）
  const { y, m, d, hh, mi } = b.dst ? shiftClockMinutes({ y: y0, m: m0, d: d0, hh: hh0, mi: mi0 }, -60) : { y: y0, m: m0, d: d0, hh: hh0, mi: mi0 }
  const bornJd = JulianDay.fromYmdHms(y, m, d, hh, mi, 0).getDay()
  const term = SolarDay.fromYmd(y, m, d).getTerm()
  let best: { name: string; hours: number } | null = null
  for (let k = -2; k <= 2; k++) {
    const t = term.next(k)
    if (!t.isJie()) continue
    const hours = (t.getJulianDay().getDay() - bornJd) * 24
    if (!best || Math.abs(hours) < Math.abs(best.hours)) best = { name: t.getName(), hours }
  }
  if (!best || Math.abs(best.hours) > 24) return ''
  const when = best.hours >= 0 ? `${best.hours.toFixed(1)} 小时后交` : `已交 ${Math.abs(best.hours).toFixed(1)} 小时`
  return `<div class="bz-warn">贴近交节：<b>${best.name}</b>（${when}）——请核对出生时刻，差一点月柱就不同。</div>`
}

/** 返回 html 与本轮三锚（供图钉 handler 取快照） */
export function chartPaneHtml(st: ViewState): { html: string; anchors: PanelAnchors | null } {
  const c = st.chart
  if (!c) return { html: `<div class="bz-empty">还没有盘面——点上方「新盘」输入生辰，或打开一篇带生辰的断案笔记。</div>`, anchors: null }

  // 钻取链与批注锚共用同一份解算（anchor.ts drillChain），防「渲染的盘」与「批注的锚」漂移
  const { inXY, dy, nianList, ln, months, mo, days, rd, shi, stt } = drillChain(st, c)
  // 虚岁基准＝引擎 birthYear（真太阳时年）——跨年修正盘与钟表年差一年，不得再从输入日期取
  const birthYear = c.birthYear

  // ① 头部信息条
  let html = `<div class="bz-head">
    <b>${st.birth.gender === '乾' ? '乾造' : '坤造'}</b>
    <span>农历 <b>${c.lunarLabel}</b> ${c.detail.hour.branch}时</span>
    <span>${st.birth.date} ${st.birth.time}${st.birth.place ? ` · ${esc(st.birth.place)}` : ''}</span>
    <span>真太阳时 <b>${formatClock(c.trueSolarClock)}</b></span>
    <span>日主 <b>${c.dayMaster}</b></span><span>司令 <b>${c.siLing}</b></span>
    <span>起运 <b>${c.childLimit.year}年${c.childLimit.month}月${c.childLimit.day}天</b>（${c.qiYunDate} 交运）</span>
    <span>胎息 <b>${c.taiMingShen.taiXi}</b></span>
    <span>星宿 <b>${c.xingXiu}宿·${ZONE[c.xingXiu] ?? ''}</b></span>
    <span>命卦 <b>${c.mingGua.name}</b></span>
    <span class="chip tg${st.tms ? ' on' : ''}" data-act="tms">胎命身 ${st.tms ? '开' : '关'}</span>
    ${st.birth.sect === 'huanri' ? '<span class="chip">晚子换日</span>' : '<span class="chip">晚子不换日</span>'}
    ${st.birth.dst ? '<span class="chip">夏令时 −1时</span>' : ''}
  </div>${jieQiWarn(st.birth)}`

  // ② 明细表（列序：流时｜流日｜流月｜流年｜大运/小运｜四柱）
  const natal: PillarCol[] = [
    { h: '年柱', det: c.detail.year }, { h: '月柱', det: c.detail.month },
    { h: '日柱', det: c.detail.day }, { h: '时柱', det: c.detail.hour },
  ]
  const g = st.birth.gender
  const drill: PillarCol[] = []
  if (stt && rd) drill.push({ h: `流时 ${stt.label}时`, sui: true, det: suiYunDetail(stt.ganZhi, c, g, 'liushi') })
  if (rd) drill.push({ h: `流日 ${rd.month}/${rd.day}`, sui: true, det: suiYunDetail(rd.ganZhi, c, g, 'liuri') })
  if (mo) drill.push({ h: `流月 ${mo.term}`, sui: true, det: suiYunDetail(mo.ganZhi, c, g, 'liuyue') })
  const lead: PillarCol[] = st.tms
    ? [
        { h: '身宫', sui: true, det: c.taiMingShen.shenGong },
        { h: '命宫', sui: true, det: c.taiMingShen.mingGong },
        { h: '胎元', sui: true, det: c.taiMingShen.taiYuan },
      ]
    : [
        ...drill,
        { h: `流年 ${ln.year}`, sui: true, det: ln.detail },
        inXY
          ? { h: '小运', sui: true, det: suiYunDetail(ln.xiaoYun, c, g, 'xiaoyun') }
          : { h: `大运 ${dy!.startYear}`, sui: true, det: dy!.detail },
      ]
  html += pillarRows([...lead, ...natal], { csFold: st.csFold })

  // ③ 大运 / 流年 / 流月 / 流日 / 流时 条
  html += `<div class="sec">大运（20 步）<span class="ln"></span></div><div class="strip">`
  if (c.preYun.liuNian.length)
    html += `<div class="cell${inXY ? ' sel' : ''}" data-dy="-1"><div class="yr">${c.preYun.startYear}</div><div class="ag">${c.preYun.endAge === 1 ? '0岁' : `1~${c.preYun.endAge}岁`}</div><div class="gz2 xylab">小运</div></div>`
  html += c.daYun.map((d, i) => `<div class="cell${i === st.dy ? ' sel' : ''}" data-dy="${i}"><div class="yr">${d.startYear}</div><div class="ag">${d.startAge}岁</div><div class="gz2">${gz2(c.dayMaster, d.ganZhi)}</div></div>`).join('')
  html += `</div><div class="sec">流年 · 格末行＝小运<span class="ln"></span></div><div class="strip">`
  html += nianList.map((l, i) => `<div class="cell${i === st.ln ? ' sel' : ''}" data-ln="${i}"><div class="yr">${l.year}</div><div class="ag">${l.year - birthYear + 1}岁</div><div class="gz2">${gz2(c.dayMaster, l.ganZhi)}</div><div class="xy">${wxGZ(l.xiaoYun)}</div></div>`).join('')
  html += `</div><div class="sec">流月 · ${ln.year} ${ln.ganZhi}<span class="ln"></span></div><div class="strip">`
  html += months.map((m, i) => `<div class="cell mo${i === st.my ? ' sel' : ''}" data-my="${i}"><div class="yr">${m.term}</div><div class="ag">${m.month}/${m.day}</div><div class="gz2">${gz2(c.dayMaster, m.ganZhi)}</div></div>`).join('')
  html += `</div>`
  if (mo && days) {
    const last = days[days.length - 1]
    html += `<div class="sec">流日 · ${mo.ganZhi}月（${mo.term} ${mo.month}/${mo.day} → ${last.month}/${last.day}）<button class="fold" data-act="f-ri">收起流日 ▲</button><span class="ln"></span></div><div class="strip wrap">`
    html += days.map((r, i) => `<div class="cell${i === st.ri ? ' sel' : ''}" data-ri="${i}"><div class="yr">${r.lunar}</div><div class="ag">${r.month}/${r.day}</div><div class="gz2">${gz2(c.dayMaster, r.ganZhi)}</div></div>`).join('')
    html += `</div>`
    if (rd && shi) {
      html += `<div class="sec">流时 · ${rd.y}-${rd.month}-${rd.day} ${rd.ganZhi}日<button class="fold" data-act="f-si">收起流时 ▲</button><span class="ln"></span></div><div class="strip wrap">`
      html += shi.map((s, i) => `<div class="cell${i === st.si ? ' sel' : ''}" data-si="${i}"><div class="yr">${s.start}</div><div class="ag">${s.label}时</div><div class="gz2">${gz2(c.dayMaster, s.ganZhi)}</div></div>`).join('')
      html += `</div>`
    }
  }

  // ④ 旺相条 → 动态神煞面板 → 神煞总览（槽位同验证台）
  html += wangBar(c.detail.month.branch)
  const tg = todayGZ()
  const tdy = new Date()
  const anchors: PanelAnchors = {
    nian: { gz: ln.ganZhi, label: String(ln.year) },
    yue: mo ? { gz: mo.ganZhi, label: mo.term } : { gz: tg.yue, label: '本月', isToday: true },
    ri: rd ? { gz: rd.ganZhi, label: `${rd.month}/${rd.day}` } : { gz: tg.ri, label: `${tdy.getMonth() + 1}/${tdy.getDate()}`, isToday: true },
  }
  html += liurenPanelHtml(anchors, { cat: st.cat, pin: st.pin, folded: st.panelFolded })
  html += shenShaGroups(c, lead, g, st.overviewFolded)
  return { html, anchors }
}
