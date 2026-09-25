import json
import unittest

from clinical_pm_completion_guard import DIMENSIONS, main


def action(name, **kwargs):
    value = {"action": name, "reply": "", "follow_up": False, "event": {}}
    value.update(kwargs)
    return json.dumps(value, ensure_ascii=False)


class ClinicalPMGuardTests(unittest.TestCase):
    def test_provider_reasoning_wrapper_is_ignored(self):
        output = main("准备好了", "<think>provider reasoning</think>" + action("consent_yes"), "{}")
        self.assertTrue(json.loads(output["state"])["started"])
        self.assertNotIn("provider reasoning", output["reply"])

    def start(self):
        output = main("你好", action("other"), "{}")
        self.assertIn("是否愿意开始", output["reply"])
        output = main("愿意", action("consent_yes"), output["state"])
        return output

    def event(self, number):
        return {
            "summary": f"候选人说明了临床项目事件 {number}。",
            "background": "多中心临床项目遇到交付约束。",
            "task": "负责项目计划和跨团队协调。",
            "action": "本人梳理风险并推动责任人完成行动项。",
            "decision": "根据时限、质量和患者安全影响排序。",
            "result": "行动项按节点关闭并完成复盘。",
            "constraints": "时间和资源有限。",
            "personal_contribution": "候选人负责协调、跟进和升级。",
            "quote": f"我亲自推动了项目事件 {number}。",
        }

    def test_report_is_not_generated_before_completion(self):
        output = self.start()
        output = main(
            "我想先看结果",
            action("result"),
            output["state"],
        )
        self.assertIn("完成核心问题", output["reply"])
        self.assertNotIn("# 临床PM AI面试报告", output["reply"])

    def test_follow_up_does_not_advance_question(self):
        output = self.start()
        output = main(
            "做过一个项目",
            action("answer", reply="请补充你本人具体做了什么？", follow_up=True),
            output["state"],
        )
        state = json.loads(output["state"])
        self.assertEqual(state["question"], 0)
        self.assertEqual(state["follow_ups"], 1)
        self.assertEqual(state["events"], [])

    def test_twenty_dimensions_are_reported_after_last_answer(self):
        output = self.start()
        state = output["state"]
        for index, (_, dimension, _) in enumerate(DIMENSIONS):
            output = main(
                f"事件回答 {index + 1}",
                action("answer", event=self.event(index + 1)),
                state,
            )
            state = output["state"]
            if index < len(DIMENSIONS) - 1:
                self.assertNotIn("# 临床PM AI面试报告", output["reply"])
        self.assertIn("# 临床PM AI面试报告", output["reply"])
        self.assertIn("## 四、五方面20维度总表", output["reply"])
        self.assertEqual(json.loads(state)["completed"], True)
        self.assertEqual(output["reply"].count("| 动机能量 |"), 4)

    def test_skip_keeps_dimension_and_report_scope_explicit(self):
        output = self.start()
        output = main("跳过", action("skip"), output["state"])
        state = json.loads(output["state"])
        self.assertEqual(state["events"][0]["skipped"], True)
        self.assertEqual(state["question"], 1)
        self.assertIn("请讲一次", output["reply"])
        output = main("结束", action("end"), output["state"])
        self.assertIn("实际覆盖", output["reply"])
        self.assertIn("成功愿望", output["reply"])
        self.assertIn("本人跳过", output["reply"])

    def test_completed_session_does_not_return_to_questions(self):
        output = self.start()
        output = main("结束", action("end"), output["state"])
        self.assertIn("# 临床PM AI面试报告", output["reply"])
        output = main("继续", action("answer", event=self.event(99)), output["state"])
        self.assertIn("访谈已结束", output["reply"])
        self.assertNotIn("请讲一次", output["reply"])

    def test_explicit_end_text_finishes_even_if_model_misclassifies(self):
        output = self.start()
        output = main("请结束", action("other"), output["state"])
        self.assertIn("# 临床PM AI面试报告", output["reply"])
        self.assertTrue(json.loads(output["state"])["completed"])


if __name__ == "__main__":
    unittest.main()
