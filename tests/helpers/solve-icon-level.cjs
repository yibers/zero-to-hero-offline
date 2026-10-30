// Drive the public placement path with initial cards only. Generated functions
// must already be in place when their reference row is reached.
function solveIconLevel(app, index) {
  return app.read(`(()=>{
    currentLevel=${index};const level=LEVELS[currentLevel];
    rowPrograms[currentLevel]=prepareIconRows(level,[{id:'r1',expr:''}]);
    const ids=getRows().map(r=>r.id), failures=[];let carried=0, placements=0;
    const reference=RowProgram.migrate(level.solution);
    for(const [i,row] of reference.entries()) {
      if(getRows()[i]?.automatic)break;
      const wanted=RowProgram.call(row.expr);
      for(const [name,slot] of [[wanted.name,false],...(ids.length>1?[[wanted.args[0],true]]:[])]) {
        const actual=RowProgram.call(getRows()[i].expr);
        if((slot?actual?.args[0]:actual?.name)===name){carried++;continue;}
        if(ids.includes(name)){failures.push([i,'generated result required manual placement',name]);break;}
        const result=placeWithContinuation(level,getRows(),i,RowProgram.print({kind:'name',name}),slot);
        if(result.error){failures.push([i,result.error]);break;}
        placements++;rowPrograms[currentLevel]=result.rows;diagnoseRows();
        if(JSON.stringify(ids)!==JSON.stringify(getRows().map(r=>r.id)))failures.push([i,'slots changed']);
        if(cardUsage(level,getCodeFromEditor()).some(f=>f.used>f.limit))failures.push([i,'stock exceeded']);
        if(availableGeneratedFunctions().length)failures.push([i,'generated card in palette']);
        const complete=constructionTypes(level,getRows())[i];
        if(complete && !getRows().at(-1).expr){
          const next=RowProgram.call(getRows()[result.activeRow].expr);
          if(result.activeRow<=i||!next||next.name!=='_'&&next.args.length)failures.push([i,'next choice not selected']);
        }
      }
    }
    if(getCodeFromEditor()!==level.solution||!checkSolution(level,getCodeFromEditor()).ok)failures.push(['completion']);
    if(generatedUsage(getRows()).some(f=>f.used!==1))failures.push(['generated usage']);
    return {carried,placements,failures};
  })()`);
}
module.exports={solveIconLevel};
