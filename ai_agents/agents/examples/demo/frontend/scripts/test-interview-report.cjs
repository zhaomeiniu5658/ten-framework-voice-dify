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
for (const file of ['report', 'store']) fs.writeFileSync(path.join(root, file + '.js'), ts.transpileModule(fs.readFileSync(path.join(source, file + '.ts'), 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2020, esModuleInterop:true}}).outputText);
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
    assert.match(input.resume, /临床项目经理/);
    assert.equal(input.transcript.length, 4);
    assert.equal(input.transcript[3].text, '最终改善结果');
    assert.equal(input.transcript[3].evidenceId, 'T4');
    return {ok: true, json: async () => ({choices:[{finish_reason:'stop', message:{content:'# 临床PM AI面试分析报告\n\n## 总体结果\n测试'}}]})};
  };
  const id = await store.createInterview();
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
  assert.equal(history.find(r => r.id === second).candidateName, '林予安（演示候选人）');
  assert.ok(history.every(r => !('transcript' in r) && !('markdown' in r)));
  assert.deepEqual(history.map(r => r.createdAt), history.map(r => r.createdAt).sort().reverse());
});
