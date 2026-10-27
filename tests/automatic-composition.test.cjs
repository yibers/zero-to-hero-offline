const {test} = require('node:test');
const assert = require('node:assert/strict');
const {game} = require('./helpers/game-harness.cjs');

function prepare(app) {
  // mountRowEditor performs this step; the harness omits DOM event wiring.
  app.run('rowPrograms[currentLevel]=prepareIconRows(LEVELS[currentLevel],getRows());diagnoseRows();');
}
function palette(app) {
  app.nodes['function-palette']={dataset:{},innerHTML:'',querySelectorAll:()=>[]};
  app.run('updateFunctionPalette(LEVELS[currentLevel],getCodeFromEditor());');
  return app.nodes['function-palette'].innerHTML;
}

test('only composition-only lessons get automatic heads and hide their combinator group',()=>{
  const app=game();
  assert.deepEqual(app.read('LEVELS.filter(automaticCombinator).map(l=>l.level)'),[3,4,5,6,7,10,11,12]);
  for(let i=0;i<16;i++) {
    app.run(`currentLevel=${i};`);prepare(app);
    const auto=app.run('!!automaticCombinator(LEVELS[currentLevel])');
    assert.equal(app.run('getRows()[0].expr'),auto?'(.)':'');
    assert.equal(app.run('getRows().length'),app.run('rowSlotCount(LEVELS[currentLevel])'));
    const hasChoices=app.run('LEVELS[currentLevel].funcs.some(f=>isRowCombinator(parseType(f.sig)))')&&!auto;
    assert.equal(palette(app).includes('aria-label="Combinators"'),hasChoices);
    if(auto) {
      assert.doesNotMatch(palette(app),/data-func-name="\(\.\)"/);
      assert.equal(app.run('functionUsage(LEVELS[currentLevel],getCodeFromEditor()).find(f=>f.name==="(.)").used'),1);
    }
  }
});

test('all automatic-composition lessons solve by selecting only arguments, keeping exact supplies',()=>{
  const app=game();
  const failures=app.read(`(()=>{
    const failures=[];
    for(const [index,level] of LEVELS.entries()) {
      if(!automaticCombinator(level))continue;
      currentLevel=index;rowPrograms[index]=prepareIconRows(level,[{id:'r1',expr:''}]);
      const ids=getRows().map(r=>r.id);
      for(const [i,row] of RowProgram.migrate(level.solution).slice(0,-1).entries()) {
        const expected=RowProgram.call(row.expr),current=RowProgram.call(getRows()[i].expr);
        if(current?.name!==expected.name) {failures.push([level.level,i,'head',current]);break;}
        const placed=placeWithContinuation(level,getRows(),i,expected.args[0],true);
        if(placed.error) {failures.push([level.level,i,placed.error]);break;}
        rowPrograms[index]=placed.rows;diagnoseRows();
        if(JSON.stringify(getRows().map(r=>r.id))!==JSON.stringify(ids))failures.push([level.level,'slots changed']);
        if(cardUsage(level,getCodeFromEditor()).some(f=>f.used>f.limit))failures.push([level.level,'overused stock']);
        if(availableGeneratedFunctions().some(f=>isRowCombinator(f.diagram.type)))failures.push([level.level,'stranded combinator']);
        if(i<ids.length-2&&placed.activeRow!==i+1)failures.push([level.level,'next input not selected']);
        if(i<ids.length-2&&getRows().at(-1).expr)failures.push([level.level,'premature final application']);
      }
      if(getCodeFromEditor()!==level.solution||!checkSolution(level,getCodeFromEditor()).ok)failures.push([level.level,'completion']);
    }
    return failures;
  })()`);
  assert.deepEqual(failures,[]);
});

test('clearing, reload, and undo retain automatic heads and the linked-row lock',()=>{
  const app=game();app.run('currentLevel=1;');prepare(app);
  app.run("rememberRows();rowPrograms[1]=placeWithContinuation(LEVELS[1],getRows(),0,'mkHero',true).rows;persistRows();");
  const restored=game(app.saved());prepare(restored);
  assert.equal(restored.run('getRows()[1].expr'),'r1');
  assert.equal(restored.run('continuationSource(getRows(),1)'),'r1');
  restored.run('rowPrograms[1]=prepareIconRows(LEVELS[1],clearedRows(getRows(),1));');
  assert.equal(restored.run('getRows()[1].expr'),'r1');
  restored.run("rowPrograms[1]=placeWithContinuation(LEVELS[1],getRows(),1,'runZero',true).rows;");
  assert.equal(restored.run('checkSolution(LEVELS[1],getCodeFromEditor()).ok'),true);
  restored.run('rowPrograms[1]=prepareIconRows(LEVELS[1],clearedRows(getRows(),0,true));diagnoseRows();');
  assert.deepEqual(restored.read('getRows().map(r=>r.expr)'),['(.)','','']);
  assert.equal(restored.run('continuationSource(getRows(),1)'),null);
  assert.deepEqual(restored.read('functionUsage(LEVELS[1],getCodeFromEditor()).map(f=>f.remaining)'),[1,1,0]);
  app.run('rowPrograms[1]=prepareIconRows(LEVELS[1],JSON.parse(rowHistory.get(1).undo.at(-1)));');
  assert.deepEqual(app.read('getRows().map(r=>r.expr)'),['(.)','','']);
});

test('existing work survives preparation and generated heads take priority over unused default heads',()=>{
  const app=game();app.run("currentLevel=4;setEditorContent(LEVELS[4].solution);const before=getCodeFromEditor();");prepare(app);
  assert.equal(app.run('getCodeFromEditor()'),app.run('before'));
  app.run('rowPrograms[4]=prepareIconRows(LEVELS[4],clearedRows(getRows(),0,true));');
  assert.deepEqual(app.read('getRows().map(r=>r.expr)'),['(.)','','(.) snd','r3','']);
  assert.equal(app.run('continuationSource(getRows(),3)'),'r3');
  app.run("currentLevel=1;rowPrograms[1]=[{id:'r1',expr:'(.) mkHero'},{id:'r2',expr:'(.)'}];");prepare(app);
  assert.deepEqual(app.read('getRows().map(r=>r.expr)'),['(.) mkHero','r1','']);
  assert.equal(app.run('functionUsage(LEVELS[1],getCodeFromEditor()).find(f=>f.name==="(.)").used'),1);
});

test('mixed-combinator lessons retain their choices even after one kind is exhausted, and text mode stays manual',()=>{
  const app=game();app.run("currentLevel=7;setEditorContent('fmap bd');");prepare(app);
  assert.equal(app.run('getRows()[1].expr'),'');
  assert.match(palette(app),/aria-label="Combinators"/);
  app.run("currentLevel=1;iconMode=false;setEditorContent('');");
  assert.equal(app.run('getTextSource()'),'');
  assert.match(palette(app),/data-func-name="\(\.\)"/);
  app.run('iconMode=true;');prepare(app);
  assert.equal(app.run('getRows()[0].expr'),'(.)');
  assert.doesNotMatch(palette(app),/aria-label="Combinators"/);
});
