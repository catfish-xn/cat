/** Numeric-aware id order (unit-9 before unit-10); ties fall back to plain code-unit order.
 * Shared by Black Rose Sion attribution (g2-3-summons) and Experiment clone triggers (P-EX3). */
export const compareUnitIds=(a:{readonly id:string},b:{readonly id:string}):number=>{
 const x=a.id.split(/(\d+)/),y=b.id.split(/(\d+)/);
 for(let i=0;i<Math.min(x.length,y.length);i++){
  if(x[i]===y[i])continue;
  if(i%2){const p=x[i].replace(/^0+/,''),q=y[i].replace(/^0+/,'');if(p.length!==q.length)return p.length-q.length;if(p!==q)return p<q?-1:1;}
  return x[i]<y[i]?-1:1;
 }
 return x.length-y.length||(a.id<b.id?-1:a.id>b.id?1:0);
};
