import type { CSSProperties, ReactNode } from "react";
import { parsePersonalityReport, personalityCards } from "../../lib/interview/personality-layout";
import "./PersonalityReport.css";

type Props = { text: string; candidateName?: string; createdAt?: string; renderMarkdown: (text: string) => ReactNode };
export function PersonalityReport({ text, candidateName, createdAt, renderMarkdown }: Props) {
  const report = parsePersonalityReport(text);
  const narrative = (value: string) => renderMarkdown(value || "本次访谈资料不足，暂不判断。");
  const heading = (index: number, title: string) => <h2 className="personality-section-heading"><span>{index}</span>{title}</h2>;
  const cards = (value: string, variant: "strength" | "blind") => <div className={`personality-cards ${variant}`}>
    {personalityCards(value).length ? personalityCards(value).map((item, i) => <div className="personality-card" key={i}><span className="personality-card-icon" aria-hidden="true">{variant === "strength" ? "✓" : "!"}</span><div><h4>{item.title}</h4>{narrative(item.text)}</div></div>) : <p>本次访谈资料不足，暂不判断。</p>}
  </div>;
  return <article className="interview-paper-report personality-profile" aria-label="性格测试报告">
    <div className="personality-document">
      <header className="personality-masthead"><span>性格测试报告</span><span>{candidateName || "未提供姓名"}{createdAt ? ` · ${new Date(createdAt).toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" })}` : ""}</span></header>
      <section className="personality-intro">
        <p className="personality-eyebrow">本次访谈呈现的性格倾向</p>
        <h1>{report.name}</h1>
        <p className="personality-type">{report.code || "类型待确认"}</p>
        <p className="personality-qualification">访谈倾向 · 非标准化测评结果</p>
      </section>
      <div className="personality-summary">{narrative(report.summary)}</div>
      <section className="personality-section">
        {heading(1, "人格特征")}
        <p className="personality-caption">色条仅示意偏好方向，不代表测评分数或百分比。</p>
        <div className="personality-traits">{report.traits.map(trait => <div className="personality-trait" key={trait.name} style={{ "--trait-color": trait.color } as CSSProperties}>
          <div className="personality-trait-track" data-direction={trait.direction} aria-label={`${trait.name}：${trait.preference}`}>
            {trait.direction !== "unknown" && <span className="personality-trait-marker" />}
          </div>
          <div className="personality-trait-poles"><span>{trait.left}</span><span>{trait.right}</span></div>
          <h3>{trait.name}：<em>{trait.preference}</em></h3>
          {narrative(trait.interpretation)}<div className="personality-evidence">{narrative(trait.evidence)}</div>
        </div>)}</div>
        <p className="personality-scope-note">本次场景题覆盖四组偏好；未评估身份特征（A/T），不生成该维度结论。</p>
      </section>
      <section className="personality-section">
        {heading(2, "你的职业道路")}
        {narrative(report.career)}
        <h3 className="personality-subheading">你的强项</h3>{cards(report.strengths, "strength")}
        <h3 className="personality-subheading">你的短板</h3>{cards(report.blindSpots, "blind")}
      </section>
      <section className="personality-section">{heading(3, "你的个人成长")}{narrative(report.growth)}</section>
      <section className="personality-section">{heading(4, "你的人际关系")}{narrative(report.relationships)}</section>
      {report.extra.map(section => <section className="personality-section" key={section.title}><h2 className="personality-subheading">{section.title}</h2>{narrative(section.text)}</section>)}
      <section className="personality-boundaries"><h2>本次访谈的证据与边界</h2>{narrative(report.boundaries)}</section>
      <footer className="personality-footer">基于本次访谈 · 供自我了解与沟通参考</footer>
    </div>
  </article>;
}
