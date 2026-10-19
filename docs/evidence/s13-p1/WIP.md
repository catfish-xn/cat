# S13 P1 implementation checkpoint (not signed off)

Base: 075e9a494758b13620c8ae36e55364cc214fd364 (multiplayer v11).
Branch: codex/s13-augments-p1. Versions deliberately unchanged until integration.

当前生产选择池已接线：遥遥领先、对冲基金、投资策略 II、炫目之速、便携锻炉、光明圣物；双刀流正在相关测试中，尚未完成验收。

贪财化身原型已从生产池撤出。a025389 的 6 项伤害向量及公共轨迹仅是历史实验，不代表完整实时余额语义已完成；见 experiments/AVARICE-LIMITS.md。双排原型同样撤出，缺少满席所有权及共享池领取事务闭环，原型文件只作后续研究，不是可用实现。

已完成的 6 项早期专项：income 8/8；acquisition 3/3（待选、选择后、下一轮恢复）；真实双边结算收入/征服者跨档 2/2。后续修改的最终结果以 REPORT 为准，不自动继承。

未完成：英勇福袋、升级咯、双排、贪财化身、猎头者、名片、进入未知、终极英雄。未注册无效果选项。基线缺少 B 准备命令账本、可持有的次级复制器、纹章完整投影、四星单位表示，以及绑定单位的跨轮增长事实和暂离容器。

版本保持 v11。无 server/rendering 修改，无时限调整，无跳过测试，无全套测试。g2-3/g2-augments 历史目录不覆盖。最终指纹及普通推送尚待完成。
