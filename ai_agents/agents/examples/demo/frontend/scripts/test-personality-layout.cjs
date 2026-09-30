const {test}=require('node:test');
const assert=require('node:assert/strict');
const ts=require('typescript');const fs=require('fs');const path=require('path');
const source=fs.readFileSync(path.join(__dirname,'../src/lib/interview/personality-layout.ts'),'utf8');
const moduleUnderTest={exports:{}};
new Function('module','exports',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(moduleUnderTest,moduleUnderTest.exports);
const {parsePersonalityReport:parse,personalityCards}=moduleUnderTest.exports;
test('incomplete evidence never invents a type or direction from the dimension labels',()=>{
 const r=parse('## 类型概览\n资料不足，不能认定ENFJ。\n## 四维偏好\n|维度|本次倾向|访谈证据|解读|\n|---|---|---|---|\n|外向/内向|资料不足|未回答|暂不判断|\n|计划/灵活|两者兼有|[T2]|取决于场景|');
 assert.equal(r.code,undefined);assert.ok(r.traits.every(t=>t.direction==='unknown'));
});
test('explicit current-session result and evidence map to qualitative bars',()=>{
 const r=parse('## 类型概览\n类型倾向：ISTJ\n画像名称：注重事实的规划者\n说明[T2]。\n## 四维偏好\n|维度|本次倾向|访谈证据|解读|\n|---|---|---|---|\n|外向/内向|偏内向|先思考[T2]|独立梳理|\n|具体/抽象|偏具体|细节[T4]|事实优先|\n|逻辑/情感|偏逻辑|效率[T6]|逻辑优先|\n|计划/灵活|偏计划|计划[T8]|安排节点|');
 assert.equal(r.code,'ISTJ');assert.equal(r.name,'注重事实的规划者');assert.deepEqual(r.traits.map(t=>t.direction),['right','right','left','left']);assert.match(r.traits[0].evidence,/T2/);
});
test('legacy content and unknown sections remain visible without truncating paragraphs',()=>{
 const r=parse('## 工作方式\n旧版工作方式[T2]\n## 其他观察\n保留这一段[T4]');
 assert.match(r.career,/旧版/);assert.equal(r.extra[0].text.trim(),'保留这一段[T4]');
 const paragraph='这是一个没有标题但是需要完整显示的很长的行为证据说明，不应丢失任何文字。';assert.equal(personalityCards(paragraph)[0].text,paragraph);
 assert.deepEqual(personalityCards('### 注重协作\n重视共识[T2]'),[{title:'注重协作',text:'重视共识[T2]'}]);
});

test('headline agrees with the four evidenced preferences instead of a contradictory model label',()=>{
 const r=parse('## 类型概览\n类型倾向：ENFP\n## 四维偏好\n|外向/内向|偏外向|[T2]|交流|\n|具体/抽象|偏抽象|[T4]|方向|\n|逻辑/情感|偏情感|[T6]|共识|\n|计划/灵活|偏计划|[T8]|计划|');
 assert.equal(r.code,'ENFJ');
});
