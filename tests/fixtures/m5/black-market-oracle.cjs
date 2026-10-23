// Independent retained map22 source + BigInt arithmetic; no production imports.
const {readFileSync}=require('node:fs');
const {gunzipSync}=require('node:zlib');
let tables;
function concreteMarketItems(seed,offer){
 if(!tables)tables=Object.fromEntries(Object.values(JSON.parse(gunzipSync(readFileSync('src/simulation/content/source/s13-14.24b/raw/map22.bin.json.gz'))))
  .filter(x=>x.mName?.startsWith('TFT13_Crime_')).map(x=>[x.mName,x.mConstants]));
 const out=[];let index=0;
 for(const [key,entry]of Object.entries(tables[offer.optionId])){
  const value=entry.mValue;
  if(key==='Item'||key==='ExactItem')for(const api of value){
   const atomId=`${offer.id}:atom:${index++}`;
   const pool=(key==='Item'?tables.TFT13_Crime_VialTiers[api].mValue:[api]).slice().sort();
   let hash=0x67323372n;
   for(const c of `${seed}:${atomId}`)hash=(hash*31n+BigInt(c.charCodeAt(0)))%4294967296n;
   const word=(hash*1664525n+1013904223n)%4294967296n;
   out.push({atomId,definitionId:pool[Number(word*BigInt(pool.length)/4294967296n)]});
  }
  else if(key!=='PlayerBuff')index+=Array.isArray(value)?value.length:1;
 }
 return out;
}
module.exports={concreteMarketItems};
