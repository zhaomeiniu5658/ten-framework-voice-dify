import itertools
import json
import unittest

from mbti_completion_guard import QUESTIONS, build_report, main, score


def classify(action, choice="X", reply="", question=0):
    return json.dumps(
        {
            "action": action,
            "choice": choice,
            "reply": reply,
            "question": question,
        }
    )


class CompletionGuardTests(unittest.TestCase):
    def begin(self):
        return main("你好", classify("other"), "{}")

    def finish(self):
        output = self.begin()
        for index in range(12):
            output = main("后者", classify("answer", "B"), output["state"])
            if index < 11:
                self.assertEqual(output["reply"], QUESTIONS[index + 1])
        return output

    def test_finishing_emits_report_and_persists_completion(self):
        output = self.finish()
        self.assertEqual(output["reply"], build_report("INFP", ["B"] * 12))
        self.assertTrue(json.loads(output["state"])["completed"])

    def test_finished_interview_cannot_fall_back_to_questions(self):
        output = self.finish()
        for query in ("扔掉它", "继续", "你好", "好", "不要重新测试"):
            with self.subTest(query=query):
                output = main(query, classify("answer", "A"), output["state"])
                self.assertNotIn("？", output["reply"])
                self.assertTrue(json.loads(output["state"])["completed"])

    def test_explicit_restart_resets_answers_and_question(self):
        output = main("请重新测试。", classify("other"), self.finish()["state"])
        self.assertEqual(output["reply"], QUESTIONS[0])
        state = json.loads(output["state"])
        self.assertFalse(state["completed"])
        self.assertEqual(state["answers"], [None] * 12)
        output = main("独处", classify("answer", "B"), output["state"])
        self.assertEqual(output["reply"], QUESTIONS[1])

    def test_report_recall_and_explanation_keep_completion(self):
        state = self.finish()["state"]
        output = main("看看结果", classify("result"), state)
        self.assertEqual(output["reply"], build_report("INFP", ["B"] * 12))
        output = main(
            "解释一下", classify("explain", reply=QUESTIONS[-1]), state
        )
        self.assertNotIn("？", output["reply"])
        output = main(
            "解释内向",
            classify("explain", reply="您更倾向独处恢复精力。"),
            state,
        )
        self.assertEqual(output["reply"], "您更倾向独处恢复精力。")

    def test_provisional_result_does_not_finish(self):
        output = main("先看看结果", classify("result"), self.begin()["state"])
        self.assertIn("暂定倾向XXXX", output["reply"])
        self.assertFalse(json.loads(output["state"])["completed"])

    def test_ambiguity_clarification_and_skip_advance_once(self):
        output = main("都可以", classify("uncertain"), self.begin()["state"])
        self.assertEqual(json.loads(output["state"])["question"], 1)
        output = main(
            "什么意思",
            classify("clarify", reply="哪种方式更让您放松。"),
            output["state"],
        )
        self.assertEqual(json.loads(output["state"])["question"], 1)
        output = main("还是不确定", classify("uncertain"), output["state"])
        self.assertEqual(output["reply"], QUESTIONS[1])
        self.assertEqual(json.loads(output["state"])["answers"][0], "X")
        output = main("跳过", classify("skip"), output["state"])
        self.assertEqual(output["reply"], QUESTIONS[2])

    def test_all_skipped_answers_produce_unknown_report(self):
        output = self.begin()
        for _ in range(12):
            output = main("跳过", classify("skip"), output["state"])
        self.assertEqual(output["reply"].count("尚不确定"), 4)
        self.assertTrue(json.loads(output["state"])["completed"])

    def test_scoring_all_types_ties_and_insufficient_evidence(self):
        for choices in itertools.product("AB", repeat=4):
            answers = list(choices) * 3
            expected = "".join(
                pair[choice == "B"]
                for pair, choice in zip(("EI", "SN", "TF", "JP"), choices)
            )
            self.assertEqual(score(answers), expected)
        self.assertEqual(score(["A"] * 4 + ["B"] * 4 + ["X"] * 4), "XXXX")
        self.assertEqual(score(["A"] * 4 + [None] * 8), "XXXX")

    def test_malformed_model_output_does_not_advance(self):
        state = self.begin()["state"]
        output = main("独处", "not json", state)
        self.assertEqual(output["reply"], QUESTIONS[0])
        self.assertEqual(json.loads(output["state"])["answers"], [None] * 12)

    def test_corrections_update_score_without_restarting(self):
        state = self.finish()["state"]
        for target in (4, 8):
            output = main(
                "更正", classify("correct", "A", question=target), state
            )
            state = output["state"]
        self.assertEqual(
            output["reply"],
            build_report("INFJ", ["B", "B", "B", "A"] * 2 + ["B"] * 4),
        )
        self.assertTrue(json.loads(state)["completed"])

    def test_short_questions_and_waiting_to_start(self):
        self.assertTrue(all(len(question) <= 20 for question in QUESTIONS))
        output = main("没准备好", classify("pause"), "{}")
        self.assertEqual(json.loads(output["state"])["question"], 0)
        output = main("好了", classify("other"), output["state"])
        self.assertEqual(output["reply"], QUESTIONS[0])

    def test_report_uses_actual_counts_and_discloses_limits(self):
        answers = ["B"] * 12
        answers[0], answers[4] = "A", "X"
        report = build_report(score(answers), answers)
        self.assertIn("初步倾向：XNFP", report)
        self.assertIn("E 1题，I 1题，未定1题", report)
        self.assertIn("12题中11题表达了明确偏好", report)
        self.assertIn("并非官方MBTI量表或标准化测评", report)
        self.assertIn("三、日常相处与行动建议", report)
        self.assertNotIn("倾向通过独处", report)

    def test_legacy_report_does_not_invent_answer_counts(self):
        state = json.dumps(
            {"completed": True, "result": "初步倾向INTJ，仅供参考。"}
        )
        output = main("查看报告", classify("result"), state)
        self.assertIn("缺少逐题记录", output["reply"])
        self.assertNotIn("回答分布：", output["reply"])
        self.assertIn("初步倾向：INTJ", output["reply"])


if __name__ == "__main__":
    unittest.main()
