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
test('greeting received before start response survives session binding and restart',()=>{
  const {default:reducer,addChatItem,beginInterview,setInterviewSessionId,endInterview} = load('store/reducers/global.ts',{COLOR_LIST:[{active:''}],EMobileActiveTab:{AGENT:'agent'}});
  const greeting = {userId:100,text:'您好，请介绍一下自己。',type:'agent',data_type:'text',time:100,isFinal:true};
  let state = reducer(undefined,beginInterview('old-session'));
  state = reducer(state,addChatItem({...greeting,text:'旧面试'}));
  state = reducer(state,endInterview());
  state = reducer(state,beginInterview(''));
  assert.equal(state.chatItems.length,0);
  state = reducer(state,addChatItem(greeting));
  const id = state.chatItems[0].id;
  state = reducer(state,setInterviewSessionId('new-session'));
  assert.equal(state.interviewSessionId,'new-session');
  assert.equal(state.chatItems.length,1);
  assert.equal(state.chatItems[0].text,greeting.text);
  assert.equal(state.chatItems[0].id,id);
});
test('spoken completion preserves answers for automatic report submission and stops late messages',()=>{
  const {default:reducer,addChatItem,beginInterview} = load('store/reducers/global.ts',{COLOR_LIST:[{active:''}],EMobileActiveTab:{AGENT:'agent'}});
  let state = reducer(undefined,beginInterview('spoken-end-session'));
  const message = {userId:100,type:'agent',data_type:'text',time:100,isFinal:true};
  state = reducer(state,addChatItem({...message,text:'结果如何？'}));
  state = reducer(state,addChatItem({...message,userId:101,type:'user',text:'追回了项目进度。',time:101}));
  state = reducer(state,addChatItem({...message,userId:101,type:'user',text:'好的，今天面试到这里吧。',time:102}));
  state = reducer(state,addChatItem({...message,text:'好的，本次面试已结束。',time:103}));
  const transcript = state.chatItems;
  state = reducer(state,addChatItem({...message,text:'completed',data_type:'interview_completed',time:104}));
  assert.equal(state.interviewEnded,true);
  assert.equal(state.interviewSessionId,'spoken-end-session');
  assert.deepEqual(state.chatItems,transcript);
  state = reducer(state,addChatItem({...message,text:'（无内容）',time:105}));
  assert.deepEqual(state.chatItems,transcript);
  state = reducer(state,beginInterview('next-session'));
  assert.equal(state.interviewEnded,false);
  assert.equal(state.chatItems.length,0);
});
