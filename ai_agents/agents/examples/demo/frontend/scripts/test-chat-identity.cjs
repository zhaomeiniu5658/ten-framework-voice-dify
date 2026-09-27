const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(file, common = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../src', file), 'utf8');
  const code = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023}}).outputText;
  const module = {exports:{}};
  new Function('require','module','exports',code)(name => name === '@/common' ? common : require(name),module,module.exports);
  return module.exports;
}
test('same timestamp messages have distinct stable ids across streaming updates and sorting',()=>{
  const {default:reducer,addChatItem} = load('store/reducers/global.ts',{COLOR_LIST:[{active:''}],EMobileActiveTab:{AGENT:'agent'}});
  const message = {userId:1,text:'开始',type:'agent',data_type:'text',time:100,isFinal:true};
  let state = reducer(undefined,{type:'init'});
  state = reducer(state,addChatItem(message));
  state = reducer(state,addChatItem({...message,text:'回答',type:'user',isFinal:false}));
  const ids = state.chatItems.map(x=>x.id);
  assert.equal(new Set(ids).size,2);
  state = reducer(state,addChatItem({...message,text:'完整回答',type:'user',time:101,isFinal:true}));
  assert.deepEqual(state.chatItems.map(x=>x.id),ids);
});
test('Dify voice selection uses the configured Bytedance provider',()=>{
  const {getGraphProperties} = load('app/api/agents/start/graph.ts');
  for(const voice of ['male','female']) {
    const p=getGraphProperties('va_dify_azure','zh-CN',voice);
    assert.match(p.tts.params.speaker,new RegExp('^zh_'+voice+'_'));
    assert.equal(p.tts.params.propertys,undefined);
  }
});
