/** Build server entry first. Validates shipped exports with no browser or implicit entropy. */
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
async function main() {
  assert.equal(process.versions.node.split('.')[0], '22');
  for (const name of ['window','document','navigator','Phaser']) {
    Object.defineProperty(globalThis,name,{configurable:true,get(){throw new Error(`Browser global: ${name}`);}});
  }
  Math.random=()=>{throw new Error('Implicit RNG');};
  Date.now=()=>{throw new Error('Implicit clock');};
  const r=await import(pathToFileURL(path.resolve(__dirname,'../dist-server/index.mjs')).href);
  const accepted=result=>{assert.equal(result.ok,true,result.reason);return result;};
  let pool=r.createSharedPool('node-tp',42),states=[];
  for(let i=0;i<8;i++) {const next=accepted(r.initializeSharedSeat(pool,r.createMatch(5),`seat-${i}`,i));pool=next.pool;states.push(next.state);}
  assert.equal(Object.keys(pool.initial).length,19);assert.equal(pool.available.irelia,22);
  const initial=accepted(r.refreshSharedShops(pool,states,1));pool=initial.pool;states=initial.states;
  assert.equal(pool.shops.length,40);r.assertSharedPoolConservation(pool,states);
  const paid=accepted(r.buySharedUnit(pool,{...states[0],gold:5},0,1));pool=paid.pool;states=[paid.state,...states.slice(1)];
  assert.equal(pool.shops.length,39);r.assertSharedPoolConservation(pool,states);
  assert.equal(r.buySharedUnit(pool,states[0],0,1).reason,'purchased-slot');
  const before=JSON.stringify([pool,states]);
  assert.equal(r.rerollSharedShop(pool,states[0],0).reason,'stale-shop');
  assert.equal(JSON.stringify([pool,states]),before);
  let tiny=r.createSharedPool('tiny',0,{seatCount:2,capacities:{irelia:2,maddie:1}}),seats=[];
  for(let i=0;i<2;i++){const next=accepted(r.initializeSharedSeat(tiny,r.createMatch(5),`s${i}`,i));tiny=next.pool;seats.push(next.state);}
  const a=accepted(r.generateSharedShop(tiny,seats[0],0)),b=accepted(r.generateSharedShop(a.pool,seats[1],0));
  assert.equal(b.pool.shops.length,1);assert(b.state.shop.slots.every(s=>s.empty));
  assert.equal(r.rerollSharedShop(b.pool,{...b.state,gold:10},1).reason,'pool-empty');
  r.assertSharedPoolConservation(b.pool,[a.state,b.state]);
  console.log(JSON.stringify({node:process.version,heroes:19,openingCopies:8,shops:40,
    checks:'eight-seat initialization, conservation, last copy, duplicate buy, stale reroll, empty fallback, pure Node'}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
