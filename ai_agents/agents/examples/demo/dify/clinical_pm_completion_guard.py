"""Dify code node for the clinical PM structured interview.

The node owns interview progress and report timing. The model classifies only the
current answer; this module records evidence and builds one Markdown report when
the interview is complete or the candidate explicitly ends it.
"""

import json
import re
from typing import Any


DIMENSIONS = [
    ("动机能量", "成功愿望", "请讲一次你需要确定工作目标的经历，你最后把目标定在什么程度？"),
    ("动机能量", "权力动机", "请讲一次你选择承担组织协调责任，或专注个人任务的经历，你如何选择？"),
    ("动机能量", "亲和动机", "请讲一次你加入新团队后，决定如何与成员建立工作关系的经历。"),
    ("动机能量", "活力", "请选一个任务特别集中的工作周，讲讲你如何安排投入和恢复。"),
    ("思维决策", "创新意识", "请讲一次你在沿用原方法和尝试新方法之间作选择的经历。"),
    ("思维决策", "洞察力", "请讲一次问题表面现象与后来查明原因不同的经历。"),
    ("思维决策", "决断的", "请讲一次信息不完整但必须在期限内作决定的经历。"),
    ("思维决策", "理性的", "请讲一次你的初步判断与后来资料不一致的经历。"),
    ("情感成熟度", "乐观的", "请讲一次项目受挫、结果不确定的经历，你怎样看待接下来可能发生的事？"),
    ("情感成熟度", "抗压性", "请讲一次工作要求明显超过平时的经历，对你的工作造成了什么影响？"),
    ("情感成熟度", "情绪稳定性", "请选一次收到负面反馈或发生工作分歧的经历，说说你的反应和后续处理。"),
    ("情感成熟度", "适应性", "请讲一次原来有效的做法在新团队、客户或规则下不再适用的经历。"),
    ("人际互动", "社交自信", "请讲一次面对不熟悉的人，或需要在正式会议中表达意见的经历。"),
    ("人际互动", "影响的", "请讲一次对方最初不赞同，而你需要推动共同工作的经历。"),
    ("人际互动", "同理心", "请讲一次你发现自己起初没有准确理解合作方需求的经历。"),
    ("人际互动", "支持性", "请讲一次同事遇到困难，你需要决定是否以及如何提供帮助的经历。"),
    ("任务执行", "责任感", "请讲一次交付出现问题、责任归属又不完全清楚的经历，你做了什么？"),
    ("任务执行", "审慎的", "请讲一次你必须在按时推进和进一步检查风险之间作取舍的经历。"),
    ("任务执行", "条理性", "请讲一次多项任务、多个节点同时推进的经历，你用什么办法管理？"),
    ("任务执行", "意志力", "请讲一次目标推进中连续遇到障碍，你决定继续、调整还是停止的经历。"),
]

AREA_DESCRIPTIONS = {
    "动机能量": "推动并维持工作投入的目标、关系和精力安排方式。",
    "思维决策": "分析问题、处理证据和做出决定时表现出的行为方式。",
    "情感成熟度": "面对压力、反馈和环境变化时的工作应对方式。",
    "人际互动": "与团队、研究中心、供应商及跨职能伙伴协作时的行为方式。",
    "任务执行": "管理计划、风险、责任和交付时的行为方式。",
}
OPENING = (
    "接下来我会围绕真实工作经历，了解你的目标设定、分析决策、压力应对、合作与执行方式。"
    "这不是心理诊断或正式人格测验，也没有标准人设答案。内容用于形成结构化访谈报告。"
    "请避免透露患者、客户及同事身份或商业秘密；不方便回答可以跳过，也可以随时暂停。是否愿意开始？"
)
CLOSED = "谢谢你的配合，本次访谈已结束。报告已生成，请查看详细 Markdown 结果。"


def _clean(value: Any, limit: int = 800) -> str:
    text = re.sub(r"\s+", " ", str(value or "")).strip()
    return text[:limit]


def _parse(value: str) -> dict:
    try:
        text = value.strip()
        # Reasoning-capable providers may wrap the JSON in a think block even
        # when the prompt asks for JSON only. Strip that wrapper before parsing.
        text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL | re.IGNORECASE)
        if text.startswith("```"):
            text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text)
        text = text.strip()
        result = json.loads(text)
        return result if isinstance(result, dict) else {}
    except (TypeError, ValueError):
        return {}


def _initial_state() -> dict:
    return {
        "version": 1,
        "candidate": "林予安（演示候选人）",
        "role": "临床项目经理（Clinical Project Manager）",
        "started": False,
        "completed": False,
        "question": 0,
        "follow_ups": 0,
        "events": [],
        "coverage": {},
        "report": "",
    }


def _question(index: int) -> str:
    return DIMENSIONS[index][2] if 0 <= index < len(DIMENSIONS) else ""


def _is_end_query(query: str) -> bool:
    text = re.sub(r"[\s，。！？,.!?]", "", query or "")
    return bool(re.fullmatch(r"(?:我想|请|现在)?(?:结束|停止|先到这里|不聊了|退出)(?:吧|一下)?", text))


def _is_consent_query(query: str) -> bool:
    text = re.sub(r"[\s，。！？,.!?]", "", query or "")
    return bool(
        re.search(
            r"(?:准备好了|准备好啦|可以开始|愿意开始|同意开始|开始吧|可以了|好的开始)",
            text,
        )
    )


def _record_event(state: dict, action: dict, question_index: int, skipped=False):
    area, dimension, _ = DIMENSIONS[question_index]
    event_id = f"E{len(state['events']) + 1:02d}"
    event = action.get("event") if isinstance(action.get("event"), dict) else {}
    if skipped:
        event = {"summary": "候选人跳过，本题未获得资料。"}
    summary = _clean(event.get("summary"))
    if not summary and not skipped:
        summary = _clean(action.get("reply")) or "本轮回答未形成可核验摘要。"
    state["events"].append(
        {
            "event_id": event_id,
            "question_id": f"Q{question_index + 1:02d}",
            "area": area,
            "dimension": dimension,
            "background": _clean(event.get("background")),
            "task": _clean(event.get("task")),
            "action": _clean(event.get("action")),
            "decision": _clean(event.get("decision")),
            "result": _clean(event.get("result")),
            "constraints": _clean(event.get("constraints")),
            "personal_contribution": _clean(event.get("personal_contribution")),
            "quote": _clean(event.get("quote"), 240),
            "summary": summary,
            "skipped": skipped,
        }
    )
    state["coverage"][dimension] = {
        "status": "本人跳过" if skipped else "已问",
        "event_id": event_id,
        "question_id": f"Q{question_index + 1:02d}",
        "follow_ups": state.get("follow_ups", 0),
    }


def _adequacy(events: list[dict]) -> str:
    if not events or all(event.get("skipped") for event in events):
        return "不足"
    complete = sum(
        bool(event.get("action")) and bool(event.get("result")) for event in events
    )
    if complete >= 2:
        return "较充分"
    if complete == 1 or any(event.get("action") for event in events):
        return "中等"
    return "有限"


def _report(state: dict) -> str:
    events = state.get("events", [])
    completed_count = len(events)
    covered = {event["dimension"] for event in events}
    lines = [
        "# 临床PM AI面试报告",
        "> 访谈版式参考北森管理个性 V2 的“五方面/20维度”结构；本报告是基于简历线索与行为访谈的定性记录，不是北森正式测评，不含标准分、常模百分位或录用结论。",
        "",
        "## 一、候选人和访谈范围",
        "| 项目 | 内容 |",
        "| --- | --- |",
        f"| 候选人 | {state.get('candidate', '未填写')} |",
        f"| 目标岗位 | {state.get('role', '临床项目经理')} |",
        "| 访谈日期 | 未由系统可靠记录 |",
        "| 资料来源 | 内置演示简历、候选人本轮回答 |",
        f"| 实际覆盖 | 已记录 {completed_count} 个事件，覆盖 {len(covered)}/20 个维度 |",
        f"| 未覆盖 | {', '.join(d for _, d, _ in DIMENSIONS if d not in covered) or '无'} |",
        "",
        "## 二、方法与限制",
        "本次采用半结构化行为访谈。每个维度至少安排一次提问机会，报告只记录候选人明确提供的工作行为。简历是待核验线索，不能替代本人陈述；自述、机会差异、记忆和表达方式都会影响资料完整度。没有资料的维度保留为空，不推断为能力不足。",
        "",
        "## 三、综合评价（行为证据摘要）",
    ]
    if events:
        for event in events:
            if event.get("skipped"):
                continue
            lines.append(
                f"- **{event['dimension']}（{event['event_id']}）**：{event['summary']}"
            )
    else:
        lines.append("- 尚未获得可分析的访谈事件。")
    lines.extend(
        [
            "",
            "### 可能的优势行为模式",
            "基于已记录事件整理；只有在事件中出现的行为才列入。",
            "",
            "### 需要进一步核验的风险或边界",
            "本节描述资料缺口、情境边界或矛盾，不等同于负面评价。",
            "",
            "## 四、五方面20维度总表",
            "| 方面 | 维度 | 覆盖状态 | 证据充分度 | 主要行为摘要 | 事件/题号 | 反例与限制 | 核验状态 |",
            "| --- | --- | --- | --- | --- | --- | --- | --- |",
        ]
    )
    for area, dimension, _ in DIMENSIONS:
        matches = [event for event in events if event["dimension"] == dimension]
        coverage = state.get("coverage", {}).get(dimension, {})
        summary = "；".join(event["summary"] for event in matches if event["summary"]) or "未获得资料"
        ids = ", ".join(event["event_id"] for event in matches) or "—"
        status = coverage.get("status", "未问")
        limitation = "候选人跳过" if status == "本人跳过" else "仅本人自述，需结合第二个情境核验"
        verify = "仅本人自述" if matches and status != "本人跳过" else "无资料"
        lines.append(
            f"| {area} | {dimension} | {status} | {_adequacy(matches)} | {summary} | {ids} | {limitation} | {verify} |"
        )
    lines.extend(["", "## 五、20维度逐项说明"])
    for area, dimension, question in DIMENSIONS:
        matches = [event for event in events if event["dimension"] == dimension]
        lines.extend([f"### {dimension}", f"- **所属方面**：{area}", f"- **主问**：{question}"])
        if not matches:
            lines.append("- **资料状态**：未问，未获得资料。")
            continue
        for event in matches:
            lines.append(f"- **{event['event_id']} / {event['question_id']}**：{event['summary']}")
            if event.get("quote"):
                lines.append(f"- **原话摘录**：\"{event['quote']}\"")
            details = [
                ("背景", event.get("background")),
                ("本人任务", event.get("task")),
                ("具体行动", event.get("action")),
                ("判断依据", event.get("decision")),
                ("结果", event.get("result")),
                ("约束", event.get("constraints")),
                ("个人贡献", event.get("personal_contribution")),
            ]
            for label, value in details:
                if value:
                    lines.append(f"- **{label}**：{value}")
        lines.append("- **不能推出的结论**：单个自述事件不能代表所有情境，也不能转换为人格分数或录用建议。")
    lines.extend(
        [
            "",
            "## 六、与内置简历线索的对照",
            "内置简历中的项目、职责和工作年限均为演示线索。只有候选人在访谈中明确确认并提供行为细节的内容，才可作为访谈证据；其余标记为待核验。",
            "",
            "## 七、后续验证计划",
            "- 补充尚未覆盖的维度，优先询问第二个不同情境和反例。",
            "- 在获得授权和脱敏后，可核对项目计划、问题清单、里程碑复盘或第三方反馈。",
            "- 如需正式人格测评，应交由合适的标准化工具和专业流程完成，不用本报告替代。",
            "",
            "## 八、证据附录",
            "以下仅列出本轮记录的事件索引和候选人原话摘录，不包含隐藏推理。",
        ]
    )
    for event in events:
        quote = f"；原话：{event['quote']}" if event.get("quote") else ""
        lines.append(f"- **{event['event_id']} / {event['question_id']} / {event['dimension']}**：{event['summary']}{quote}")
    lines.extend(["", "---", "本报告仅用于结构化面试记录和后续核验，不用于自动化人才决策。"])
    return "\n".join(lines)


def main(query: str, answer: str, state: str) -> dict:
    current = _initial_state()
    try:
        loaded = json.loads(state or "{}")
        if isinstance(loaded, dict):
            current.update(loaded)
    except (TypeError, ValueError):
        pass
    action = _parse(answer)
    intent = action.get("action")
    if not current.get("started") and _is_consent_query(query):
        intent = "consent_yes"
    if current.get("started") and _is_end_query(query):
        intent = "end"
    if current.get("completed"):
        if intent == "result" or re.search(r"报告|结果|复盘", query or ""):
            return {"reply": current.get("report") or _report(current), "state": json.dumps(current, ensure_ascii=False)}
        return {"reply": CLOSED, "state": json.dumps(current, ensure_ascii=False)}
    if not current.get("started"):
        if intent == "consent_yes":
            current["started"] = True
            current["question"] = 0
            reply = "谢谢。先从目标设定开始：" + _question(0)
        elif intent == "pause":
            reply = "好的，准备好后告诉我即可。"
        else:
            reply = OPENING
        return {"reply": reply, "state": json.dumps(current, ensure_ascii=False)}
    question_index = int(current.get("question", 0))
    if intent == "result":
        reply = "目前仍在访谈，完成核心问题或明确结束后再生成报告。"
    elif intent == "pause":
        reply = "好的，我们先暂停；准备继续时告诉我。"
    elif intent == "end":
        current["completed"] = True
        current["report"] = _report(current)
        reply = current["report"]
    elif intent == "clarify":
        reply = _clean(action.get("reply")) or "请讲一个你亲自参与的具体项目或事件。"
    elif intent == "skip":
        _record_event(current, action, question_index, skipped=True)
        current["follow_ups"] = 0
        current["question"] = question_index + 1
        if current["question"] >= len(DIMENSIONS):
            current["completed"] = True
            current["report"] = _report(current)
            reply = current["report"]
        else:
            reply = _question(current["question"])
    elif intent == "answer":
        if action.get("follow_up") and current.get("follow_ups", 0) < 2:
            current["follow_ups"] = current.get("follow_ups", 0) + 1
            reply = _clean(action.get("reply")) or "请补充你本人具体做了什么，以及最后结果如何。"
        else:
            _record_event(current, action, question_index)
            current["follow_ups"] = 0
            current["question"] = question_index + 1
            if current["question"] >= len(DIMENSIONS):
                current["completed"] = True
                current["report"] = _report(current)
                reply = current["report"]
            else:
                reply = _question(current["question"])
    else:
        reply = _question(question_index)
    return {"reply": reply, "state": json.dumps(current, ensure_ascii=False)}
