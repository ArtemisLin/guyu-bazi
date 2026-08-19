# 第三方声明（THIRD-PARTY-NOTICES）

本项目（谷雨八字，`ArtemisLin/guyu-bazi`）打包分发的 `main.js` 与验证台单文件 HTML 中包含或衍生自以下第三方作品。按各自许可要求，随发行版附带版权与许可声明。本仓库自身以 **GNU AGPL-3.0**（根目录 LICENSE，2026-08-18 用户选定）发布；下列第三方均为 MIT/WTFPL，与 AGPL 兼容。

## tyme4ts — MIT

- 用途：干支／节气／农历／大运起运的计算底座（`packages/bazi-core` 依赖，整库打进 `main.js` 与验证台产物；esbuild minify 会剥掉源码内的许可注释，故在此与构建 banner 中显式保留）。
- 来源：https://github.com/6tail/tyme4ts （v1.5.x）
- 版权：Copyright (c) 2024 6tail

```
MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## chxb/shensha — MIT

- 用途：`packages/bazi-core/src/shensha.ts` 原局神煞规则表以其 52 条起法为底稿逐条转译（属实质衍生），并按黄金样本做过多处修正；原文件存于 `reference/shensha-chxb.js`。
- 来源：https://github.com/chxb/shensha
- 许可：MIT（版权归原作者 chxb；许可条款同上）

## 出生地坐标库（`packages/bazi-view/src/regions.json`，由 `apps/demo/tools/build-regions.mjs` 生成）

- 行政区划名称与代码：modood/Administrative-divisions-of-China — https://github.com/modood/Administrative-divisions-of-China （WTFPL）
- 县级地名经纬度：yhdjyyzk/GeoJSON_data — https://github.com/yhdjyyzk/GeoJSON_data （以其仓库声明为准）
- 数据经行政代码联合并均值回退处理，非原样再分发。

## 开发依赖（不进发行产物）

esbuild、vitest、happy-dom、typescript、obsidian（类型定义）——仅构建/测试期使用，不打包进用户安装的文件。
