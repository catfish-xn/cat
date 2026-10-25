【完成】2026-10-25，分支 codex/v23-bundle-split2，基线 473f2e2b；未提交 Git，未运行完整测试套件。
【完成】先以生产配置记录模块、静态/动态依赖和渲染长度：`node --experimental-strip-types scripts/report-bundle-modules.ts`；前后 JSON 位于 `artifacts/bundle-split/{before,after}.json`。
【完成】把单人应用及恢复/历史回放专用依赖共 31 个模块放入 `assets/solo/application-*.js`（gzip-9 55,189 字节）；在线使用服务器状态与回放数据，不使用单人存档应用。在线启动与首次点击匹配均不请求该包，单人则在创建场景前加载。
【完成】`combat-display` 直接引用原有领域回放函数，绕开 server-entry 桶文件带入的恢复校验；未改函数行为或规则。主要迁出 serialization-structure、b8-restore、m8/restore 和 item-restore。
【完成】前后均运行 `npm run build -- --configLoader runner`：顶层 dist/assets/*.js gzip-9 从 654,106 降至 604,951（−49,155）；目标 630,000、硬限 637,144，余量 32,193；相对 424,763 为 1.42421。
【完成】3D 单列 270,757、UI 文本单列 25,048 字节，均未变化；solo 新列 55,189。原 1.50/1.20 阈值未改，新增 HTML 禁止预加载 solo 与静态可达性检查。
【完成】内容身份检查仍为 e0b6bb65 / 72a886d1；两个服务器入口构建的 SHA-256 前后分别完全一致，服务器源码未改。
【完成】生产 Chromium 补充冒烟通过：在线首次交互无 solo 请求；单人加载 solo 后固定种子 42 正常开局，两个入口均无 pageerror；结果在 artifacts/bundle-split/browser-startup.json。
【完成】共 53 个测试文件、502 项通过：分包/预算/身份 18 项，相关显示/回放 108 项，tests/server/net、tests/presentation 与单人回归 375 项，加载屏障 1 项；最终隔离/预算/屏障复核 16 项通过，`npx tsc --noEmit -p .` 通过。
【未完成】原 `node scripts/verify-m5-browser.cjs` 已尝试，但 Vite 默认配置加载器写只读 node_modules/.vite-temp 时 EROFS，未进入浏览器；普通无附加参数的 npm run build 同样受限，runner 构建已通过。
【需要我决定】无；分包约定已按用户委托记录为 docs/S13_RULES_GAP.md 的 P-BUNDLE-1（2026-10-25）。
【风险】单人首次进入增加一次模块请求；发布时须同时保留 assets/solo 文件。共享规则仍在主包，未来内容扩展需继续监控余量。
【下一步】在 node_modules 可写环境补跑原浏览器冒烟并交叉验货，再由有 Git 写权限的环境提交；发布时整体部署 dist，保持原预算门禁。
