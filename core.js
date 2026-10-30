export const KEY = 'hengchang.v1';
export const MEALS = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '加餐' };
export const DEFAULT_PROFILE = { name: '', sex: 'female', age: '', height: '', weight: '', activity: 1.2, manualBaseline: '', deficit: 0, protein: '', carbs: '', fat: '', water: 2000, goal: 'lose', startWeight: '', targetWeight: '', glucoseUnit: 'mmol/L', fastingLow: '', fastingHigh: '', postMealLow: '', postMealHigh: '' };
export const GLUCOSE_CONTEXTS = { fasting:'空腹', before:'餐前', after2h:'餐后 2 小时', bedtime:'睡前', random:'随机' };
export const freshState = () => ({ version: 1, profile: { ...DEFAULT_PROFILE }, days: {}, customFoods: [], favorites: [], github: { repo: '', branch: 'main', path: 'personal-data/health-data.json' } });
export function todayKey(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
export function dateShift(key, n) { const d = new Date(`${key}T12:00:00`); d.setDate(d.getDate()+n); return todayKey(d); }
export function validDate(key) { return /^\d{4}-\d{2}-\d{2}$/.test(key) && Number.isFinite(new Date(`${key}T12:00:00`).getTime()) && todayKey(new Date(`${key}T12:00:00`)) === key; }
export const emptyDay = () => ({ foods: [], exercises: [], glucose: [], water: 0, weight: '', note: '', complete: false });
export function glucoseToMmol(value,unit='mmol/L') { return Number(value)/(unit==='mg/dL'?18:1); }
export function glucoseDisplay(value,unit='mmol/L') { return Number(value)*(unit==='mg/dL'?18:1); }
export function validateGlucose(raw) {
  if(!raw||!Object.hasOwn(GLUCOSE_CONTEXTS,raw.context))throw new Error('血糖测量时点不正确');
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(raw.time||''))throw new Error('请填写有效的测量时间');
  if(raw.meal&&!Object.hasOwn(MEALS,raw.meal))throw new Error('关联餐次不正确');
  if(raw.sourceUnit&&!['mmol/L','mg/dL'].includes(raw.sourceUnit))throw new Error('血糖单位不正确');
  return {id:textValue(raw.id||crypto.randomUUID(),100,'血糖编号'),time:raw.time,context:raw.context,meal:raw.meal||'',value:num(raw.value,0.5,60,'血糖读数（mmol/L）'),sourceUnit:raw.sourceUnit||'mmol/L',note:textValue(raw.note||'',500,'血糖备注')};
}
export function glucoseAssessment(reading,profile=DEFAULT_PROFILE) {
  const prefix=reading.context==='fasting'||reading.context==='before'?'fasting':reading.context==='after2h'?'postMeal':null;
  if(!prefix)return {status:'unrated',label:'此时点仅记录',low:null,high:null};
  const low=Number(profile[prefix+'Low'])||null,high=Number(profile[prefix+'High'])||null;
  if(low===null&&high===null)return {status:'unset',label:'尚未设定范围',low,high};
  if(low!==null&&reading.value<low)return {status:'below',label:'低于自定范围',low,high};
  if(high!==null&&reading.value>high)return {status:'above',label:'高于自定范围',low,high};
  return {status:'within',label:'自定范围内',low,high};
}
export function weightProgress(state,date=todayKey()) {
  const p=state.profile,records=Object.entries(state.days).filter(([k,d])=>k<=date&&Number(d.weight)>0).sort(([a],[b])=>a.localeCompare(b));
  const current=records.length?Number(records.at(-1)[1].weight):Number(p.weight)||Number(p.startWeight)||null;
  const start=Number(p.startWeight)||(records.length?Number(records[0][1].weight):Number(p.weight))||null,target=Number(p.targetWeight)||null;
  const progress=start!==null&&target!==null&&start>target&&current!==null?Math.max(0,Math.min(100,(start-current)/(start-target)*100)):null;
  return {start,current,target,progress,remaining:current!==null&&target!==null?Math.max(0,current-target):null,change:start!==null&&current!==null?start-current:null,measuredDate:records.at(-1)?.[0]||null};
}
export function nutrition(food, grams) { const x = grams/100; return Object.fromEntries(['kcal','protein','carbs','fat','fiber'].map(k=>[k,k==='fiber'&&food[k]==null?null:(Number(food[k])||0)*x])); }
export function baseline(profile, weight = profile.weight) {
  if (Number(profile.manualBaseline) > 0) return Number(profile.manualBaseline);
  if (!(Number(weight)>0 && Number(profile.height)>0 && Number(profile.age)>=18)) return null;
  return (10*Number(weight)+6.25*Number(profile.height)-5*Number(profile.age)+(profile.sex === 'male' ? 5 : -161))*Number(profile.activity);
}
export function exerciseEnergy(met, minutes, weight) {
  if (!(Number(weight)>0 && Number(met)>=1 && Number(minutes)>0)) return { gross: null, net: null };
  return { gross: Number(met)*3.5*Number(weight)/200*Number(minutes), net: (Number(met)-1)*3.5*Number(weight)/200*Number(minutes) };
}
export function summarize(day = emptyDay(), profile = DEFAULT_PROFILE) {
  const p = day.profile || profile;
  const totals = { kcal:0, protein:0, carbs:0, fat:0, fiber:0 };
  for (const f of day.foods || []) for(const k of Object.keys(totals)) totals[k] += Number(f[k]) || 0;
  const weight = Number(day.weight) || Number(p.weight);
  let gross=0, net=0, minutes=0, unresolved=0, grossUnknown=false;
  for(const e of day.exercises || []) {
    minutes+=Number(e.minutes)||0;
    const energy = e.mode==='manual' ? {gross:Number(e.kcal),net:Number(e.kcal)} : exerciseEnergy(e.met,e.minutes,Number(e.weight)||weight);
    if(e.mode==='manual')grossUnknown=true;
    if(energy.net===null) unresolved++; else {gross+=energy.gross;net+=energy.net;}
  }
  const base=baseline(p,weight), expenditure=base===null||unresolved?null:base+net;
  const target = base===null?null:Math.max(0,base-Number(p.deficit||0));
  return {...totals, fiberUnknown:(day.foods||[]).filter(f=>f.fiber==null).length, gross:grossUnknown||unresolved?null:gross, net, minutes, base, expenditure, deficit:expenditure===null?null:expenditure-totals.kcal, target, unresolved, weight, profile:p};
}
export function recommendations(day, s) {
  const goalNotes=[];
  if(Number(s.profile.carbs)>0&&day.foods.length)goalNotes.push({title:day.complete?'当天碳水记录小结':'碳水记录进度',text:`已记录 ${Math.round(s.carbs*10)/10} g，自定每日目标 ${s.profile.carbs} g${s.carbs>Number(s.profile.carbs)?'，已超过自定目标。':'。'}结合实际餐食和血糖读数回顾；碳水摄入量不能代表血糖结果。`,type:'neutral'});
  const readings=[...(day.glucose||[])].sort((a,b)=>a.time.localeCompare(b.time));
  if(readings.length){const latest=readings.at(-1),a=glucoseAssessment(latest,s.profile);goalNotes.push({title:`最近血糖：${a.label}`,text:`${latest.time} ${GLUCOSE_CONTEXTS[latest.context]} ${glucoseDisplay(latest.value,s.profile.glucoseUnit).toFixed(s.profile.glucoseUnit==='mg/dL'?0:1)} ${s.profile.glucoseUnit||'mmol/L'}。${a.status==='above'||a.status==='below'?'先核对测量时点和记录，若反复偏离自定范围，请与医护人员讨论。':'按同类测量时点回看变化；范围应由你和医护人员共同确定。'}`,type:a.status==='above'||a.status==='below'?'caution':'neutral'});}
  if(!day.foods.length) return [...goalNotes,{title:'从一餐开始，找到自己的节奏',text:'记下吃了什么和大约的分量。无需追求完美，持续记录比单次精确更有价值。',type:'neutral'}].slice(0,4);
  const out=[];
  if(!day.complete) out.push({title:'今天还在进行中',text:'当前收支仅根据已记录内容估算。补全三餐后，点击“结束当天记录”再查看日终总结。',type:'neutral'});
  else if(s.deficit===null) out.push({title:'还差一点信息',text:'在个人设置中填写身体信息或基础日消耗，并补全运动所需体重，才能估算热量收支。',type:'neutral'});
  else {
    const delta=s.deficit-Number(s.profile.deficit||0);
    const title=Math.abs(delta)<=150?'收支接近你设定的目标':delta>0?'本日缺口高于设定值':'本日缺口低于设定值';
    const text=delta>150?'先检查是否漏记餐食、烹调油或饮料。无需为了扩大缺口继续少吃或额外运动。':delta<-150?'回顾份量和活动记录，观察接下来几天的趋势；无需用下一餐或额外运动补偿。':'继续保持规律饮食和适量活动，结合多日记录观察变化。';
    out.push({title,text,type:Math.abs(delta)<=150?'positive':'neutral'});
  }
  if(Number(s.profile.protein)>0 && s.protein<Number(s.profile.protein)*0.8) out.push({title:'蛋白质尚未达到自定目标',text:`目前 ${Math.round(s.protein)} g / 目标 ${s.profile.protein} g。后续用餐可结合喜好选择蛋、奶、豆类或鱼肉。`,type:'neutral'});
  if(day.complete&&s.base&&s.kcal<s.base/Number(s.profile.activity||1.2)) out.push({title:'记录摄入偏低，先核对完整性',text:'若已完整记录且长期如此，建议与营养专业人员确认适合自己的摄入量。',type:'caution'});
  if(s.unresolved) out.push({title:'有运动尚未计入消耗',text:'补充个人体重，或改用设备提供的“活动热量（净消耗）”。',type:'neutral'});
  return [...goalNotes,...out].slice(0,4);
}
function num(v,min,max,label) { if(v===''||v===null||!Number.isFinite(Number(v))||Number(v)<min||Number(v)>max) throw new Error(`${label}超出有效范围`); return Number(v); }
function textValue(v,max,label) { if(typeof v!=='string'||v.length>max) throw new Error(`${label}格式不正确`); return v; }
export function validateProfile(raw) {
  if(!raw||typeof raw!=='object'||Array.isArray(raw)) throw new Error('个人资料格式不正确');
  const p={...DEFAULT_PROFILE};
  p.name=textValue(raw.name??'',60,'昵称');
  if(!['male','female'].includes(raw.sex)) throw new Error('公式参数不正确'); p.sex=raw.sex;
  for(const [k,min,max] of [['age',18,100],['height',100,230],['weight',25,350],['manualBaseline',500,8000],['protein',0,500],['carbs',0,1200],['fat',0,400]]) p[k]=raw[k]===''||raw[k]==null?'':num(raw[k],min,max,k);
  for(const k of ['startWeight','targetWeight'])p[k]=raw[k]===''||raw[k]==null?'':num(raw[k],25,350,k==='startWeight'?'起始体重':'目标体重');
  p.glucoseUnit=raw.glucoseUnit||'mmol/L';if(!['mmol/L','mg/dL'].includes(p.glucoseUnit))throw new Error('血糖显示单位不正确');
  for(const k of ['fastingLow','fastingHigh','postMealLow','postMealHigh'])p[k]=raw[k]===''||raw[k]==null?'':num(raw[k],0.5,60,'血糖目标');
  for(const prefix of ['fasting','postMeal'])if(p[prefix+'Low']!==''&&p[prefix+'High']!==''&&p[prefix+'Low']>=p[prefix+'High'])throw new Error('血糖目标下限应低于上限');
  p.activity=num(raw.activity,1.1,1.9,'日常活动系数');
  p.deficit=num(raw.deficit??0,-500,750,'目标缺口'); p.water=num(raw.water??2000,250,8000,'饮水目标');
  p.goal=['maintain','lose','gain'].includes(raw.goal)?raw.goal:'maintain';
  if(p.goal==='lose'&&p.startWeight&&p.targetWeight&&p.targetWeight>=p.startWeight)throw new Error('减重目标体重应低于起始体重');
  return p;
}
export function validateFood(f, entry = false) {
  if(!f||typeof f!=='object') throw new Error('食物格式不正确');
  const x={id:textValue(f.id||crypto.randomUUID(),100,'编号'),name:textValue(f.name,100,'食物名'),kcal:num(f.kcal,0,entry?20000:1000,'热量'),protein:num(f.protein,0,entry?2000:100,'蛋白质'),carbs:num(f.carbs,0,entry?2000:100,'碳水'),fat:num(f.fat,0,entry?2000:100,'脂肪'),fiber:f.fiber==null?null:num(f.fiber,0,entry?1000:100,'纤维')};
  if(entry) {if(!MEALS[f.meal]) throw new Error('餐次不正确');x.meal=f.meal;x.grams=num(f.grams,0.1,10000,'重量');x.foodId=textValue(f.foodId||'',100,'食物编号');}
  else {x.category=textValue(f.category||'自定义',40,'分类');x.source=textValue(f.source||'用户输入 / 包装标示',500,'来源');}
  return x;
}
export function validateState(raw) {
  if(!raw||raw.version!==1||typeof raw.days!=='object'||!raw.days||Array.isArray(raw.days)) throw new Error('请选择衡常导出的 v1 JSON 备份');
  const out=freshState(); out.profile=validateProfile(raw.profile);
  if(Object.keys(raw.days).length>20000) throw new Error('记录数量过多');
  for(const [key,d] of Object.entries(raw.days)) {
    if(!validDate(key)||!d||!Array.isArray(d.foods)||!Array.isArray(d.exercises)||d.foods.length>500||d.exercises.length>100) throw new Error('每日记录格式不正确');
    const day=emptyDay();day.foods=d.foods.map(f=>validateFood(f,true));
    if(d.glucose!==undefined&&(!Array.isArray(d.glucose)||d.glucose.length>300))throw new Error('血糖记录格式不正确');
    day.glucose=(d.glucose||[]).map(validateGlucose);
    day.exercises=d.exercises.map(e=>{
      if(!['met','manual'].includes(e.mode)) throw new Error('运动模式不正确');
      return {id:textValue(e.id,100,'运动编号'),name:textValue(e.name,100,'运动名'),mode:e.mode,minutes:num(e.minutes,1,1440,'时长'),met:num(e.met??1,1,30,'MET'),kcal:num(e.kcal??0,0,20000,'运动热量'),weight:e.weight?num(e.weight,25,350,'体重'):null};
    });
    day.water=num(d.water??0,0,20000,'饮水');day.weight=d.weight?num(d.weight,25,350,'体重'):'';day.note=textValue(d.note||'',3000,'日记');day.complete=!!d.complete;
    if(d.profile) day.profile=validateProfile(d.profile);
    out.days[key]=day;
  }
  if(!Array.isArray(raw.customFoods)||raw.customFoods.length>2000) throw new Error('食物库格式不正确');
  out.customFoods=raw.customFoods.map(f=>validateFood(f));
  out.favorites=Array.isArray(raw.favorites)?raw.favorites.filter(f=>typeof f==='string'&&f.length<100).slice(0,2000):[];
  if(raw.github) out.github={repo:textValue(raw.github.repo||'',150,'仓库'),branch:textValue(raw.github.branch||'main',100,'分支'),path:textValue(raw.github.path||'personal-data/health-data.json',300,'备份路径')};
  return out;
}
export function mergeState(current, incoming) {
  const next=validateState(incoming);
  return {...current,profile:next.profile, days:{...current.days,...next.days},customFoods:[...new Map([...current.customFoods,...next.customFoods].map(f=>[f.id,f])).values()],favorites:[...new Set([...current.favorites,...next.favorites])],github:current.github};
}
export function loadState(storage) {
  const str=storage.getItem(KEY); if(!str) return freshState();
  return validateState(JSON.parse(str));
}
export function saveState(storage,state) { storage.setItem(KEY,JSON.stringify(state)); }
export function csvReport(state) {
  const rows=[['日期','记录完整','摄入(kcal)','基础日消耗(kcal)','运动净消耗(kcal)','总消耗(kcal)','热量缺口(kcal)','蛋白质(g)','碳水(g)','脂肪(g)','已知纤维(g)','运动(分钟)','饮水(ml)','体重(kg)','日记','自定碳水目标(g)','当前目标体重(kg)','血糖记录次数']];
  for(const key of Object.keys(state.days).sort()) {const d=state.days[key],s=summarize(d,state.profile);rows.push([key,d.complete?'是':'否',s.kcal,s.base,s.net,s.expenditure,s.deficit,s.protein,s.carbs,s.fat,s.fiber,s.minutes,d.water,d.weight,d.note,s.profile.carbs,state.profile.targetWeight,(d.glucose||[]).length].map(v=>typeof v==='number'?Math.round(v*10)/10:v??''));}
  return '\uFEFF'+rows.map(row=>row.map(v=>{let t=String(v);if(/^[=+\-@\t\r]/.test(t))t="'"+t;return '"'+t.replaceAll('"','""')+'"';}).join(',')).join('\r\n');
}
export function glucoseCsv(state) {
  const rows=[['日期','时间','测量时点','关联餐次','血糖(mmol/L)','显示血糖','显示单位','自定下限(mmol/L)','自定上限(mmol/L)','与自定范围比较','备注']];
  for(const key of Object.keys(state.days).sort()){const d=state.days[key],p=d.profile||state.profile;for(const r of [...(d.glucose||[])].sort((a,b)=>a.time.localeCompare(b.time))){const a=glucoseAssessment(r,p),unit=p.glucoseUnit||'mmol/L';rows.push([key,r.time,GLUCOSE_CONTEXTS[r.context],MEALS[r.meal]||'',Math.round(r.value*1000)/1000,Number(glucoseDisplay(r.value,unit).toFixed(unit==='mg/dL'?0:1)),unit,a.low??'',a.high??'',a.label,r.note]);}}
  return '\uFEFF'+rows.map(row=>row.map(v=>{let t=String(v);if(/^[=+\-@\t\r]/.test(t))t="'"+t;return '"'+t.replaceAll('"','""')+'"';}).join(',')).join('\r\n');
}
