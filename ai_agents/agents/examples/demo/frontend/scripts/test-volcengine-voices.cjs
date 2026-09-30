const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const src = path.join(__dirname, '../src');
function loader(mocks = {}) {
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    if (file.endsWith('.json')) return JSON.parse(fs.readFileSync(file, 'utf8'));
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, esModuleInterop: true }
    }).outputText;
    const module = { exports: {} };
    new Function('require', 'module', 'exports', code)(name => {
      if (name in mocks) return mocks[name];
      if (name.startsWith('@/') || name.startsWith('.')) {
        const target = name.startsWith('@/') ? path.join(src, name.slice(2)) : path.resolve(path.dirname(file), name);
        return load(path.extname(target) ? target : `${target}.ts`);
      }
      return require(name);
    }, module, module.exports);
    cache.set(file, module.exports);
    return module.exports;
  }
  return file => load(path.join(src, file));
}

test('official catalog excludes incompatible duplex voices and unconfigured model services', async () => {
  delete process.env.VOLCENGINE_ACCESS_KEY_ID;
  delete process.env.VOLCENGINE_SECRET_ACCESS_KEY;
  process.env.BYTEDANCE_TTS_RESOURCE_ID = 'seed-tts-2.0';
  const { getVoiceCatalog, resolveVolcengineVoice } = loader()('lib/volcengine/voices.ts');
  const catalog = await getVoiceCatalog();
  assert.equal(catalog.source, 'official-snapshot');
  assert.equal(new Set(catalog.voices.map(v => v.id)).size, catalog.voices.length);
  assert.ok(catalog.voices.length > 400);
  assert.equal((await resolveVolcengineVoice('zh_male_m191_uranus_bigtts')).resourceId, 'seed-tts-2.0');
  await assert.rejects(resolveVolcengineVoice('zh_female_shuangkuaisisi_moon_bigtts'));
  process.env.BYTEDANCE_TTS_RESOURCE_ID = 'volc.service_type.10029';
  assert.equal((await loader()('lib/volcengine/voices.ts').resolveVolcengineVoice('zh_female_shuangkuaisisi_moon_bigtts')).resourceId, 'seed-tts-1.0');
  process.env.BYTEDANCE_TTS_RESOURCE_ID = 'seed-tts-2.0';
  await assert.rejects(resolveVolcengineVoice('de_male_sven_uranus_bigtts'));
  await assert.rejects(resolveVolcengineVoice('unknown'));
  await assert.rejects(resolveVolcengineVoice({ speaker: 'injected' }));
});

test('selected voice reaches TEN start with matching resource and cannot be overwritten by client properties', async () => {
  process.env.AGENT_SERVER_URL = 'http://test-agent';
  process.env.DIFY_CHATFLOW_API_KEY = 'test-only';
  let outgoing;
  const { POST } = loader({
    axios: { post: async (url, body) => { outgoing = body; return { status: 200, data: { code: '0' } }; } },
    '@/lib/interview/store': { createInterview: async () => 'test-session' },
  })('app/api/agents/start/route.ts');
  const response = await POST({ json: async () => ({
    candidate: { name: '测试甲', position: 'CRA', resume: '青桥眼科项目' },
    request_id: 'voice-test', channel_name: 'test', user_uid: 1,
    graph_name: 'va_dify_azure', language: 'zh-CN', voice_type: 'male',
    volcengine_voice_id: 'zh_female_shuangkuaisisi_uranus_bigtts',
    properties: { tts: { params: { speaker: 'wrong-voice', resource_id: 'wrong-resource' } } },
  }) });
  assert.equal(response.status, 200);
  assert.equal(outgoing.properties.llm.candidate_name, '测试甲');
  assert.equal(outgoing.properties.llm.candidate_position, 'CRA');
  assert.equal(outgoing.properties.llm.candidate_resume, '青桥眼科项目');
  assert.equal(outgoing.properties.tts.params.speaker, 'zh_female_shuangkuaisisi_uranus_bigtts');
  assert.equal(outgoing.properties.tts.params.resource_id, 'seed-tts-2.0');
  outgoing = undefined;
  const invalid = await POST({ json: async () => ({ graph_name: 'va_dify_azure', language: 'zh-CN', voice_type: 'male', volcengine_voice_id: 'bad' }) });
  assert.equal(invalid.status, 400);
  assert.equal(outgoing, undefined);
});

test('OpenAPI pagination follows the configured model, caches results, and falls back on upstream failure', async () => {
  const originalFetch = global.fetch;
  process.env.VOLCENGINE_ACCESS_KEY_ID = 'test-ak';
  process.env.VOLCENGINE_SECRET_ACCESS_KEY = 'test-sk';
  let calls = 0;
  try {
    global.fetch = async (_url, options) => {
      calls++;
      assert.ok(options.headers.Authorization.startsWith('HMAC-SHA256 Credential=test-ak/'));
      const { ResourceIDs: [resource], Page: page } = JSON.parse(options.body);
      return { ok: true, json: async () => ({ Result: { Total: 101, Speakers: [{ VoiceType: `${resource}-${page}`, Name: `Voice ${page}` }] } }) };
    };
    const { getVoiceCatalog } = loader()('lib/volcengine/voices.ts');
    const data = await getVoiceCatalog();
    assert.equal(data.source, 'openapi');
    assert.equal(data.voices.length, 2);
    assert.equal(calls, 2);
    await getVoiceCatalog();
    assert.equal(calls, 2);
    global.fetch = async () => { throw new Error('network unavailable'); };
    const fallback = await loader()('lib/volcengine/voices.ts').getVoiceCatalog();
    assert.equal(fallback.source, 'official-snapshot');
    assert.ok(fallback.voices.length > 400);
  } finally {
    global.fetch = originalFetch;
    delete process.env.VOLCENGINE_ACCESS_KEY_ID;
    delete process.env.VOLCENGINE_SECRET_ACCESS_KEY;
  }
});
