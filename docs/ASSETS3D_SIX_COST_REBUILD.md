# 六费模型离线重建

仓库转换器现在直接读取可见披风的静态 hold 纹理，并在查找材质前跳过初始隐藏的子网格。保留普通 diffuse 的优先级，未知、缺失或歧义的可见材质仍报错；不重建披风滚动着色器。

本地已提取的动画图表明：沃里克、维克托的受击/击飞别名与死亡动作指向同一源文件。六费文件后缀能绕过现有的分词排除规则，因此这两人的 `animations.hit` 显式设为 `null`：转换器记录 `unit-disabled-action`，省略输出 hit，阻止别名和文件名回退；death、其他动作和梅尔的独立受击保留。

使用已有本地提取源、基础素材根和已转换特效根，无需下载，也无需本地 converter loader：

```powershell
node scripts/assets3d/six-cost-models.mjs --source assets3d-local/six-cost/source --base assets3d-local/cast-anim --fx assets3d-local/fx-batch7 --out assets3d-local/six-cost/rebuilt-next
```

输出目录必须不存在；失败后请指定新的目录，脚本不覆盖已有交付。产物依次为 `converted/`（原始转换结果）、`models/`（仅模型的素材根）和 `root/`（完整合成根）。以重新转换的模型最后覆盖旧特效根里的模型映射，保留已有动作特效绑定；不改基础素材或特效输入。素材及截图继续只放 gitignore 目录，不提交。

本机验证：三个模型转换 ready=true，梅尔的初始隐藏子网格省略、可见披风纹理正确；沃里克和维克托的输出均无 hit，death 保留。最终发布步骤受当前文件沙箱限制：`merge-root-output.mjs` 的既有祖先路径检查在 `realpath C:\Users\Administrator` 返回 EPERM。路径检查保持不变，完整合成根尚未在此沙箱验证，需在允许读取祖先目录的普通本机环境运行上述命令。

合成单测覆盖 hold 纹理、默认纹理优先级、隐藏大小写、隐藏缺失材质、可见缺失/歧义材质，以及六费后缀死亡别名复现和显式关闭 hit；测试不依赖本地版权素材。
