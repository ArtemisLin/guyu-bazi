/**
 * 全国省市区县出生地库（3056 区县带坐标；验证台与插件共用的单一数据源）。
 * 2026-08-19 自 index.ts 抽出（逐字未动），使谷雨六壬可按文件 sync（007 docs/02 §1.2 前置改动③）。
 */
import REGIONS_DATA from './regions.json'

export interface RegionArea { n: string; g: [number, number] | null }
export interface RegionCity { n: string; a: RegionArea[] }
export interface Region { n: string; c: RegionCity[] }
export const REGIONS = REGIONS_DATA as Region[]

/** 省/市/区县索引 → 经纬度（区县无坐标时返回 null＝不修正真太阳时）。pi=0 表示未知地。 */
export function regionCoord(pi: number, ci: number, ai: number): { lng: number; lat: number } | null {
  if (pi === 0) return null
  const p = REGIONS[pi - 1]
  if (!p) return null
  const c = p.c[Math.min(ci, p.c.length - 1)]
  const a = c.a[Math.min(ai, c.a.length - 1)]
  return a.g ? { lng: a.g[0], lat: a.g[1] } : null
}
