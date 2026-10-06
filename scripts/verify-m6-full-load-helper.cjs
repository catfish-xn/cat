/* Same command-only policy as frozen F1; never writes/overwrites F1 artifacts. */
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'generate-m5-route.cjs'),'utf8');
assert(source.includes("'ezreal','corki']")&&source.includes('state.round<18?7:8'),'F1 source policy anchors changed');
let derived=source.replace("'ezreal','corki']","'ezreal','corki','garen']").replace('state.round<18?7:8','state.round<18?7:state.round<28?8:9');
const from=derived.indexOf(' function items()'),to=derived.indexOf(' function formation()',from);assert(from>=0&&to>from);
derived=derived.slice(0,from)+` function items(){for(const item of inventory()){const targets=players().sort((a,b)=>b.starLevel-a.starLevel);for(const target of targets){const slots=new Set(state.items.filter(i=>i.location.kind==='unit'&&i.location.unitId===target.id).map(i=>i.location.slot)),slot=[0,1,2].find(s=>!slots.has(s));if(slot!==undefined){command({type:'equip',itemId:item.id,unitId:target.id,slot});break;}}}}\n`+derived.slice(to);
const mod=new Module(path.join(__dirname,'m6-measured-full-load.cjs'),module);mod.filename=path.join(__dirname,'m6-measured-full-load.cjs');mod.paths=module.paths;mod._compile(derived,mod.filename);
exports.run=(api,options)=>mod.exports.run(api,{...options,build:'cannon'});
