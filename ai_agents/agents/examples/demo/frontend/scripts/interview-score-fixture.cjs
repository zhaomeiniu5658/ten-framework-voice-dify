const reference = require('../src/lib/interview/reference.json');
function scoreReport({ name = '评分验收', citation = 'T2', score = '7.4' } = {}) {
  const areas = [...new Set(reference.dimensions.map(d => d.area))];
  return `# CRA面试评估报告
## 前言
本报告分析本次访谈。
### 个性特征维度表
|方面|维度|维度描述|
|---|---|---|
${reference.dimensions.map(d => `|${d.area}|${d.name}|${d.description}|`).join('\n')}
## 阅读原则
采用1—10分访谈行为倾向评分。
## 总体结果
|方面|维度|访谈评分|回答索引|
|---|---|---|---|
${reference.dimensions.map((d, i) => `|${d.area}|${d.name}|${i === 0 ? score : '未评分'}|${i === 0 ? `[${citation}]` : '—'}|`).join('\n')}
## 综合评价：重视目标的实践者
### 典型特征
${name}主动设置工作目标。[${citation}]
### 优势发挥
- 关注目标推进。[${citation}]
### 可能的盲点
- 目标过多时需要安排优先级。[${citation}]
## 详细结果
${areas.map(area => `### ${area}方面
工作行为说明。
|维度|低分特征|访谈评分|高分特征|
|---|---|---|---|
${reference.dimensions.filter(d => d.area === area).map(d => `|${d.name}|较偏低分端|${d.name === reference.dimensions[0].name ? score : '未评分'}|较偏高分端|`).join('\n')}
根据本次回答综合解读。[${citation}]`).join('\n')}
## 附录
### 测评者信息
姓名：${name}
### 测评过程信息
作答起止时间：本次访谈记录
### 使用声明
个人资料请注意保密。`;
}
module.exports = { scoreReport };
