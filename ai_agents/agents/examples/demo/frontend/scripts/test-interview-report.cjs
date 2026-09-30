const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'interview-test-'));
process.env.INTERVIEW_REPORT_DIR = path.join(root, 'records');
process.env.INTERVIEW_ANALYSIS_API_KEY = 'test-placeholder';
const source = path.join(__dirname, '../src/lib/interview');
for (const file of ['session', 'report', 'store']) fs.writeFileSync(path.join(root, file + '.js'), ts.transpileModule(fs.readFileSync(path.join(source, file + '.ts'), 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2020, esModuleInterop:true}}).outputText);
fs.copyFileSync(path.join(source, 'reference.json'), path.join(root, 'reference.json'));
const store = require(path.join(root, 'store.js'));
const originalFetch = global.fetch;
after(() => {global.fetch = originalFetch; fs.rmSync(root, {recursive:true, force:true});});

test('interview stays idle until finish, preserves follow-ups and final answer; idempotent analysis and retry', async () => {
  let calls = 0;
  global.fetch = async (url, options) => {
    calls++;
    const payload = JSON.parse(options.body);
    const input = JSON.parse(payload.messages[1].content);
    assert.equal(input.resume, '本次临床项目经理简历');
    assert.equal(input.candidateName, '张敏');
    assert.ok(input.sessionId);
    assert.doesNotMatch(options.body, /林予安|北森|Faye Lian/);
    assert.equal(input.transcript.length, 4);
    assert.equal(input.transcript[3].text, '最终改善结果');
    assert.equal(input.transcript[3].evidenceId, 'T4');
    return {ok: true, json: async () => ({choices:[{finish_reason:'stop', message:{content:'# 临床PM AI面试分析报告\n\n## 总体结果\n测试'}}]})};
  };
  const id = await store.createInterview({ name: '张敏', resume: '本次临床项目经理简历' });
  await store.runAnalysis(id);
  assert.equal(calls, 0);
  const transcript = [{role:'assistant',text:'你做了什么？',time:1},{role:'user',text:'我调整了计划',time:2},{role:'assistant',text:'结果如何？',time:3},{role:'user',text:'最终改善结果',time:4}];
  await store.finishInterview(id, transcript);
  await Promise.all([store.runAnalysis(id), store.runAnalysis(id)]);
  assert.equal(calls, 1);
  assert.equal((await store.readInterview(id)).status, 'ready');
  await store.finishInterview(id, [{role:'user',text:'overwrite',time:5}]);
  assert.deepEqual((await store.readInterview(id)).transcript, transcript);
  assert.equal(await store.readInterview('../../etc/passwd'), null);
  const failedId = await store.createInterview();
  await store.finishInterview(failedId, transcript);
  global.fetch = async () => ({ok:false,status:503});
  await store.runAnalysis(failedId);
  assert.equal((await store.readInterview(failedId)).status, 'failed');
  await store.finishInterview(failedId, [], true);
  assert.equal((await store.readInterview(failedId)).transcript.length, 4);
});

test('history lists separate sessions without exposing transcripts and tolerates corrupt files', async () => {
  const first = await store.createInterview();
  const second = await store.createInterview();
  fs.writeFileSync(path.join(root, 'records', '00000000-0000-0000-0000-000000000000.json'), '{');
  const history = await store.listInterviews();
  assert.ok(history.some(r => r.id === first));
  assert.ok(history.some(r => r.id === second));
  assert.equal(history.find(r => r.id === second).candidateName, '未提供姓名');
  assert.ok(history.every(r => !('transcript' in r) && !('markdown' in r)));
  assert.deepEqual(history.map(r => r.createdAt), history.map(r => r.createdAt).sort().reverse());
});

test('empty, greeting-only and end-only interviews complete without analysis or report links', async () => {
  let calls = 0;
  global.fetch = async () => { calls++; throw new Error('must not analyze'); };
  for (const transcript of [[], [{role:'assistant',text:'请介绍自己',time:1}],
    [{role:'user',text:'结束面试',time:2}], [{role:'user',text:'你好',time:3}]]) {
    const id = await store.createInterview();
    await store.finishInterview(id, transcript);
    await store.runAnalysis(id);
    const value = await store.readInterview(id);
    assert.equal(value.status, 'completed');
    assert.ok(value.endedAt);
    assert.equal(store.publicReport(value).markdown, undefined);
    assert.equal((await store.listInterviews()).find(r=>r.id===id).hasReport, false);
    await store.finishInterview(id, [{role:'user',text:'不能用下一场回答覆盖',time:9}]);
    assert.deepEqual((await store.readInterview(id)).transcript, transcript);
  }
  assert.equal(calls, 0);
});

test('two candidates and concurrent finish requests keep immutable per-session evidence', async () => {
  const a = await store.createInterview({name:'张敏',resume:'张敏提供的简历'});
  const b = await store.createInterview();
  const ta = [{role:'assistant',text:'你是林予安吗？',time:1},{role:'user',text:'我叫张敏，我负责肿瘤项目。',time:2}];
  const tb = [{role:'user',text:'我叫李华，我负责器械项目。',time:3}];
  const inputs = [];
  global.fetch = async (_url, options) => {
    const input = JSON.parse(JSON.parse(options.body).messages[1].content);
    inputs.push(input);
    return {ok:true,json:async()=>({choices:[{message:{content:`# 临床PM面试评估报告\n${input.candidateName} [T1]`}}]})};
  };
  await Promise.all([store.finishInterview(a, ta),store.finishInterview(a, tb),store.finishInterview(b,tb)]);
  await Promise.all([store.runAnalysis(a),store.runAnalysis(b)]);
  assert.equal(inputs.find(i=>i.sessionId===a).candidateName,'张敏');
  assert.equal(inputs.find(i=>i.sessionId===a).resume,'张敏提供的简历');
  assert.equal(inputs.find(i=>i.sessionId===b).candidateName,'李华');
  assert.equal(inputs.find(i=>i.sessionId===b).resume,'');
  assert.deepEqual(inputs.find(i=>i.sessionId===b).transcript.map(t=>t.text),tb.map(t=>t.text));
  assert.doesNotMatch((await store.readInterview(b)).markdown,/张敏|林予安/);
});

test('legacy demo reports are not exposed and retries use only their saved transcript', async () => {
  const id = await store.createInterview();
  const file = path.join(root,'records',`${id}.json`);
  const old = JSON.parse(fs.readFileSync(file,'utf8'));
  delete old.reportVersion; delete old.candidate;
  Object.assign(old,{status:'ready',candidateName:'林予安（演示候选人）',endedAt:new Date().toISOString(),markdown:'# 北森 管理个性V2',transcript:[{role:'user',text:'我叫王芳，我协调了三个中心启动。',time:1}]});
  fs.writeFileSync(file,JSON.stringify(old));
  const read = await store.readInterview(id);
  assert.equal(read.status,'failed');
  assert.equal(read.candidateName,'王芳');
  assert.equal(store.publicReport(read).markdown,undefined);
  global.fetch = async (_url, options) => {
    const data=JSON.parse(JSON.parse(options.body).messages[1].content);
    assert.equal(data.resume,''); assert.equal(data.candidateName,'王芳');
    return {ok:true,json:async()=>({choices:[{message:{content:'# 临床PM面试评估报告\n王芳协调了三个中心启动。[T1]'}}]})};
  };
  await store.finishInterview(id,[],true); await store.runAnalysis(id);
  assert.equal((await store.readInterview(id)).status,'ready');
});

test('analysis rejects external template branding instead of publishing it', async () => {
  const id=await store.createInterview();
  await store.finishInterview(id,[{role:'user',text:'我负责项目预算',time:1}]);
  global.fetch=async()=>({ok:true,json:async()=>({choices:[{message:{content:'# 北森 管理个性V2'}}]})});
  await store.runAnalysis(id);
  assert.equal((await store.readInterview(id)).status,'failed');
  assert.equal((await store.listInterviews()).find(r=>r.id===id).hasReport,false);
});

test('position uses candidate evidence, not interviewer assumptions or colleague mentions', () => {
  const { inferPosition } = require(path.join(root, 'session.js'));
  const turn = text => ({role:'user',text,time:1});
  assert.equal(inferPosition({name:'',resume:'',position:'CRA'}), 'CRA');
  assert.equal(inferPosition(undefined,[turn('我是一个CRA，负责中心监查。')]), '临床 CRA');
  assert.equal(inferPosition(undefined,[{role:'assistant',text:'作为PM你如何管理CRA？',time:1},turn('我和CRA同事一起开会。')]), '岗位待确认');
  assert.equal(inferPosition({name:'',resume:'曾任CRA，现在PM'}), '岗位待确认');
  assert.equal(inferPosition({name:'',resume:'应聘岗位：临床项目经理\n曾任CRA'}), '临床项目经理');
});

test('CRA report input, API metadata and old PM report regeneration agree on role', async () => {
  const id = await store.createInterview({name:'岗位验收',resume:''});
  await store.finishInterview(id,[{role:'user',text:'我是CRA，我完成中心监查和问题整改。',time:1}]);
  global.fetch = async (_,options) => {
    const payload = JSON.parse(options.body);
    const input = JSON.parse(payload.messages[1].content);
    assert.equal(input.position,'临床 CRA');
    assert.ok(payload.messages[0].content.includes('CRA 不套用 PM'));
    assert.ok(!payload.messages[0].content.includes('标题固定为'));
    return {ok:true,json:async()=>({choices:[{message:{content:'# 临床 CRA 面试评估报告\n## 综合评价\n中心监查 [T1]'}}]})};
  };
  await store.runAnalysis(id);
  const record = await store.readInterview(id);
  assert.equal(store.publicReport(record).position,'临床 CRA');
  assert.equal(record.status,'ready');
  delete record.positionVersion;
  record.markdown='# 临床PM面试评估报告';
  fs.writeFileSync(path.join(root,'records',id+'.json'),JSON.stringify(record));
  const old=await store.readInterview(id);
  assert.equal(old.status,'failed');
  assert.equal(store.publicReport(old).markdown,undefined);
  assert.match(old.error,/重新分析/);
  await store.finishInterview(id,[],true);
  await store.runAnalysis(id);
  assert.equal((await store.readInterview(id)).status,'ready');
});

test('personality reports require a concrete type and preserve it in the displayed headline', async () => {
  const layoutFile = path.join(root, 'personality-layout.js');
  fs.writeFileSync(layoutFile, ts.transpileModule(fs.readFileSync(path.join(source, 'personality-layout.ts'), 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText);
  const { parsePersonalityReport } = require(layoutFile);
  for (const code of ['INTJ','ENTP']) {
    const id=await store.createInterview({name:'类型验收',resume:'',interviewType:'personality'});
    await store.finishInterview(id,[{role:'assistant',text:'独立思考还是讨论？',time:1},{role:'user',text:'我通常先独立思考，再讨论',time:2}]);
    global.fetch=async()=>({ok:true,json:async()=>({choices:[{message:{content:`# 性格测试报告\n## 类型概览\n类型倾向：${code}\n画像名称：测试画像\n## 四维偏好\n|维度|本次倾向|访谈证据|解读|\n|外向/内向|偏内向|本次回答|倾向较弱|`}}]})});
    await store.runAnalysis(id);
    const value=await store.readInterview(id);
    assert.equal(value.status,'ready');
    assert.equal(parsePersonalityReport(value.markdown).code,code);
  }
  const id=await store.createInterview({name:'缺失类型验收',resume:'',interviewType:'personality'});
  await store.finishInterview(id,[{role:'user',text:'我习惯先计划再行动',time:1}]);
  global.fetch=async()=>({ok:true,json:async()=>({choices:[{message:{content:'# 性格测试报告\n## 类型概览\n类型倾向：资料不足，类型待确认'}}]})});
  await store.runAnalysis(id);
  assert.equal((await store.readInterview(id)).status,'failed');
  assert.equal((await store.listInterviews()).find(r=>r.id===id).hasReport,false);
});
