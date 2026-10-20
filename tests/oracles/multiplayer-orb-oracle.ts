/** Independent contract arithmetic. No production imports, including sell-price/planner helpers. */
export const CAPACITY_VECTORS = [
  {cost:2,starLevel:1,gold:2,copies:1},
  {cost:2,starLevel:2,gold:5,copies:3},
  {cost:2,starLevel:3,gold:17,copies:9},
  {cost:1,starLevel:2,gold:3,copies:3},
] as const;
export const CLAIM_EXPECTATIONS = {
  queued: {
    capacitySale:{gold:5,copies:0,resolution:'capacity-sold'},
    held:{gold:0,copies:3,resolution:'held'},
    competition:{gold:2,copies:3,resolutions:['held','gold']},
    forfeited:{gold:0,copies:0,resolution:'forfeited'},
  },
  carriedRound: '3-1', sourceRound:'2-7',
  soldBeforeClaim: {born:1,goldFromClaim:0,resolution:'held'},
  mergesAtCapacity: {rosterDelta:-1,starLevel:2,copies:3,goldFromClaim:0,resolution:'held'},
  duplicate: {stateChanged:false,rngChanged:false,poolChanged:false,reason:'already-claimed'},
  shortageWithCapacity: {gold:2,resolution:'gold',copies:0},
} as const;
export function receiptTotals(receipts:readonly {dropId:string;gold?:number;resolution?:string}[]) {
  const keys=new Set<string>();let gold=0;
  for(const r of receipts) {if(keys.has(r.dropId))throw Error('Oracle: duplicate payment');keys.add(r.dropId);gold+=r.gold??0;}
  return {count:keys.size,gold};
}
export function independentConservation(pool:{initial:Readonly<Record<string,number>>;available:Readonly<Record<string,number>>;
  holdings:readonly {definitionId:string;sources:readonly string[]}[];shops:readonly {definitionId:string}[];
  pending:readonly {definitionId:string;starLevel?:number}[]}) {
  for(const [id,total] of Object.entries(pool.initial)) {
    const actual=pool.available[id]+pool.shops.filter(s=>s.definitionId===id).length
      +pool.holdings.filter(h=>h.definitionId===id).reduce((n,h)=>n+h.sources.length,0)
      +pool.pending.filter(p=>p.definitionId===id).reduce((n,p)=>n+(p.starLevel===3?9:p.starLevel===2?3:1),0);
    if(actual!==total)throw Error(`Oracle: conservation ${id}: ${actual}/${total}`);
  }
}
