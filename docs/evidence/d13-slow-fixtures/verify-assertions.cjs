const fs=require('fs'),cp=require('child_process'),ts=require('typescript');
const files=['tests/bracer-multikill-stacks.test.ts','tests/m8-b5-grant-upgrade.test.ts'];
const printer=ts.createPrinter({removeComments:true});
function assertions(source){const file=ts.createSourceFile('test.ts',source,ts.ScriptTarget.Latest,true); const found=[];
 function visit(n){if(ts.isCallExpression(n)){let e=n.expression;while(ts.isCallExpression(e)||ts.isPropertyAccessExpression(e)) e=e.expression;
 if(ts.isIdentifier(e)&&e.text==='expect')found.push(printer.printNode(ts.EmitHint.Unspecified,n,file).replace(/\s+/g,''));} ts.forEachChild(n,visit);}
 visit(file);return found.sort();}
let result=[];
for(const file of files){const before=assertions(cp.execFileSync('git',['show','a0d42c592cbd48fb075175e5f61818dabfe1b320:'+file],{encoding:'utf8'})),after=assertions(fs.readFileSync(file,'utf8')); if(JSON.stringify(before)!==JSON.stringify(after))throw Error('assertion mismatch: '+file);result.push({file,before:before.length,after:after.length,identical:true});}
console.log(JSON.stringify(result,null,2));
