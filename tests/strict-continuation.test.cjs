const {test} = require('node:test');
const assert = require('node:assert/strict');
const {game} = require('./helpers/game-harness.cjs');

test('all reference solutions obey immediate continuation and remain stable on preparation',()=>{
  const app=game();
  assert.deepEqual(app.read(`LEVELS.flatMap((level,index)=>{
    currentLevel=index;setEditorContent(level.solution);
    const before=JSON.stringify(getRows()), prepared=prepareIconRows(level,getRows());
    return generatedCombinatorError(level,prepared)||JSON.stringify(prepared)!==before
      ||JSON.stringify(prepareIconRows(level,prepared))!==before||!checkSolution(level,RowProgram.source(prepared)).ok
      ? [level.level]:[];
  })`),[]);
});

test('an occupied next row shifts intact, including its dependent branch and references',()=>{
  const app=game();
  app.run(`currentLevel=7;rowPrograms[7]=[
    {id:'r1',expr:'(>>>)'}, {id:'r2',expr:'fmap bd'},
    {id:'r3',expr:'_ r2'}];
    rowPrograms[7]=prepareIconRows(LEVELS[7],getRows());
    const before=getRows().map(r=>({...r})), ids=before.map(r=>r.id);
    rememberRows();const placed=placeWithContinuation(LEVELS[7],getRows(),0,'f2',true);
    rowPrograms[7]=placed.rows;diagnoseRows();persistRows();`);
  assert.equal(app.run('placed.error'),undefined);
  assert.equal(app.run('placed.activeRow'),1);
  assert.deepEqual(app.read('getRows().slice(0,5).map(r=>r.expr)'),['(>>>) f2','r1','fmap bd','_ r3','']);
  assert.deepEqual(app.read('getRows().map(r=>r.id)'),app.read('ids'));
  assert.deepEqual(app.read('rowDiagnostics.slice(2,3).map(r=>!!r.error)'),[false]);
  assert.equal(app.run('generatedCombinatorError(LEVELS[7],getRows())'),null);
  assert.deepEqual(app.read('availableGeneratedFunctions().map(f=>f.name)'),[]);
  assert.equal(app.run('cardUsage(LEVELS[7],getCodeFromEditor()).some(f=>f.used>f.limit)'),false);
  const restored=game(app.saved());
  restored.run('rowPrograms[7]=prepareIconRows(LEVELS[7],getRows());diagnoseRows();');
  assert.deepEqual(restored.read('getRows()'),app.read('getRows()'));
  app.run('rowPrograms[7]=prepareIconRows(LEVELS[7],JSON.parse(rowHistory.get(7).undo.at(-1)));');
  assert.deepEqual(app.read('getRows()'),app.read('before'));
});

const deferred='let\n  r1 = (>>>) f3\n  r2 = (>>>) f1\n  r3 = r1 snd\n  r4 = r2 r3\nin\n  r4 z';

test('deferred saved chains are reordered without losing calls, supplies, or fixed slots',()=>{
  const app=game();
  app.run(`currentLevel=4;setEditorContent(${JSON.stringify(deferred)});
    const before=getRows(), ids=before.map(r=>r.id), stock=functionUsage(LEVELS[4],RowProgram.source(before));
    rowPrograms[4]=prepareIconRows(LEVELS[4],before);diagnoseRows();`);
  assert.deepEqual(app.read('getRows().map(r=>r.id)'),app.read('ids'));
  assert.deepEqual(app.read('getRows().slice(0,-1).map(r=>r.expr)'),['(>>>) f3','r1 snd','(>>>) f1','r3 r2']);
  assert.match(app.run('generatedContinuationError(LEVELS[4],getRows())'),/transformation.*immediately/);
  assert.equal(app.run('checkSolution(LEVELS[4],getCodeFromEditor()).ok'),false);
  assert.deepEqual(app.read('functionUsage(LEVELS[4],getCodeFromEditor())'),app.read('stock'));
});

test('text and completion reject postponed combinators while preserving the authored draft',()=>{
  const app=game();
  app.run(`currentLevel=4;iconMode=false;textDrafts[4]=${JSON.stringify(deferred)};`);
  assert.equal(app.run('typeCheck(LEVELS[4],getTextSource()).ok'),true);
  assert.match(app.run('checkSolution(LEVELS[4],getTextSource()).msg'),/immediately following row/);
  assert.match(app.run('getTextError()'),/immediately following row/);
  assert.equal(app.run('getTextSource()'),deferred);
  app.run('completedLevels.add(4);completedLevels.add(0);saveProgress();');
  const saved=app.saved();delete saved.continuationVersion;
  const restored=game(saved);
  assert.equal(restored.run('completedLevels.has(4)'),false);
  assert.equal(restored.run('completedLevels.has(0)'),true);
  assert.equal(restored.run('getTextSource()'),deferred);
  assert.equal(restored.saved().continuationVersion,1);
});

test('generated combinators cannot be manually placed as arguments or in another row',()=>{
  const app=game();
  app.run(`currentLevel=7;rowPrograms[7]=prepareIconRows(LEVELS[7],
    [{id:'r1',expr:'(>>>) f2'}]);diagnoseRows();const before=JSON.stringify(getRows());`);
  assert.deepEqual(app.read('availableGeneratedFunctions()'),[]);
  for(const [index,slot] of [[1,false],[1,true],[3,false],[3,true]]) {
    assert.match(app.run(`placeWithContinuation(LEVELS[7],getRows(),${index},'r1',${slot}).error`),/automatically in the next row/);
  }
  assert.equal(app.run('JSON.stringify(getRows())'),app.run('before'));
  assert.equal(app.run('continuationSource(getRows(),1)'),'r1');
});

test('a combinator cannot consume the final value slot as its continuation',()=>{
  const app=game();
  app.run(`currentLevel=7;const last=rowSlotCount(LEVELS[7])-2;
    rowPrograms[7]=placeWithContinuation(LEVELS[7],getRows(),last,'(>>>)').rows;
    const before=JSON.stringify(getRows());`);
  assert.match(app.run("placeWithContinuation(LEVELS[7],getRows(),last,'f2',true).error"),/another construction row/);
  assert.equal(app.run('JSON.stringify(getRows())'),app.run('before'));
  assert.equal(app.run('getRows().at(-1).expr'),'');
});

test('an unfinished new head keeps selection even when the next row has a pending head',()=>{
  const app=game();
  app.run(`currentLevel=7;rowPrograms[7]=[{id:'r1',expr:''},{id:'r2',expr:'(>>>)'}];
    const head=placeWithContinuation(LEVELS[7],getRows(),0,'(>>>)');rowPrograms[7]=head.rows;`);
  assert.equal(app.run('head.activeRow'),0);
  app.run("const filled=placeWithContinuation(LEVELS[7],getRows(),0,'f2',true);");
  assert.equal(app.run('filled.activeRow'),1);
  assert.equal(app.run('filled.rows[1].expr'),'r1');
});
