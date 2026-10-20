// Capture before the orb rewrite, then compare exact serialized stream/output bytes.
const fs = require('node:fs'), assert = require('node:assert/strict');
async function main() {
  const {createServer} = await import('vite');
  const server = await createServer({configFile:false,cacheDir:'artifacts/orb-stream-cache',optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,ws:false},appType:'custom',logLevel:'error'});
  try {
    const m = await server.ssrLoadModule('/src/simulation/match.ts');
    const {grantMechanicItem} = await server.ssrLoadModule('/src/simulation/seat-mechanics/index.ts');
    const {prepareMatchLoot} = await server.ssrLoadModule('/src/simulation/loot-runtime.ts');
    const accept=r=>{assert(r.ok,r.reason);return r.state;};
    const vectors=[];
    for(const seed of [0,1,42,230,3735928559,4294967295]) {
      let s=m.createMatch(seed);s={...s,gold:10000};
      const shops=[{shop:s.shop,rng:s.rngState}],reforges=[];
      for(let i=0;i<12;i++) {
        // Freeze every entered PvE boundary without claiming any heroes.
        const loot=prepareMatchLoot(seed,[1,2,3,10,17,24,31,38][i%8]);
        assert(loot.frozen);
        s=accept(m.rerollShop(s));shops.push({shop:s.shop,rng:s.rngState});
      }
      for(const [i,id] of ['sword','rod','warmog','vest','rageblade'].entries()) {
        s=accept(grantMechanicItem(s,{receiptId:'stream-test:'+i,source:'test',definitionId:id}));
        const item=s.items.at(-1);s=accept(m.equipItem(s,item.id,'unit-1',0));
        const consumableId='consumable-'+s.nextConsumableSerial;
        s={...s,nextConsumableSerial:s.nextConsumableSerial+1,consumables:[...s.consumables,{consumableId,definitionId:'reforger'}]};
        s=accept(m.useConsumable(s,consumableId,{kind:'unit',unitId:'unit-1'}));
        reforges.push({rng:s.reforgeState,output:s.items.at(-1).definitionId});
      }
      vectors.push({seed,shops,reforges});
    }
    const bytes=JSON.stringify(vectors,null,2)+'\n',file='tests/fixtures/orb-streams-pre-combo.json';
    if(process.argv.includes('--capture')) fs.writeFileSync(file,bytes);
    else assert.equal(bytes,fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n'),'Shop/reforge stream or output changed');
    console.log(JSON.stringify({seeds:vectors.length,shopVectors:78,reforgeVectors:30,byteIdentical:!process.argv.includes('--capture')}));
  } finally {await server.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
