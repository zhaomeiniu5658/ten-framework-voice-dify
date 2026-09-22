"""Dify code node: advance interview state, score answers, and build a report."""

import json
import re


QUESTIONS = [
    "忙完一天，想找人聊还是独处？",
    "学做新菜，先看做法还是弄懂原理？",
    "朋友闹矛盾，先讲道理还是安慰？",
    "出门旅行，提前安排还是随兴逛？",
    "有个新想法，边聊边想还是先想好？",
    "看部电影，更记得细节还是寓意？",
    "朋友诉苦，先帮分析还是听他倾诉？",
    "周末有空，按计划过还是看心情？",
    "参加聚会，认识新朋友还是聊老友？",
    "做顿晚饭，用拿手做法还是试新招？",
    "分任务，先看统一规则还是个人情况？",
    "行程变了，重做计划还是随时应变？",
]
CLOSED_REPLY = "谢谢您的配合，本次面试结束。"
INSUFFICIENT_RESULT = "信息不足，暂不能判断类型。"


def is_restart(query):
    text = re.sub(r"[\s，。！？,.!?]", "", query)
    return bool(
        re.fullmatch(
            r"(?:请|我想|我要|帮我|请帮我)?"
            r"(?:重新测试|重新开始|重新测一遍|重新做一次测试|"
            r"重测|再测一次|再测一遍|再来一轮)(?:吧|一下)?",
            text,
        )
    )


def score(answers):
    letters = []
    for offset, pair in enumerate(("EI", "SN", "TF", "JP")):
        votes = [answers[i] for i in range(offset, 12, 4)]
        first, second = votes.count("A"), votes.count("B")
        letters.append(
            pair[0 if first > second else 1]
            if first + second >= 2 and first != second
            else "X"
        )
    return "".join(letters)


DIMENSIONS = [
    ("精力来源", "EI", "外向", "内向"),
    ("信息获取", "SN", "实感", "直觉"),
    ("决策方式", "TF", "思考", "情感"),
    ("生活方式", "JP", "判断", "知觉"),
]
PREFERENCES = {
    "E": (
        "倾向在交流和互动中整理想法、恢复精力",
        "讨论前留一点独立思考时间，给他人表达空间",
    ),
    "I": (
        "倾向通过独处整理想法，偏好较深入的交流",
        "需要协作时主动表达想法，也为自己保留安静时间",
    ),
    "S": (
        "倾向关注具体事实、细节与已有经验",
        "保留熟悉方法的同时，尝试一种新的可能",
    ),
    "N": (
        "倾向关注事物联系、背后含义与新的可能",
        "把新想法落实为一个可验证的小步骤",
    ),
    "T": (
        "倾向先比较逻辑、原则和方案是否合理",
        "讨论方案时，也确认相关人员的感受与需要",
    ),
    "F": (
        "倾向考虑个人价值、他人感受与关系影响",
        "关照他人的同时，明确自己的边界和判断标准",
    ),
    "J": (
        "倾向提前安排，希望事情有较明确的计划",
        "为计划留出缓冲，允许信息变化后调整安排",
    ),
    "P": (
        "倾向保留选择空间，根据情况灵活调整",
        "为重要事项设定一个明确的截止时间",
    ),
}


def build_report(kind, answers=None):
    has_answers = answers is not None and len(answers) == 12
    valid = sum(value in ("A", "B") for value in answers) if has_answers else 0
    lines = [
        "MBTI 性格偏好报告",
        "12题生活情境访谈 · 个人参考版",
        "",
        "一、类型概览",
        f"初步倾向：{kind}",
    ]
    labels = [
        left if letter == pair[0] else right if letter == pair[1] else "未定"
        for letter, (_, pair, left, right) in zip(kind, DIMENSIONS)
    ]
    lines.append(" · ".join(labels))
    if has_answers:
        lines.append(
            f"作答情况：12题中{valid}题表达了明确偏好，{12 - valid}题未定或跳过。"
        )
    else:
        lines.append("作答情况：仅保留历史类型，缺少逐题记录，无法回溯计分。")
    if "X" in kind:
        lines.append("X表示该维度信息不足或两侧持平，暂不确定完整类型。")
    lines.extend(["", "二、四维倾向与回答依据"])
    for offset, (letter, (label, pair, left, right)) in enumerate(
        zip(kind, DIMENSIONS)
    ):
        preference = (
            left
            if letter == pair[0]
            else right if letter == pair[1] else "尚不确定"
        )
        lines.append(
            f"{label}｜{pair[0]} {left} / {pair[1]} {right}：{preference}"
        )
        if has_answers:
            votes = answers[offset::4]
            first, second = votes.count("A"), votes.count("B")
            unknown = 3 - first - second
            lines.append(
                f"回答分布：{pair[0]} {first}题，{pair[1]} {second}题，未定{unknown}题。"
            )
            if letter == "X":
                lines.append("两侧持平或有效回答不足，暂不作倾向判断。")
            elif max(first, second) == 3:
                lines.append("这三道题的选择方向一致。")
            elif unknown:
                lines.append("已作答题方向一致，另有一题未定。")
            else:
                lines.append("有效回答略偏向一侧，仍可能因情境不同而变化。")
        if letter in PREFERENCES:
            lines.append(PREFERENCES[letter][0] + "。")
    lines.extend(["", "三、日常相处与行动建议"])
    for letter in kind:
        if letter in PREFERENCES:
            lines.append("• " + PREFERENCES[letter][1] + "。")
    if kind == "XXXX":
        lines.append("目前信息不足。可回想最近的真实经历，再判断更自然的选择。")
    else:
        lines.append("可先选一条尝试，观察它是否适合真实的自己。")
    lines.extend(
        [
            "",
            "四、如何理解这份结果",
            "题数反映本次回答分布，不是标准分、百分位或准确率。偏好没有优劣，也不等同于能力；不同情境下的表现可能不同。",
            "本报告依据12题访谈生成，并非官方MBTI量表或标准化测评，不用于心理诊断或招聘筛选。请结合长期体验理解结果。",
            "",
            CLOSED_REPLY,
        ]
    )
    return "\n".join(lines)


def result_text(answer):
    """Recognize reports from older completed conversations during migration."""
    match = re.search(r"初步倾向[：:\s]*([EIX][SNX][TFX][JPX])", answer)
    if match:
        return build_report(match[1])
    if INSUFFICIENT_RESULT in answer:
        return build_report("XXXX")
    return ""


def parse_action(answer):
    try:
        text = answer.strip()
        if text.startswith("```"):
            text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text)
        value = json.loads(text)
        return value if isinstance(value, dict) else {}
    except (ValueError, TypeError):
        return {}


def main(query: str, answer: str, state: str) -> dict:
    current = json.loads(state or "{}")
    completed = current.get("completed", False)
    result = current.get("result", "")
    question = current.get("question", 0)
    answers = current.get("answers", [None] * 12)
    clarified = current.get("clarified", False)
    action = parse_action(answer)
    intent, choice = action.get("action"), action.get("choice")
    reply = ""

    if is_restart(query):
        completed, result, question = False, "", 1
        answers, clarified = [None] * 12, False
        reply = QUESTIONS[0]
    elif intent == "correct" and choice in ("A", "B", "X"):
        target = action.get("question")
        if (
            isinstance(target, int)
            and 1 <= target <= 12
            and answers[target - 1] is not None
        ):
            answers[target - 1] = choice
            if completed:
                result = reply = build_report(score(answers), answers)
            else:
                reply = QUESTIONS[max(question - 1, 0)]
        else:
            reply = "请说明要更正哪一题的答案。"
    elif completed:
        if intent == "explain":
            reply = action.get("reply", "").strip()
            if re.search(
                r"重复提问|继续出题|不再出题|本轮.*结束|重置|内部流程", reply
            ):
                reply = CLOSED_REPLY
            elif (
                not reply
                or len(reply) > 20
                or re.search(r"[?？]|还是|任选|请选择|第\s*\d+\s*题", reply)
            ):
                reply = "结果反映日常偏好，仅供参考。"
        elif intent == "result" or re.search(
            r"报告|结果|类型|倾向|什么型", query
        ):
            match = re.search(r"初步倾向[：:\s]*([EIX][SNX][TFX][JPX])", result)
            if match:
                recorded = (
                    answers
                    if all(value is not None for value in answers)
                    else None
                )
                result = build_report(
                    score(answers) if recorded else match[1], recorded
                )
            reply = result or CLOSED_REPLY
        else:
            reply = CLOSED_REPLY
    elif question == 0:
        if intent == "pause":
            reply = "好的，准备好了告诉我。"
        else:
            question = 1
            reply = QUESTIONS[0]
    elif (
        (intent == "answer" and choice in ("A", "B"))
        or intent == "skip"
        or (intent == "uncertain" and clarified)
    ):
        answers[question - 1] = choice if intent == "answer" else "X"
        clarified = False
        if question == 12:
            completed = True
            result = reply = build_report(score(answers), answers)
        else:
            question += 1
            reply = QUESTIONS[question - 1]
    elif intent == "uncertain":
        clarified = True
        reply = "平时更像哪一种？也可跳过。"
    elif intent in ("clarify", "explain"):
        reply = action.get("reply", "").strip()
        if not reply or len(reply) > 20:
            reply = "按平时习惯，选更接近的一项。"
    elif intent == "result":
        reply = f"暂定倾向{score(answers)}，尚未答完。"
    elif intent == "pause":
        reply = "好的，准备好了告诉我。"
    else:
        reply = QUESTIONS[question - 1]

    return {
        "reply": reply,
        "state": json.dumps(
            {
                "completed": completed,
                "result": result,
                "question": question,
                "question_text": QUESTIONS[question - 1] if question else "",
                "answers": answers,
                "clarified": clarified,
            },
            ensure_ascii=False,
        ),
    }
