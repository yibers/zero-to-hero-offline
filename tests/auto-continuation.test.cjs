const {test} = require('node:test');
const assert = require('node:assert/strict');
const {game} = require('./helpers/game-harness.cjs');

test('every reference solution can be built while combinators continue automatically', () => {
  const app=game();
  const result=app.read(`(()=>{
    let carried=0;const failures=[];
    for(const [index,level] of LEVELS.entries()) {
      currentLevel=index;rowPrograms[index]=[{id:'r1',expr:''}];
      const ids=getRows().map(r=>r.id), reference=RowProgram.migrate(level.solution);
      for(const [i,row] of reference.entries()) {
        if(getRows()[i]?.automatic) break;
        const call=RowProgram.call(row.expr);
        for(const [name,slot] of [[call.name,false],...(rowSlotCount(level)>1?[[call.args[0],true]]:[])]) {
          if(!slot && RowProgram.call(getRows()[i].expr)?.name===name) { carried++;continue; }
          const placed=placeWithContinuation(level,getRows(),i,RowProgram.print({kind:'name',name}),slot);
          if(placed.error) {failures.push([level.level,row.id,placed.error]);break;}
          rowPrograms[index]=placed.rows;diagnoseRows();
          if(JSON.stringify(getRows().map(r=>r.id))!==JSON.stringify(ids)) failures.push([level.level,'slots moved']);
          if(placed.activeRow!==i && (placed.activeRow!==i+1 || continuationSource(getRows(),i+1) && availableGeneratedFunctions().some(f=>f.name===row.id))) failures.push([level.level,'automatic head inventory']);
        }
      }
      if(getCodeFromEditor()!==level.solution || !checkSolution(level,getCodeFromEditor()).ok) failures.push([level.level,'completion']);
    }
    return {carried,failures};
  })()`);
  assert.deepEqual(result.failures,[]);
  assert.ok(result.carried>30);
});

function setup() {
  const app=game();app.run("currentLevel=1;rowPrograms[1]=[{id:'r1',expr:''}];rowPrograms[1]=placeWithContinuation(LEVELS[1],getRows(),0,'(.)').rows;");return app;
}

test('unfinished calls wait; completed combinators move selection and persist as locked continuations',()=>{
  const app=setup();
  assert.equal(app.run('getRows()[1].expr'),'');
  app.run("rememberRows();const placed=placeWithContinuation(LEVELS[1],getRows(),0,'mkHero',true);rowPrograms[1]=placed.rows;diagnoseRows();persistRows();");
  assert.equal(app.run('placed.activeRow'),1);
  assert.equal(app.run('getRows()[1].expr'),'r1');
  assert.deepEqual(app.read('availableGeneratedFunctions()'),[]);
  const saved=game(app.saved());saved.run('diagnoseRows();');
  assert.equal(saved.run('getRows()[1].expr'),'r1');
  app.run('rowPrograms[1]=automaticRows(LEVELS[1],clearedRows(getRows(),1));diagnoseRows();persistRows();');
  assert.equal(app.run('getRows()[1].expr'),'r1');
  assert.equal(app.run('continuationSource(getRows(),1)'),'r1');
  assert.deepEqual(app.read('availableGeneratedFunctions()'),[]);
  const cleared=game(app.saved());cleared.run('diagnoseRows();');
  assert.equal(cleared.run('getRows()[1].expr'),'r1');
  assert.equal(cleared.run('continuationSource(getRows(),1)'),'r1');
  assert.deepEqual(cleared.read('availableGeneratedFunctions()'),[]);
  // The placement and its continuation share a single undo snapshot.
  app.run('rowPrograms[1]=automaticRows(LEVELS[1],JSON.parse(rowHistory.get(1).undo.at(-1)));');
  assert.deepEqual(app.read('getRows().map(r=>r.expr)'),['(.)','','']);
});

test('transformations stay in the palette while pending heads yield to automatic continuations',()=>{
  const app=game();app.run("currentLevel=7;rowPrograms[7]=[{id:'r1',expr:''}];rowPrograms[7]=placeWithContinuation(LEVELS[7],getRows(),0,'fmap').rows;const transformed=placeWithContinuation(LEVELS[7],getRows(),0,'bd',true);rowPrograms[7]=transformed.rows;diagnoseRows();");
  assert.equal(app.run('transformed.activeRow'),0);
  assert.equal(app.run('getRows()[1].expr'),'');
  assert.equal(app.run('continuationSource(getRows(),1)'),null);
  assert.deepEqual(app.read('availableGeneratedFunctions().map(f=>f.name)'),['r1']);
  app.run("rowPrograms[7]=placeWithContinuation(LEVELS[7],getRows(),2,'(.)').rows;rowPrograms[7]=placeWithContinuation(LEVELS[7],getRows(),1,'(.)').rows;rowPrograms[7]=placeWithContinuation(LEVELS[7],getRows(),1,'f2',true).rows;diagnoseRows();");
  assert.equal(app.run('getRows()[2].expr'),'r2');
  assert.equal(app.run('continuationSource(getRows(),2)'),'r2');
  assert.ok(!app.read('availableGeneratedFunctions().map(f=>f.name)').includes('r2'));
  assert.equal(app.run('functionUsage(LEVELS[7],getCodeFromEditor()).find(f=>f.name==="(.)").used'),1);
});

test('clearing a producer clears its automatic continuation but preserves unrelated branches',()=>{
  const app=game();app.run("currentLevel=7;rowPrograms[7]=[{id:'r1',expr:''}];rowPrograms[7]=placeWithContinuation(LEVELS[7],getRows(),3,'fmap').rows;rowPrograms[7]=placeWithContinuation(LEVELS[7],getRows(),3,'bd',true).rows;rowPrograms[7]=placeWithContinuation(LEVELS[7],getRows(),0,'(.)').rows;rowPrograms[7]=placeWithContinuation(LEVELS[7],getRows(),0,'f2',true).rows;");
  assert.equal(app.run('getRows()[1].expr'),'r1');
  app.run('rowPrograms[7]=automaticRows(LEVELS[7],clearedRows(getRows(),0));diagnoseRows();');
  assert.equal(app.run('getRows()[1].expr'),'');
  assert.equal(app.run('getRows()[3].expr'),'fmap bd');
  assert.equal(app.run('getRows().length'),10);
});


test('a linked input remains editable, and clearing its producer removes the link',()=>{
  const app=setup();
  app.run("rowPrograms[1]=placeWithContinuation(LEVELS[1],getRows(),0,'mkHero',true).rows;rowPrograms[1]=placeWithContinuation(LEVELS[1],getRows(),1,'runZero',true).rows;const complete=getRows().map(r=>({...r}));");
  assert.equal(app.run('continuationSource(getRows(),1)'),'r1');
  assert.equal(app.run('continuationSource(getRows(),2)'),null);
  app.run('rowPrograms[1]=automaticRows(LEVELS[1],clearedRows(getRows(),1,true));diagnoseRows();');
  assert.equal(app.run('getRows()[1].expr'),'r1');
  assert.equal(app.run('continuationSource(getRows(),1)'),'r1');
  assert.equal(app.run('getRows().at(-1).expr'),'');
  assert.equal(app.run('functionUsage(LEVELS[1],getCodeFromEditor()).find(f=>f.name==="runZero").remaining'),1);
  app.run("rowPrograms[1]=placeWithContinuation(LEVELS[1],getRows(),1,'runZero',true).rows;");
  assert.equal(app.run('checkSolution(LEVELS[1],getCodeFromEditor()).ok'),true);
  app.run('rowPrograms[1]=automaticRows(LEVELS[1],clearedRows(getRows(),0));');
  assert.deepEqual(app.read('getRows().map(r=>r.expr)'),['','','']);
  assert.equal(app.run('continuationSource(getRows(),1)'),null);
});

test('existing saved heads and text-mode round trips retain the previous-row link',()=>{
  const app=game();app.run('currentLevel=1;setEditorContent(LEVELS[1].solution);diagnoseRows();persistRows();');
  const restored=game(app.saved());restored.run('diagnoseRows();');
  assert.equal(restored.run('continuationSource(getRows(),1)'),'r1');
  restored.run('iconMode=false;const source=getTextSource();setEditorContent(source);iconMode=true;diagnoseRows();');
  assert.equal(restored.run('continuationSource(getRows(),1)'),'r1');
  restored.run('rowPrograms[1]=automaticRows(LEVELS[1],clearedRows(getRows(),1));');
  assert.equal(restored.run('getRows()[1].expr'),'r1 runZero');
});
