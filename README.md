# 薪水铸币厂 · Salary Mint

把上班时间铸成一张会跳动的钞券：实时今日进账、下班倒计时、月度工资日历、金库与换算所。

纯静态网页 + 一个 macOS 菜单栏应用。**所有数据只存在你自己的浏览器或本机，不联网、不上传、没有账号。**

[**在线体验 →**](https://yinbro.github.io/salary-mint/) · [**下载 macOS 版 →**](https://github.com/yinbro/salary-mint/releases/latest)

![网页版（日铸）](docs/screenshots/web-hero.jpg)

## 它做什么

| 模块 | 内容 |
|---|---|
| 今日铸造 | 按计薪分钟逐秒累加的今日已赚，翻牌数字、进度条、班次时间轴、下班倒计时 |
| 公司预设 | 8 家头部互联网公司的作息与薪酬结构一键套用，附带各城市社保公积金口径 |
| 金库 | 每天铸一枚，攒成金条；按月堆叠，直观看到「这个月已经铸了多少」 |
| 薪酬解剖 | 月薪 / 年薪月数 / 年终奖系数拆到日薪、时薪、每秒进账；税后按所选城市口径 |
| 铸币日历 | 法定节假日、调休补班、请假与带薪假标注，点一下就能改当天状态 |
| 换算所 | 把今天的收入换算成奶茶、咖啡、电影票、新手机…… |
| 勋章厅 | 按当日与当月铸造状态自动点亮 |
| 口径与来源 | 每条法定数据都标了出处（国务院、四城人社与公积金中心、财税文件） |

日铸 / 夜铸两套主题，跟随时间自动切换，也可以手动锁定。

## 公司预设与城市口径

![公司预设](docs/screenshots/company-presets.jpg)

初始化第二步可以从 8 家公司里一键选，选中后自动带出作息、年薪月数、公积金比例，以及对应的社保城市口径：

| 公司 | 作息 | 年薪 | 城市口径 | 公积金 |
|---|---|---|---|---|
| 字节跳动 | 10:00–19:00 · 午休 2h | 15 薪 | 北京 | 12% |
| 腾讯 | 09:30–18:30 · 午休 1.5h | 16 薪 | 深圳 | 12% |
| 阿里巴巴 | 09:30–18:00 · 午休 1.5h | 16 薪 | 杭州 | 12% |
| 美团 | 10:00–19:00 · 午休 1.5h | 15.5 薪 | 北京 | 12% |
| 拼多多 | 11:00–20:00 · 午休 1.5h | 16 薪 | 上海 | 7% |
| 网易 | 09:30–18:30 · 午休 1.5h | 15 薪 | 杭州 | 12% |
| 百度 | 10:00–19:00 · 午休 1.5h | 15 薪 | 北京 | 12% |
| 京东 | 09:00–18:00 · 午休 1h | 15 薪 | 北京 | 12% |

**这些作息和薪酬结构是社区常见说法，不是任何公司的官方制度**，选中后可在设置里逐项改回自己的实际值。每张卡片上都有原创的卡通吉祥物，与各公司官方标识无关。

社保与公积金则是有出处的：上海 / 北京 / 深圳 / 杭州四城都取 2026 年度官方通告的上下限与个人费率（北京医疗为 2% + 3 元，深圳失业 0.3%），逐条来源列在页面「VII 口径与来源」。换城市后，缴费基数会按当地上下限截断，公积金比例选项也会收进当地允许区间。

## 界面

| 日铸 | 夜铸 |
|---|---|
| ![日铸](docs/screenshots/web-day.jpg) | ![夜铸](docs/screenshots/web-night.jpg) |

## 在线使用

打开 [yinbro.github.io/salary-mint](https://yinbro.github.io/salary-mint/)，第一次会走三步初始化（薪酬结构 → 选公司/班次 → 默认视角）。数据存在浏览器 localStorage，换设备或清缓存会丢，重要配置可用设置里的「导出配置」备份。

## macOS 版

菜单栏常驻今日进账，点开是完整账本。支持 macOS 13 及以上，Apple Silicon 与 Intel 通用。

**安装**：从 [Releases](https://github.com/yinbro/salary-mint/releases/latest) 下载 `SalaryMint-1.1.0-macOS.zip`，解压后把「薪水铸币厂.app」拖进「应用程序」。

**首次打开**：应用没有做 Apple 公证（省开发者年费），系统会拦一次。右键点击应用选「打开」，或执行：

```bash
xattr -dr com.apple.quarantine /Applications/薪水铸币厂.app
```

**日常操作**：左键点菜单栏金额开关面板；右键有「打开完整账本 / 立即刷新 / 重新载入页面 / 退出」。

![菜单栏面板](docs/screenshots/menubar-panel.png)

**从旧版本迁移**：早期版本用的 Bundle ID 是 `net.lucas.salarymint`，数据目录在 `~/Library/WebKit/net.lucas.salarymint`。新版改成 `com.salarymint.app`，首次启动是空的。迁移方式：旧版「设置 → 导出配置」拿到 JSON，新版「设置 → 导入配置」读回去；旧数据目录确认不再需要后可以自行删除。

## 自己构建

网页部分零依赖，直接用任意静态服务器打开 `web/` 即可：

```bash
python3 -m http.server 8000 --directory web
```

macOS 应用需要 Xcode Command Line Tools（`xcode-select --install`）：

```bash
bash macos/build.sh
```

产物在 `macos/build/薪水铸币厂.app`，是 `arm64 + x86_64` 通用二进制，已做 ad-hoc 签名。`build.sh` 默认读取仓库根的 `web/`，也可以用 `WEB_DIR=/path/to/web bash macos/build.sh` 指定。

自检（无 GUI 也能跑，会打印页面状态与快照 JSON）：

```bash
./macos/build/薪水铸币厂.app/Contents/MacOS/SalaryMint --selftest
```

图标重建是可选的，需要 Pillow 与系统宋体：

```bash
python3 macos/gen_icon.py
```

## 目录结构

```
web/                 网页源，GitHub Pages 与 macOS 应用共用同一份
macos/               Swift 外壳：菜单栏、面板、完整账本窗口、构建脚本
docs/screenshots/    README 用图
.github/workflows/   Pages 部署 + macOS Release 构建
```

网页里的 `assets/desktop-bridge.js` 是给 macOS 外壳读数字用的：检测不到 `window.webkit.messageHandlers` 就自动跳过，所以在浏览器里运行没有任何副作用。

## 数据与隐私

- 没有后端、没有埋点、没有第三方请求；字体走系统字体栈，不加载外部资源
- 配置与记录只写在当前浏览器 localStorage（`mintatl.*`）或应用自己的 WebKit 数据目录
- 「值班铸币师署名」只是券面上的装饰文字，不参与任何计算

## 免责声明

页面里的个税、社保、公积金、节假日口径按上海市规则整理，来源逐条标注在「VII 口径与来源」，仅供个人估算参考，**不构成税务、法律或劳动关系的意见**。实际金额以工资条与官方口径为准。

## License

[MIT](LICENSE) © 2026 Lucas Yin

---

## English

**Salary Mint** turns your working hours into a ticking banknote: a live "earned today" counter, off-work countdown, monthly pay calendar, a coin vault, and a "what is this worth" converter.

It ships as a zero-dependency static site and a macOS menu bar app. Everything stays local — no backend, no analytics, no account, no network calls.

- **Try it online**: https://yinbro.github.io/salary-mint/
- **Download for macOS** (13+, universal binary): [Releases](https://github.com/yinbro/salary-mint/releases/latest). The app is ad-hoc signed only, so right-click → Open on first launch, or run `xattr -dr com.apple.quarantine /Applications/薪水铸币厂.app`.
- **Build**: serve `web/` with any static server, or run `bash macos/build.sh` (requires Xcode Command Line Tools).

Tax and social-insurance figures follow Shanghai rules and are sourced in-app under "VII 口径与来源"; they are estimates, not professional advice.

MIT licensed.
