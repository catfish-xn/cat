// Exact table-product enumeration, independent of production samplers.
const fs=require('node:fs'),o=require('../tests/fixtures/orb-combo-oracle.cjs');
const d=o.distribution(),expectation={gold:0,heroes:0,remover:0,reforger:0,lesser:0,full:0,completed:0,component:0,artifact:0,support:0,gloves:0};
for(const [box,count] of Object.entries(d.boxCounts))for(const [weight,...atoms] of o.BOXES[box])for(const atom of atoms){
 const key=/^g\d+$/.test(atom)?'gold':/^[hs]\d$/.test(atom)?'heroes':atom;
 expectation[key]+=count*weight/100*(key==='gold'?Number(atom.slice(1)):1);
}
const earlyEquipment=d.mean+expectation.component+2*(expectation.completed+expectation.artifact+expectation.support+expectation.gloves);
const result={...d,early:expectation,earlyEquipment,totalEquipment:earlyEquipment+5+4.4,totalEquipmentRange:[20,d.maxEquipment+5+8],directGold:expectation.gold+7.50518,supplyShare:5/(earlyEquipment+5+4.4)};
fs.mkdirSync('artifacts/orb-combo',{recursive:true});fs.writeFileSync('artifacts/orb-combo/budget.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
