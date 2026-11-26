# GitHub resources used

## Devices.css

Source: https://github.com/picturepan2/devices.css

License: MIT, Copyright (c) 2017 Yan Zhu. Full license included in `Devices.css-LICENSE.txt`.

The iPhone 14 Pro `.device-header` and `.device-sensors` geometry in `dist/devices.css` informed the compact Dynamic Island proportions in `devices.mjs`. The island's 120×35 dimensions and 390px screen were normalized to the renderer's 375px design width; outer device-frame padding was removed because exports are screenshots, not device mockups. Expanded and hidden modes are local additions.

## Google Material Design Icons

Source: https://github.com/google/material-design-icons

License: Apache-2.0. Full license included in `Material-Design-Icons-LICENSE.txt`.

The following unmodified SVG source assets are stored in `assets/android-status/`: `signal_wifi_4_bar`, `signal_cellular_4_bar`, `bluetooth`, `battery_std`. They are used in Android status-bar rendering; battery fill/percentage remains dynamically drawn from the user's settings.

Exact download URLs, file sizes and SHA-256 hashes are recorded in `github-source-ledger.json`. Sources were retrieved from their public GitHub repositories on 2026-11-24. Time fonts used by the screenshot renderer remain the local font assets extracted during the Keep reference research.


地图中文字形使用 Google Fonts 的 Noto Sans SC，按 SIL Open Font License1.1 提供。随包版本固定为400字重并转换为 WOFF2，字体名称改为 RunStudio Map Han。原许可见 NotoSansSC-OFL.txt，来源、原始哈希和派生说明见 noto-map-font-source.json。

## 参考视觉素材

Keep 名称、图标、部分界面装饰和提取字体来自 Keep 客户端界面研究；这些素材及对应商标权利归原权利人，不作为本项目原创资产。原始用户截图和带账号的分享响应不在仓库内。默认地图、状态栏和演示路线已重新生成。
