const {test}=require('node:test');
const assert=require('node:assert/strict');
const {game}=require('./helpers/game-harness.cjs');
const oldLevels=require('./fixtures/levels-before-carry.json');

function mapped() {
  const app=game();
  app.run("currentLevel=7;rowPrograms[7]=prepareIconRows(LEVELS[7],[{id:'r1',expr:'fmap'}]);rememberRows();const mapped=placeWithContinuation(LEVELS[7],getRows(),0,'bd',true);rowPrograms[7]=mapped.rows;diagnoseRows();persistRows();");
  return app;
}

test('a carried transformation is fixed while its next combinator can be selected, cleared, and replaced',()=>{
  const app=mapped();
  assert.equal(app.run('mapped.activeRow'),1);
  assert.equal(app.run('getRows()[1].expr'),'_ r1');
  assert.equal(app.run('rowDependencySource(getRows(),1)'),'r1');
  assert.equal(app.run('continuationSource(getRows(),1)'),null);
  assert.match(app.run("placeWithContinuation(LEVELS[7],getRows(),1,'f1',true).error"),/continues the previous row/);
  assert.equal(app.run('clearedRows(getRows(),1,true)[1].expr'),'_ r1');
  app.run("const chosen=placeWithContinuation(LEVELS[7],getRows(),1,'(.)');rowPrograms[7]=chosen.rows;");
  assert.equal(app.run('chosen.activeRow'),2);
  assert.equal(app.run('getRows()[1].expr'),'(.) r1');
  assert.equal(app.run('getRows()[2].expr'),'r2');
  app.run('rowPrograms[7]=prepareIconRows(LEVELS[7],clearedRows(getRows(),1));');
  assert.equal(app.run('getRows()[0].expr'),'fmap bd');
  assert.equal(app.run('getRows()[1].expr'),'_ r1');
  assert.equal(app.run('getRows()[2].expr'),'');
  assert.equal(app.run('functionUsage(LEVELS[7],getCodeFromEditor()).find(f=>f.name==="(.)").remaining'),1);
  app.run("rowPrograms[7]=placeWithContinuation(LEVELS[7],getRows(),1,'(>>>)').rows;");
  assert.equal(app.run('getRows()[1].expr'),'(>>>) r1');
  assert.equal(app.run('getRows()[2].expr'),'r2');
});

test('incompatible combinators cannot overwrite a carried transformation or consume inventory',()=>{
  const app=mapped(), before=app.read('getRows()');
  assert.match(app.run("placeWithContinuation(LEVELS[7],getRows(),1,'fmap').error"),/No copies left|Type mismatch/);
  assert.deepEqual(app.read('getRows()'),before);
  assert.match(app.run("placeWithContinuation(LEVELS[7],getRows(),1,'f1').error"),/takes a value/);
  assert.deepEqual(app.read('getRows()'),before);
  assert.match(app.run("placeWithContinuation(LEVELS[7],getRows(),2,'r1',true).error"),/continue automatically/);
});

test('pending carried arguments survive refresh and mode switches, and undo restores one complete action',()=>{
  const app=mapped(), saved=game(app.saved());
  saved.run('rowPrograms[7]=prepareIconRows(LEVELS[7],getRows());diagnoseRows();');
  assert.deepEqual(saved.read('getRows()'),app.read('getRows()'));
  saved.run('iconMode=false;const draft=getTextSource();setEditorContent(draft);iconMode=true;rowPrograms[7]=prepareIconRows(LEVELS[7],getRows());');
  assert.equal(saved.run('getRows()[1].expr'),'_ r1');
  assert.equal(saved.run('continuationArgument(getRows(),1)'),'r1');
  app.run('rowPrograms[7]=prepareIconRows(LEVELS[7],JSON.parse(rowHistory.get(7).undo.at(-1)));');
  assert.equal(app.run('getRows()[0].expr'),'fmap');
  assert.equal(app.run('getRows()[1].expr'),'');
  assert.equal(app.run('functionUsage(LEVELS[7],getCodeFromEditor()).find(f=>f.name==="bd").remaining'),1);
});

test('automatic composition cascades skip completed rows and focus the next actual choice',()=>{
  const app=game();
  app.run("currentLevel=5;rowPrograms[5]=prepareIconRows(LEVELS[5],[{id:'r1',expr:''}]);rowPrograms[5]=placeWithContinuation(LEVELS[5],getRows(),0,'f3',true).rows;const carried=placeWithContinuation(LEVELS[5],getRows(),1,'f1',true);rowPrograms[5]=carried.rows;diagnoseRows();");
  assert.equal(app.run('carried.activeRow'),3);
  assert.deepEqual(app.read('getRows().map(r=>r.expr)'),['(.) f3','r1 f1','(.) r2','r3','']);
  assert.equal(app.run('continuationArgument(getRows(),2)'),'r2');
  assert.equal(app.run('continuationSource(getRows(),3)'),'r3');
  assert.equal(app.run('getRows().at(-1).expr'),'');
  assert.deepEqual(app.read('availableGeneratedFunctions()'),[]);
});

test('the text checker rejects deferred transformations even when Haskell types and exact supplies match',()=>{
  const app=game(), old=oldLevels.find(l=>l.level===6);
  app.run(`currentLevel=4;iconMode=false;textDrafts[4]=${JSON.stringify(old.solution)};`);
  assert.equal(app.run('typeCheck(LEVELS[4],getTextSource()).ok'),true);
  assert.match(app.run('checkSolution(LEVELS[4],getTextSource()).msg'),/transformation.*immediately following row/);
  assert.match(app.run('getTextError()'),/transformation.*immediately following row/);
});

test('redesigned lessons recheck achievements once while retaining every old draft and preference',()=>{
  const source=game();source.run('saveProgress();');const saved=source.saved();
  delete saved.carryVersion;saved.currentLevel=6;saved.completed=[0,4,6,7,12,13,14];
  for(const level of oldLevels){
    const index=level.level-2;
    saved.editorContents[index]=level.lhs+' '+level.solution;
    saved.textDrafts[index]=level.solution;
    saved.rowPrograms[index]=source.read(`RowProgram.migrate(${JSON.stringify(level.solution)})`);
  }
  for(const icons of [true,false]){
    saved.iconMode=icons;const restored=game(saved);
    assert.deepEqual(restored.read('[...completedLevels]'),[0,12]);
    for(const field of ['editorContents','rowPrograms','textDrafts'])assert.deepEqual(restored.saved()[field],saved[field]);
    assert.equal(restored.saved().carryVersion,1);
    restored.run('getRows();iconMode=false;');
    assert.equal(restored.run('getTextSource()'),oldLevels.find(l=>l.level===8).solution);
    const again=game(restored.saved());again.run('saveProgress();');
    assert.deepEqual(again.saved(),restored.saved());
  }
});

test('new prefix operators have their standard function and Hero specializations',()=>{
  const app=game();
  app.run(`const operators={
    '>>>':parseType('(a -> b) -> (b -> c) -> a -> c'),
    '>=>':parseType('(a -> Hero b) -> (b -> Hero c) -> a -> Hero c'),
    '<**>':parseType('Applicative f => f a -> f (a -> b) -> f b')
  };
  const opInfer=(code,params)=>typeToString(inferExpr(code,operators,Object.fromEntries(Object.entries(params).map(([name,type])=>[name,parseType(type)]))));`);
  assert.equal(app.run("opInfer('(>>>) first second',{first:'A -> B',second:'B -> C'})"),'A -> C');
  assert.equal(app.run("opInfer('(>=>) first second',{first:'A -> Hero B',second:'B -> Hero C'})"),'A -> Hero C');
  assert.equal(app.run("opInfer('(<**>) value fn',{value:'R -> A',fn:'R -> A -> B'})"),'R -> B');
  assert.equal(app.run("opInfer('(<**>) value fn',{value:'Hero A',fn:'Hero (A -> B)'})"),'Hero B');
  assert.throws(()=>app.run("opInfer('(<**>) value fn',{value:'Zero A',fn:'Zero (A -> B)'})"),/Type mismatch/);
  assert.throws(()=>app.run("opInfer('(>=>) first second',{first:'A -> Hero B',second:'C -> Hero D'})"),/Type mismatch/);
  for(const op of ['>>>','>=>','<**>'])assert.deepEqual(app.read(`RowProgram.call('(${op}) f')`),{name:op,args:['f'],infix:false});
});
