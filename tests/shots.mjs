import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE='http://127.0.0.1:4173';
mkdirSync('docs/screenshots',{recursive:true});
const b=await chromium.launch();
const shots=[['home','/',{w:400,h:880},'light'],['scan','/scan',{w:400,h:880},'light'],['pantry','/pantry',{w:400,h:980},'light'],['recipes','/recipes',{w:400,h:880},'light'],['charts','/charts',{w:400,h:1100},'light'],['desktop-dark','/',{w:1280,h:860},'dark'],['pantry-dark','/pantry',{w:1280,h:960},'dark']];
for(const [name,path,vp,scheme] of shots){
  const ctx=await b.newContext({viewport:{width:vp.w,height:vp.h},colorScheme:scheme});
  const p=await ctx.newPage();
  await p.goto(BASE+path,{waitUntil:'networkidle'});
  await p.waitForTimeout(900);
  await p.screenshot({path:`docs/screenshots/${name}.png`});
  await ctx.close();
  console.log('shot',name);
}
await b.close();
