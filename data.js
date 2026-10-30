const fdc=(id,name,category,kcal,protein,carbs,fat,fiber=null)=>({id:`usda-${id}`,name,category,kcal,protein,carbs,fat,fiber,source:`USDA FoodData Central · FDC ${id}，每 100 g 参考值`,url:`https://fdc.nal.usda.gov/food-details/${id}/nutrients`});
const sr=(id,name,category,kcal,protein,carbs,fat,group,page)=>({id:`usda-${id}`,name,category,kcal,protein,carbs,fat,fiber:null,source:`USDA SR28 · NDB ${id}，每 100 g 参考值`,url:`https://www.ars.usda.gov/ARSUserFiles/80400525/Data/SR/SR28/reports/sr28fg${group}.pdf#page=${page}`});
export const FOODS=[
  fdc(168930,'白米饭（中粒，熟）','主食',130,2.38,28.6,.21),
  fdc(168932,'白米饭（短粒，熟）','主食',130,2.36,28.7,.19),
  fdc(169711,'糯米饭（熟）','主食',97,2.02,21.1,.19),
  sr('20038','燕麦（干）','主食',389,16.89,66.27,6.9,'20',183),
  fdc(173424,'鸡蛋（水煮，全蛋）','蛋奶',155,12.58,1.12,10.61),
  fdc(173423,'鸡蛋（煎，数据库成品）','蛋奶',196,13.6,.83,14.8),
  fdc(171265,'全脂牛奶（3.25% 脂肪）','蛋奶',61,3.15,4.8,3.25),
  fdc(171477,'去皮鸡胸肉（烤熟）','肉类',165,31,0,3.57),
  fdc(171054,'去皮去骨鸡肉（混合部位，烤熟）','肉类',190,28.9,0,7.41),
  fdc(172475,'硬豆腐（硫酸钙凝固）','豆制品',144,17.3,2.78,8.72),
  fdc(172476,'普通豆腐（硫酸钙凝固）','豆制品',76,8.08,1.87,4.78),
  fdc(169967,'西兰花（水煮沥干，无盐）','蔬菜',35,2.38,7.18,.41),
  fdc(170440,'土豆（去皮水煮，无盐）','主食 / 蔬菜',86,1.71,20,.1),
  fdc(170438,'土豆（带皮煮后取肉，无盐）','主食 / 蔬菜',87,1.87,20.1,.1),
  sr('09003','苹果（生，带皮）','水果',52,.26,13.81,.17,'09',61),
  fdc(168202,'金冠苹果（生，带皮）','水果',57,.28,13.6,.15),
  fdc(173944,'香蕉（去皮，生）','水果',89,1.09,22.8,.33),
  sr('04053','橄榄油','油脂',884,0,0,100,'04',302)
];
export const ACTIVITIES=[
  {name:'散步 · 约 4.0 km/h',met:3,code:'17170'},
  {name:'中速步行 · 约 4.5–5.5 km/h',met:3.8,code:'17190'},
  {name:'快走 · 约 5.6–6.3 km/h',met:4.8,code:'17200'},
  {name:'慢跑 · 自选速度',met:7.5,code:'12020'},
  {name:'跑步 · 约 8.0–8.4 km/h',met:8.5,code:'12030'},
  {name:'休闲骑行 · 低于 16 km/h',met:4,code:'01010'},
  {name:'力量训练 · 每组 8–15 次',met:3.5,code:'02054'},
  {name:'游泳 · 慢速自由泳',met:5.8,code:'18240'}
];

const fiberValues={'usda-169711':1,'usda-20038':10.6,'usda-173424':0,'usda-173423':0,'usda-171265':0,'usda-172475':2.3,'usda-172476':0.3,'usda-09003':2.4,'usda-168202':2.4,'usda-173944':2.6,'usda-04053':0};
for(const food of FOODS)if(Object.hasOwn(fiberValues,food.id))food.fiber=fiberValues[food.id];
