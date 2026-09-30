# 临床 PM 纯对话面试

Dify 仅三个节点：**用户输入 → 临床PM面试官（LLM） → 直接回复**。

不使用代码节点、会话状态变量、题号计数、行为证据提取或报告生成节点。LLM 使用 Dify 自带对话记忆（最近30轮）接续候选人回答。

面试先邀请自我介绍，再了解3—5个临床PM专业主题，然后根据工作经历挖掘动机、决策习惯、压力应对、合作与执行方式。除了指定开场白，每次只输出一个问题，不做评价或报告。短回答也算回答，不重复已回答问题，同一事件最多追问两次。

- 系统提示词：`clinical-pm-system-prompt.txt`
- 当前输入模板：`clinical-pm-query-template.txt`
- 模型：已配置的DeepSeek，关闭思考，普通文本输出（不能启用JSON模式），temperature=0.2，max_tokens=200。
- 回答节点：`{{#llm.text#}}`
- 可选开始输入 `opening_delivered`：TEN语音界面已播报开场时传字符串 `true`，避免重复开场；直接在Dify测试时留空。
- 开始输入 `candidate_name`（80字）和 `candidate_resume`（20000字）由本次面试资料传入；为空时仅依据自我介绍。`clinical_pm_resume.md` 仅是历史样例，不加载到工作流。

## 独立后台报告

TEN业务端识别明确的“结束面试”指令，停止追问并发送内部完成事件。用户点击Disconnect也可结束。界面将完整问答提交给Next业务后台，后台追加本次填写的简历后独立调用分析模型；Dify不参与报告分析。

顶部“查看面试报告”打开Markdown预览，按北森模板结构展示前言、总体结果、综合评价、五方面详细结果、附录，支持下载。没有资料的维度标注资料不足，不伪造北森标准分。

后台环境配置在不提交Git的 `ai_agents/.env`：`INTERVIEW_ANALYSIS_BASE_URL`、`INTERVIEW_ANALYSIS_MODEL`、`INTERVIEW_ANALYSIS_API_KEY`。报告默认保存在系统临时目录 `ten-interview-reports`，可用 `INTERVIEW_REPORT_DIR` 指定持久目录。当前面向本地单实例；部署时应接入用户认证、数据库与任务队列。

对话顺序和防重复依赖模型与历史记忆，不再由固定题库状态机强制控制。直接在Dify预览不会触发业务端报告，完整功能请使用TEN面试界面。
