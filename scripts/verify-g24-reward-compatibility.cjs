/** Compare an independently bundled Git revision against this checkout.
 * Usage: node scripts/verify-g24-reward-compatibility.cjs [base-ref=b2de81a]
 * Only reads Git; archived sources and bundles are removed from /tmp afterwards.
 */
const {buildSync}=require('esbuild');
const {mkdtempSync,mkdirSync,rmSync}=require('node:fs');
const {execFileSync}=require('node:child_process');
const {join,resolve}=require('node:path');
const {tmpdir}=require('node:os');
const {pathToFileURL}=require('node:url');
const {deepStrictEqual}=require('node:assert');
(async()=>{
 const directory=mkdtempSync(join(tmpdir(),'g24-compat-'));
 try{
  const baseRef=process.argv[2]??'b2de81a',baseRoot=join(directory,'base');mkdirSync(baseRoot);
  const archive=join(directory,'baseline.tar');
  execFileSync('git',['archive',`--output=${archive}`,baseRef,'src/simulation']);
  execFileSync('tar',['-xf',archive,'-C',baseRoot]);
  const exports=`export {g23RewardAtoms} from './src/simulation/g2-3-rewards';
   export {G23_CONQUEROR_CHESTS,g23ConquerorReward,G23_BLACK_MARKETS} from './src/simulation/content/g2-3-policy';
   export {CONTENT_DIGEST} from './src/simulation/content';`;
  const bundle=(root,name)=>{const entry=join(directory,`${name}.mjs`);buildSync({stdin:{contents:exports,resolveDir:root},bundle:true,platform:'node',format:'esm',outfile:entry});return entry;};
  const base=await import(pathToFileURL(bundle(baseRoot,'baseline')).href),candidate=await import(pathToFileURL(bundle(resolve('.'),'candidate')).href);
  deepStrictEqual(candidate.CONTENT_DIGEST,base.CONTENT_DIGEST,'content digest');
  const snapshot=(api,bundle,seed)=>api.g23RewardAtoms(bundle,seed).map(atom=>({
   ...atom,choiceIds:Array.from({length:atom.quantity},(_,copy)=>`${atom.id}:copy:${copy}`),
   timeoutOption:atom.options[0]??null,
  }));
  let otherTiers=0,artifacts=0,radiant=0,markets=0;
  for(let tier=1;tier<=15;tier++)for(let seed=0;seed<1024;seed++){
   const {Gold:_gold,...reward}=base.g23ConquerorReward(base.G23_CONQUEROR_CHESTS[tier-1]);
   const bundle={id:`g23:conqueror:${tier}`,round:8,source:'conqueror',tier,reward};
   const expected=snapshot(base,bundle,seed);
   // Each seed/tier key is new: reordered input is the first cache fill.
   const reordered={...bundle,reward:Object.fromEntries(Object.entries(reward).reverse())};
   deepStrictEqual(snapshot(candidate,reordered,seed),expected,`cold reversed tier${tier} seed${seed}`);
   deepStrictEqual(snapshot(candidate,bundle,seed),expected,`warm source tier${tier} seed${seed}`);
   if(tier!==10&&tier!==14)otherTiers++;
   else{artifacts++;if(tier===14)radiant++;}
  }
  for(const market of base.G23_BLACK_MARKETS)for(const option of market.options)for(let seed=0;seed<32;seed++){
   const bundle={id:`g23:market:round-8:${market.tier}`,round:8,source:'black-market',tier:market.tier,reward:option.reward};
   const expected=snapshot(base,bundle,seed);
   const reordered={...bundle,reward:Object.fromEntries(Object.entries(option.reward).reverse())};
   deepStrictEqual(snapshot(candidate,reordered,seed),expected,`market ${option.id} seed${seed}`);markets++;
  }
  console.log(JSON.stringify({baseRef,otherTiers,artifacts,radiant,markets,contentDigest:candidate.CONTENT_DIGEST}));
 }finally{rmSync(directory,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
