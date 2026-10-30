import test from 'node:test';
import assert from 'node:assert/strict';
import {KEY,todayKey} from '../core.js';

// Lightweight document adapter exercises real application handlers without a browser.
const nodes=new Map(),events=new Map(),saved=new Map();
function node(id){if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',className:'',value:'',open:false,disabled:false,dataset:{},elements:{met:{},kcal:{},token:{}},addEventListener(){},showModal(){this.open=true;},close(){this.open=false;},append(){},click(){},getBoundingClientRect(){return {left:0,top:0,right:1000,bottom:1000};},querySelectorAll(){return[];}});return nodes.get(id);}
globalThis.document={querySelector:node,addEventListener:(name,cb)=>events.set(name,cb),createElement:()=>node('new')};
globalThis.window={addEventListener(){},scrollTo(){}};
globalThis.localStorage={getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)};
Object.defineProperty(globalThis,'navigator',{value:{},configurable:true});
globalThis.FormData=class{constructor(form){this.values=form.values||{};}*[Symbol.iterator](){yield* Object.entries(this.values);}};
await import('../app.js');
async function click(action,data={}){const b={tagName:'BUTTON',dataset:{action,...data},closest(){return this;}};await events.get('click')({target:b,preventDefault(){}});}
async function submit(id,values,dataset={}){await events.get('submit')({preventDefault(){},target:{id,values,dataset,querySelectorAll:()=>[],elements:{token:{value:''}}},submitter:{value:'upload'}});}
const stored=()=>JSON.parse(saved.get(KEY));
test('application renders empty first use without invented personal records',()=>{assert.ok(node('#app').innerHTML.includes('平衡，藏在每一天里'));assert.ok(node('#content').innerHTML.includes('完善身体信息'));assert.equal(saved.has(KEY),false);});
test('real settings, food, exercise, journal and restore handlers work together',async()=>{
  await click('nav',{page:'settings'});assert.ok(node('#content').innerHTML.includes('profile-form'));
  await submit('profile-form',{name:'<测试用户>',sex:'female',age:'30',height:'165',weight:'60',activity:'1.2',manualBaseline:'',deficit:'300',water:'2000',protein:'90',carbs:'',fat:'',goal:'lose'});
  assert.equal(stored().profile.weight,60);assert.ok(node('#app').innerHTML.includes('&lt;'));
  await click('nav',{page:'home'});await click('choose-food',{id:'usda-168930'});assert.ok(node('#modal').innerHTML.includes('食用重量'));
  await submit('food-form',{meal:'lunch',grams:'150'});assert.equal(stored().days[todayKey()].foods[0].kcal,195);assert.equal(stored().days[todayKey()].foods[0].fiber,null);
  node('#exercise-form').values={mode:'met',name:'快走',minutes:'30',met:'4.8',kcal:'0'};
  await click('add-exercise');await submit('exercise-form',{mode:'met',name:'快走',minutes:'30',met:'4.8'});
  assert.equal(stored().days[todayKey()].exercises[0].weight,60);
  await submit('simple-form',{value:'250'},{kind:'water'});assert.equal(stored().days[todayKey()].water,250);
  await submit('journal-form',{note:'<img src=x onerror=alert(1)>'});await click('nav',{page:'home'});assert.ok(node('#content').innerHTML.includes('&lt;img'));assert.ok(!node('#content').innerHTML.includes('<img src=x'));
  await click('complete');assert.equal(stored().days[todayKey()].complete,true);
  await click('nav',{page:'trends'});assert.ok(node('#content').innerHTML.includes('已结束'));assert.ok(node('#content').innerHTML.includes('viewBox'));
  const id=stored().days[todayKey()].foods[0].id;await click('nav',{page:'home'});await click('delete-food',{id});assert.equal(stored().days[todayKey()].foods.length,0);await click('undo');assert.equal(stored().days[todayKey()].foods.length,1);
});
test('GitHub backup requires explicit review and never persists token',async()=>{
  await click('nav',{page:'data'});let put=null;
  globalThis.fetch=async(url,options={})=>{
    if(options.method==='PUT'){put={url,...options};return {ok:true,status:201,json:async()=>({})};}
    if(url.includes('/contents/'))return {ok:false,status:404};
    return {ok:true,status:200,json:async()=>({private:true})};
  };
  await submit('github-form',{repo:'test-user/private-health',branch:'main',path:'backup/data.json',token:'fake-test-token'});
  assert.equal(put,null);assert.ok(node('#modal').innerHTML.includes('确认备份到 GitHub'));
  await click('confirm-github');assert.ok(put);const payload=JSON.parse(put.body);const backup=JSON.parse(Buffer.from(payload.content,'base64').toString('utf8'));
  assert.ok(backup.days[todayKey()]);assert.ok(!JSON.stringify(stored()).includes('fake-test-token'));assert.ok(!JSON.stringify(backup).includes('fake-test-token'));
});
test('every primary page renders after records exist',async()=>{for(const page of ['home','trends','foods','settings','data']){await click('nav',{page});assert.ok(node('#content').innerHTML.length>500,page);assert.ok(!node('#content').innerHTML.includes('undefined'),page);}});
