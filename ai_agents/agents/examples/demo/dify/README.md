# 临床 PM AI 面试 Chatflow

本目录提供可复制到 Dify 的临床项目经理结构化面试配置；节点配置汇总在 `clinical_pm_workflow_patch.json`。面试围绕北森管理个性 V2 的五方面、20 个维度收集真实工作行为证据；北森 PDF 只用于参考章节组织，不复制其标准分、常模或录用结论。

内置简历是合成演示资料，位于 `clinical_pm_resume.md`。它只提供提问线索，候选人没有确认的内容必须在报告中标记为“待核验”。

## Dify 节点顺序

1. **开始节点**：新增会话变量 `clinical_pm_state`（string，初始值 `{}`）；简历内容已内置在系统提示词中，`clinical_pm_resume.md` 仅作为可选的资料说明。
2. **LLM 节点**：使用 `clinical-pm-system-prompt.txt`，用户输入模板使用 `clinical-pm-query-template.txt`；将旧的 `mbti_state` 引用全部替换为 `clinical_pm_state`。LLM 只返回一行 JSON，不输出报告。
3. **代码节点**：复制 `clinical_pm_completion_guard.py` 的代码，节点名建议设为 `clinical_pm_completion`；输入变量为 `query`、`answer`、`state`，分别映射到当前用户文本、LLM 原始输出和 `clinical_pm_state`。
4. **变量保存**：将代码节点的 `state` 写回会话变量 `clinical_pm_state`，不要继续写入旧的 `mbti_state`。
5. **回答节点**：输出代码节点的 `reply`。

代码节点在全部 20 个维度答完，或候选人明确说“结束/停止”时才生成 Markdown 报告。面试进行中索要结果只返回“完成访谈后再生成报告”，不会把报告放进流式回复，因此不会拖慢普通问答。

## 报告内容

报告以 Markdown 文本返回，包含：候选人和范围、方法与限制、综合行为证据摘要、五方面 20 维度总表、20 维度逐项说明、简历线索对照、后续验证计划和证据附录。没有资料的维度会保留并标记为“未问”或“本人跳过”。

报告正文不会输出隐藏推理、心理诊断、北森标准分、常模百分位、候选人排名或自动化录用建议。

## 语音适配

`va_dify_azure` 的报告识别已兼容 `# 临床PM AI面试报告`，完整 Markdown 只发送到文字区；语音只播放 `report_tts_summary` 的短提示。这样不会逐段播报表格和附录。

## 本地规则测试

```bash
python3 -m unittest discover -s ai_agents/agents/examples/demo/dify -p 'test_*clinical*.py' -v
```

测试覆盖：同意开场、追问不推进题号、未完成时不生成报告、20 维度完成后生成报告、跳过维度的范围披露，以及完成后不会重新出题。`clinical_pm_workflow_patch.json` 可用于逐项核对节点输入、输出和边。

## 当前 Dify 调试结论

已用本地 Chatflow API 做最小请求验证：`/v1/parameters` 可访问，但 `/v1/chat-messages` 返回 `invalid_param`，错误链显示 OpenAI-compatible 模型上游返回 HTTP 404。请在 Dify 的模型供应商设置中校正 Base URL（包含正确的 `/v1` 路径）、模型名和凭据，再测试本 Chatflow；这一步与本目录的状态机和 Markdown 报告逻辑无关。
