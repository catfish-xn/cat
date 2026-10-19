import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';
import { createMatch, buyXp, rerollShop, setShopLock, buyUnit, deployMatchUnit, sellUnit, combineItems, equipItem } from '../src/simulation/match';
import { MATCH_RULES } from '../src/simulation/match-rules';
import { UNIT_DEFINITIONS } from '../src/simulation/units';
import { validateCombine, validateEquip } from '../src/simulation/inventory';
import { validateDeployment } from '../src/simulation/game';
const {options,summary,memoryTrend,countMessage,commandStats,candidates,randomPicker,observeBattleStart,sampleMemory}=createRequire(import.meta.url)('../scripts/loadtest-room.cjs');

describe('T9 measurement semantics',()=>{
  it('uses nearest rank, reports sample count and never invents zero samples',()=>{
    expect(summary([])).toEqual({count:0,p50:null,p95:null,p99:null,max:null,mean:null});
    expect(summary([1,2,3,100,5])).toEqual({count:5,p50:3,p95:100,p99:100,max:100,mean:22.2});
  });
  it('requires sane bounded options and never silently overrides an external server',()=>{
    expect(options(['--seats','2','--rounds','3'])).toMatchObject({seats:2,rounds:3,warmup:1,playbackMs:20});
    expect(options(['--playback-ms','real']).playbackMs).toBeNull();
    for(const args of [['--seats','9'],['--seats','0'],['--rounds','0'],['--ops','Infinity'],['--seed','4294967296'],
      ['--url','https://example.com'],['--url','ws://localhost','--prep-sec','3'],['--wat'],['--seats']])expect(()=>options(args)).toThrow();
  });
  it('attributes received application bytes by actual type/round, with lobby as round zero',()=>{
    const rows=new Map();countMessage(rows,{type:'lobby'},90,0);
    countMessage(rows,{type:'view',view:{phase:{round:2}}},70,0);
    countMessage(rows,{type:'state',round:2},80,2);
    countMessage(rows,{type:'unknown',round:1},300,2);
    countMessage(rows,{type:'replay',round:2},40,2);
    countMessage(rows,{type:'receipt'},20,2);
    expect(rows.get(0).applicationBytes.lobby).toBe(90);
    expect(rows.get(1).applicationBytes.other).toBe(300);
    expect(rows.get(2)).toMatchObject({messageCount:4,applicationBytes:{view:70,state:80,replay:40,receipt:20,other:0}});
  });
  it('correlates by seat AND command ID, keeps negative residual evidence, and separates unavailable metrics',()=>{
    const commands=[{seatId:'a',commandId:1,ok:true,type:'buy',rttMs:10,sentEpochMs:100,receiptEpochMs:110},
      {seatId:'b',commandId:1,ok:false,reason:'wrong-phase',type:'buyXp',rttMs:2,sentEpochMs:120,receiptEpochMs:122}];
    const server=[{seatId:'a',commandId:1,totalMs:3,processingMs:2,queueMs:1},{seatId:'b',commandId:1,totalMs:4,processingMs:3,queueMs:1}];
    const result=commandStats(commands,server,[{startEpochMs:105,endEpochMs:111}]);
    expect(result).toMatchObject({accepted:1,serverMatched:2,negativeResidualCount:1,overlappingBattleCompute:1,
      transportAndSchedulingResidualMs:{p50:-2,p95:7},networkOnlyMs:null,rejected:{'wrong-phase':1}});
    expect(commandStats(commands,null,null)).toMatchObject({serverQueueMs:null,serverProcessingToReceiptMs:null,networkOnlyMs:null,overlappingBattleCompute:null});
  });
  it('uses post-match RSS rather than monotonic lifetime HWM to assess the observed direction',()=>{
    const samples=(rss:number[])=>rss.map((n,i)=>({server:{memoryEnd:{rssBytes:n,processLifetimeMaxRssBytes:1000+i}}}));
    expect(memoryTrend(samples([100,95,96]),1)).toMatchObject({strictlyIncreasing:false,deltaBytes:-4});
    expect(memoryTrend(samples([100,110,120]),1)).toMatchObject({strictlyIncreasing:true,deltaBytes:20,interpretation:'observation-only-not-a-leak-proof'});
    expect(memoryTrend(samples([100,110]),1).strictlyIncreasing).toBeNull();
    expect(memoryTrend([...samples([100,95]),{status:'failed',server:{memoryEnd:{rssBytes:999}}}],1).postMatchRssBytes).toEqual([100,95]);
  });
  it('forwards pool, all arguments and receivers; times each advance without changing results',()=>{
    const pool={},input={round:2,seats:['a','b']},resolver={},result={pool};
    const advance=vi.fn().mockReturnValueOnce(null).mockReturnValueOnce(result),job={advance};
    const start=vi.fn().mockReturnValue(job);
    const records: {slices:{wallMs:number;cpuUserMs:number;cpuSystemMs:number}[];wallMs:number;cpuUserMs:number;cpuSystemMs:number;maxSliceMs:number}[]=[];
    const wrapped=observeBattleStart(start,()=>records).call(resolver,input,pool,'extra');
    expect(start).toHaveBeenCalledWith(input,pool,'extra');expect(start.mock.contexts[0]).toBe(resolver);
    expect(wrapped.advance(100,'extra')).toBeNull();
    expect(records[0]).toMatchObject({complete:false,ok:true});
    expect(wrapped.advance(50)).toBe(result);
    expect(advance.mock.calls).toEqual([[100,'extra'],[50]]);expect(advance.mock.contexts).toEqual([job,job]);
    const row=records[0];expect(row).toMatchObject({complete:true,ok:true});expect(row.slices).toHaveLength(2);
    for(const key of ['wallMs','cpuUserMs','cpuSystemMs'] as const)expect(row[key]).toBe(row.slices.reduce((n,s)=>n+s[key],0));
    expect(row.maxSliceMs).toBe(Math.max(...row.slices.map(s=>s.wallMs)));
  });
  it('records a failed slice and rethrows the identical error without inventing completion',()=>{
    const error=new Error('failed'),records: unknown[]=[];
    const wrapped=observeBattleStart(()=>({advance(){throw error;}}),()=>records)({seats:[]},{});
    expect(()=>wrapped.advance(1)).toThrow(error);
    expect(records).toEqual([expect.objectContaining({ok:false,complete:false,slices:[expect.objectContaining({ok:false})]})]);
  });
  it('does not count the scheduling gap between slices as compute overlap',()=>{
    const commands=[{seatId:'a',commandId:1,ok:true,type:'buy',rttMs:10,sentEpochMs:120,receiptEpochMs:130}];
    expect(commandStats(commands,[],[{startEpochMs:100,endEpochMs:110},{startEpochMs:140,endEpochMs:150}]).overlappingBattleCompute).toBe(0);
  });
  it('forces optional GC before end memory sampling only and records the actual mode',()=>{
    const order:string[]=[],gc=()=>{order.push('gc');},runtime={
      memoryUsage:()=>{order.push('memory');return {rss:100,heapUsed:20};},resourceUsage:()=>({maxRSS:2})};
    expect(sampleMemory(true,runtime,gc)).toMatchObject({rssBytes:100,heapUsedBytes:20,processLifetimeMaxRssBytes:2048,gcApplied:true});
    expect(order).toEqual(['gc','memory']);order.length=0;
    expect(sampleMemory(false,runtime,gc)).toMatchObject({gcApplied:false,gcWallMs:null});expect(order).toEqual(['memory']);
    expect(sampleMemory(true,runtime,null)).toMatchObject({gcApplied:false,gcWallMs:null});
  });
  it('candidate commands are legal against observed assets, independent of hidden RNG',()=>{
    const base=createMatch(42),state={...base,gold:30,items:[{id:'item-1',definitionId:'sword',location:{kind:'inventory' as const}},
      {id:'item-2',definitionId:'rod',location:{kind:'inventory' as const}}],nextItemSerial:3};
    const api={MATCH_RULES,UNIT_DEFINITIONS,validateCombine,validateEquip,validateDeployment};
    const list=candidates(state,api);expect(list.some((c:{type:string})=>c.type==='buyXp')).toBe(true);
    for(const action of list) {
      const result=action.type==='buyXp'?buyXp(state):action.type==='reroll'?rerollShop(state):action.type==='shopLock'?setShopLock(state,action.locked,action.generation)
        :action.type==='buy'?buyUnit(state,action.slot,action.generation):action.type==='deploy'?deployMatchUnit(state,action.unitId,action.target)
        :action.type==='sell'?sellUnit(state,action.unitId):action.type==='combine'?combineItems(state,action.a,action.b):equipItem(state,action.itemId,action.unitId,action.slot);
      expect(result.ok,JSON.stringify(action)).toBe(true);
    }
    expect(candidates({...state,rngState:999},api)).toEqual(list);
    const a=randomPicker(42),b=randomPicker(42);expect(Array.from({length:20},()=>a(list))).toEqual(Array.from({length:20},()=>b(list)));
  });
});

describe('T9 additional memory observations and serial comparison',()=>{
  const runtime=(platform:string)=>({platform,
    memoryUsage:()=>({rss:100,heapUsed:20,heapTotal:60,external:8,arrayBuffers:4}),
    resourceUsage:()=>({maxRSS:2})});
  it('records all additional fields after GC and preserves the existing sampling order',()=>{
    const order:string[]=[],base=runtime('linux');
    const result=sampleMemory(true,{...base,memoryUsage:()=>{order.push('memory');return base.memoryUsage();}},
      ()=>order.push('gc'),()=>{order.push('proc');return 'Name:\tnode\nRssAnon:\t 123 kB\nVmRSS: 999 kB\n';});
    expect(order).toEqual(['gc','memory','proc']);
    expect(result).toMatchObject({rssBytes:100,heapUsedBytes:20,heapTotalBytes:60,externalBytes:8,
      arrayBuffersBytes:4,rssAnonBytes:123*1024,gcApplied:true,processLifetimeMaxRssBytes:2048});
  });
  it('does not read proc on other platforms and tolerates Linux read failures',()=>{
    const read=vi.fn(()=>{throw new Error('unavailable');});
    for(const platform of ['win32','darwin'])expect(sampleMemory(false,runtime(platform),null,read).rssAnonBytes).toBeNull();
    expect(read).not.toHaveBeenCalled();
    expect(sampleMemory(false,runtime('linux'),null,read).rssAnonBytes).toBeNull();
    expect(read).toHaveBeenCalledTimes(1);
  });
  it('parses only a complete Linux RssAnon kB line, including zero and CRLF',()=>{
    for(const [status,expected] of [['RssAnon: 0 kB\r\n',0],['VmRSS: 9 kB\nRssAnon: 42 kB\n',43008],
      ['VmRSS: 42 kB\n',null],['RssAnon: invalid kB\n',null],['RssAnon: 2 MB\n',null],
      ['RssAnon: 999999999999999999999 kB\n',null]] as const)
      expect(sampleMemory(false,runtime('linux'),null,()=>status).rssAnonBytes).toBe(expected);
  });
  it('adds aligned heapTotal and RssAnon trends without treating unavailable values as zero',()=>{
    const samples=[{status:'complete',server:{memoryEnd:{rssBytes:100,heapTotalBytes:60,rssAnonBytes:80}}},
      {status:'failed',server:{memoryEnd:{rssBytes:999,heapTotalBytes:999,rssAnonBytes:999}}},
      {status:'complete',server:{memoryEnd:{rssBytes:90,heapTotalBytes:50,rssAnonBytes:null}}}];
    expect(memoryTrend(samples,1)).toMatchObject({postMatchRssBytes:[100,90],postMatchHeapTotalBytes:[60,50],postMatchRssAnonBytes:[80,null]});
  });
  it('summarizes complete matches with means, maxima and explicit missing GC metrics',()=>{
    const {summarizeReport,markdown,compareOptions}=createRequire(import.meta.url)('../scripts/loadtest-compare.cjs');
    const match=(rss:number,gcApplied:boolean)=>({status:'complete',finalRound:35,
      server:{memoryEnd:{rssBytes:rss,heapUsedBytes:20,heapTotalBytes:rss/2,rssAnonBytes:null,gcApplied},sliceWallMs:{max:rss/10}},
      preparationCommands:{rttMs:{p99:2}},choiceCommands:{rttMs:{p99:3}},rounds:[{preparationCommands:{rttMs:{p99:rss/20}}}]});
    const result=summarizeReport({status:'complete',matches:[match(100,true),match(200,false),{...match(999,true),status:'failed'}]});
    expect(result.completedMatches).toBe(2);
    expect(result.metrics).toEqual({rssBytes:{count:2,mean:150,worst:200},gcHeapUsedBytes:{count:1,mean:20,worst:20},
      heapTotalBytes:{count:2,mean:75,worst:100},rssAnonBytes:{count:0,mean:null,worst:null},
      worstRttP99Ms:{count:2,mean:7.5,worst:10},maxSliceMs:{count:2,mean:15,worst:20}});
    expect(markdown({before:result,after:result})).toContain('| rssBytes | 2 | 150 | 200 | 2 | 150 | 200 |');
    expect(compareOptions(['before','after']).config).toMatchObject({seats:8,rounds:6,warmup:1});
    expect(compareOptions(['before','after','--rounds','7','--warmup','2']).config).toMatchObject({rounds:7,warmup:2});
    expect(()=>compareOptions(['before','after','--url','ws://localhost'])).toThrow();
    expect(()=>compareOptions(['before','after','--seats','2'])).toThrow();
  });
});
