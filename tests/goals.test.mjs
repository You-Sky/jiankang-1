import test from 'node:test';
import assert from 'node:assert/strict';
import {freshState,emptyDay,validateState,validateProfile,validateGlucose,glucoseToMmol,glucoseDisplay,glucoseAssessment,glucoseCsv,weightProgress,saveState,loadState,mergeState,summarize,recommendations} from '../core.js';
import {goalsSettings,goalCards,glucosePanel,glucoseHistory} from '../goals-ui.js';
const close=(x,y)=>assert.ok(Math.abs(x-y)<1e-9,`${x} != ${y}`);
const reading=(value=6,context='fasting')=>({id:'g1',time:'08:00',context,meal:'',value,sourceUnit:'mmol/L',note:''});
test('legacy v1 profile and daily entries migrate without losing recorded food',()=>{
  const s=freshState();for(const k of ['startWeight','targetWeight','glucoseUnit','fastingLow','fastingHigh','postMealLow','postMealHigh'])delete s.profile[k];
  const d=emptyDay();delete d.glucose;d.foods=[{id:'f',foodId:'rice',name:'米饭',meal:'lunch',grams:100,kcal:130,protein:2.38,carbs:28.6,fat:.21,fiber:null}];s.days['2026-10-01']=d;
  const restored=validateState(s);assert.equal(restored.profile.targetWeight,'');assert.equal(restored.profile.glucoseUnit,'mmol/L');assert.deepEqual(restored.days['2026-10-01'].glucose,[]);assert.equal(restored.days['2026-10-01'].foods[0].kcal,130);
});
test('unit conversion normalizes actual readings once without changing their magnitude',()=>{close(glucoseToMmol(108,'mg/dL'),6);close(glucoseDisplay(6,'mg/dL'),108);close(glucoseToMmol(6.2,'mmol/L'),6.2);close(glucoseDisplay(glucoseToMmol(100,'mg/dL'),'mg/dL'),100);});
test('matching measurement contexts use separate individualized ranges',()=>{
  const p={...freshState().profile,fastingLow:4.5,fastingHigh:6.5,postMealHigh:9};
  assert.equal(glucoseAssessment(reading(7,'fasting'),p).status,'above');assert.equal(glucoseAssessment(reading(7,'after2h'),p).status,'within');assert.equal(glucoseAssessment(reading(4,'before'),p).status,'below');assert.equal(glucoseAssessment(reading(6.5),p).status,'within');assert.equal(glucoseAssessment(reading(8,'bedtime'),p).status,'unrated');
  assert.equal(glucoseAssessment(reading(),freshState().profile).status,'unset');
});
test('invalid targets, units, readout times and readings are rejected',()=>{
  const p=freshState().profile;assert.throws(()=>validateProfile({...p,fastingLow:7,fastingHigh:6}));assert.throws(()=>validateProfile({...p,postMealLow:8,postMealHigh:8}));assert.throws(()=>validateProfile({...p,glucoseUnit:'g/L'}));assert.throws(()=>validateProfile({...p,startWeight:70,targetWeight:80}));
  for(const raw of [{...reading(),time:'25:01'},{...reading(),context:'after1h'},{...reading(),value:0},{...reading(),value:200},{...reading(),meal:'other'},{...reading(),sourceUnit:'unknown'}])assert.throws(()=>validateGlucose(raw));
});
test('JSON save, load and cloud-compatible merge preserve glucose and custom ranges',()=>{
  const s=freshState();s.profile={...s.profile,targetWeight:60,startWeight:70,carbs:150,fastingHigh:6.5};s.days['2026-10-01']={...emptyDay(),profile:{...s.profile},glucose:[reading(6.1)]};
  let raw;const storage={getItem:()=>raw,setItem:(_,v)=>raw=v};saveState(storage,s);const restored=loadState(storage);assert.equal(restored.days['2026-10-01'].glucose[0].value,6.1);assert.equal(restored.days['2026-10-01'].profile.fastingHigh,6.5);
  const merged=mergeState(freshState(),JSON.parse(raw));assert.equal(merged.profile.targetWeight,60);assert.equal(merged.days['2026-10-01'].glucose.length,1);
});
test('historical ranges remain independent of future profile changes',()=>{const s=freshState(),old={...s.profile,fastingHigh:6.5};s.profile.fastingHigh=8;s.days['2026-01-01']={...emptyDay(),profile:old,glucose:[reading(7)]};const d=s.days['2026-01-01'];assert.equal(glucoseAssessment(d.glucose[0],d.profile).status,'above');assert.equal(glucoseAssessment(d.glucose[0],s.profile).status,'within');});
test('weight progress uses latest measured date, clamps progress and excludes future data',()=>{
  const s=freshState();s.profile={...s.profile,weight:80,startWeight:80,targetWeight:60};s.days={'2026-01-01':{...emptyDay(),weight:78},'2026-01-03':{...emptyDay(),weight:75},'2026-02-01':{...emptyDay(),weight:59}};
  let p=weightProgress(s,'2026-01-03');assert.equal(p.current,75);assert.equal(p.remaining,15);assert.equal(p.progress,25);assert.equal(p.change,5);assert.equal(p.measuredDate,'2026-01-03');
  p=weightProgress(s,'2026-02-01');assert.equal(p.progress,100);assert.equal(p.remaining,0);
  s.days['2026-02-02']={...emptyDay(),weight:82};assert.equal(weightProgress(s,'2026-02-02').progress,0);
  assert.equal(weightProgress(freshState()).progress,null);
});
test('blood glucose CSV preserves units and is safe to open in spreadsheets',()=>{
  const s=freshState();s.profile.glucoseUnit='mg/dL';s.profile.fastingHigh=7;s.days['2026-10-01']={...emptyDay(),glucose:[{...reading(6),note:'=HYPERLINK("x")'}]};const csv=glucoseCsv(s);assert.ok(csv.includes('"108"'));assert.ok(csv.includes('"mg/dL"'));assert.ok(csv.includes("'=HYPERLINK"));assert.ok(csv.includes('自定范围内'));
});
test('settings emphasize goals and do not require an energy profile',()=>{const html=goalsSettings(freshState().profile);assert.ok(html.includes('每日碳水目标（g）'));assert.ok(html.includes('目标体重（kg）'));assert.ok(html.includes('空腹 / 餐前目标'));assert.ok(html.includes('<details'));assert.ok(html.includes('只设置控糖和体重目标也可以保存'));assert.ok(!html.includes('value="6.5"'));});
test('glucose-only day produces actual glucose summary without inventing food data',()=>{const s=freshState(),d={...emptyDay(),glucose:[reading(6.2)]},recs=recommendations(d,summarize(d,s.profile));assert.ok(recs[0].text.includes('6.2'));assert.equal(summarize(d,s.profile).carbs,0);});
test('new views escape user-controlled notes and never claim manual readings are CGM time',()=>{const s=freshState();s.days['2026-10-01']={...emptyDay(),glucose:[{...reading(),note:'<img src=x onerror=alert(1)>'}]};const panel=glucosePanel(s,'2026-10-01');assert.ok(panel.includes('&lt;img'));assert.ok(!panel.includes('<img src=x'));assert.ok(panel.includes('不能作为连续血糖监测'));assert.ok(glucoseHistory(s,['2026-10-01']).includes('&lt;img'));assert.ok(goalCards(freshState(),'2026-10-01').includes('当天暂无读数'));});
