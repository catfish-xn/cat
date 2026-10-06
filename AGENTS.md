# 分工规则
- 本项目由两个 AI 协作：GPT/Codex 负责规则、后端、测试、文档和审计；Claude 负责界面。
- 你可以修改：src/simulation/、content/、economy、match-rules、round-schedule、combat、存档、tests/、docs/、各阶段计划文件。
- 你不要修改：src/rendering/、index.html、样式文件，除非我明确要求。
- 界面方面你只定义"要显示什么、数据从哪来"，不要规定布局、颜色、动画等视觉细节。
- Claude 提出的数据需求记录在 docs/UI_REQUESTS.md，由你实现。

# 汇报格式（每次任务结束必须遵守）
最后用以下格式总结，总共不超过 15 行，用中文，不要复述过程：
【完成】做了哪些事（每条一行）
【未完成】还剩什么，为什么
【需要我决定】需要我拍板的问题，给出选项和你的建议
【风险】可能出问题的地方
【下一步】建议我接下来做什么
