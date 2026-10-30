const {test}=require('node:test');
const assert=require('node:assert/strict');
const {game}=require('./helpers/game-harness.cjs');
const before=require('./fixtures/levels-before-forward.json');
const redesigned=[11,13,15,23];

function legacySave(icons=true) {
  const seed=game();seed.run('saveProgress();');const saved=seed.saved();
  delete saved.forwardVersion;saved.iconMode=icons;saved.geckoOn=false;
  saved.currentLevel=7;saved.completed=before.map((_,i)=>i);
  before.forEach((level,i)=>{
    saved.editorContents[i]=level.lhs+' '+level.solution;
    saved.textDrafts[i]=level.solution;
    saved.rowPrograms[i]=seed.read(`RowProgram.migrate(${JSON.stringify(level.solution)})`);
  });
  return saved;
}

test('forward composition is the only supplied ordinary composition, and redesigns isolate their concepts',()=>{
  const app=game();
  assert.equal(app.run("LEVELS.some(l=>l.funcs.some(f=>f.name==='(.)'))"),false);
  const goals={11:'Hero (a, b) -> Hero (b, a)',13:'Hero B -> Hero D',15:'Zero a c B -> Hero D a c',23:'Hero a -> Hero (a, a)'};
  for(const old of before){
    const i=before.indexOf(old), level=app.read(`LEVELS[${i}]`);
    assert.equal(level.id,old.id);assert.equal(level.level,old.level);
    assert.equal(level.target,goals[level.level]||old.target);
    assert.equal(app.run(`checkSolution(LEVELS[${i}],LEVELS[${i}].solution).ok`),true);
  }
  for(const [number,names] of [[11,['swap','fmap']],[13,['bd','fmap']],[15,['bd','fmap','f1','f2','(>>>)']],[23,['dup','(>>=)','flip']]]){
    assert.deepEqual(app.read(`LEVELS.find(l=>l.level===${number}).funcs.map(f=>f.name)`),names);
  }
});

// Evaluate the old and migrated composition trees with deliberately noncommuting
// functions, independently of type inference and the reference solution strings.
function evaluate(app,source,names) {
  const env={'.':last=>first=>x=>last(first(x)), '>>>':first=>last=>x=>last(first(x)), flip:f=>b=>a=>f(a)(b),z:'value'};
  for(const name of names)env[name]=x=>`${name}(${x})`;
  const program=app.read(`RowProgram.parseLet(${JSON.stringify(source)})`);
  function run(node){
    if(node.kind==='name')return env[node.name];
    assert.equal(node.kind,'app');return node.args.reduce((fn,arg)=>fn(run(arg)),run(node.fn));
  }
  for(const row of program.bindings)env[row.id]=run(app.read(`RowProgram.parse(${JSON.stringify(row.expr)})`));
  return run(app.read(`RowProgram.parse(${JSON.stringify(program.final)})`));
}

test('migration reverses full composition arguments and reassociates longer chains without changing execution',()=>{
  const app=game();
  for(const [i,old] of before.entries()){
    if(redesigned.includes(old.level)||!old.funcs.some(f=>f.name==='(.)'))continue;
    const migrated=app.run(`forwardCompositionSource(${JSON.stringify(old.solution)})`);
    assert.equal(app.run(`checkSolution(LEVELS[${i}],${JSON.stringify(migrated)}).ok`),true,`level ${old.level}`);
    const names=old.funcs.map(f=>f.name).filter(n=>n!=='(.)'&&n!=='flip');
    assert.equal(evaluate(app,migrated,names),evaluate(app,old.solution,names),`level ${old.level}`);
  }
  assert.equal(app.run("forwardCompositionSource('let r1 = (.) mkHero in r1')"),null);
});

for(const icons of [true,false])test(`all old completed saves migrate once, preserving unchanged achievements in ${icons?'icon':'text'} mode`,()=>{
  const saved=legacySave(icons), app=game(saved);
  assert.equal(app.run('currentLevel'),7);assert.equal(app.run('iconMode'),icons);
  assert.equal(app.saved().geckoOn,false);
  assert.deepEqual(app.read('[...completedLevels]'),before.flatMap((l,i)=>redesigned.includes(l.level)?[]:[i]));
  for(const [i,old] of before.entries()){
    app.run(`currentLevel=${i};`);
    if(redesigned.includes(old.level)){
      assert.equal(app.saved().textDrafts[i],old.solution);
      assert.equal(app.run('getRows().every(r=>!r.expr)'),true);
    }else{
      assert.equal(app.run('checkSolution(LEVELS[currentLevel],getCodeFromEditor()).ok'),true,`level ${old.level}`);
      if(!old.funcs.some(f=>f.name==='(.)'))assert.deepEqual(app.saved().rowPrograms[i],saved.rowPrograms[i]);
    }
  }
  assert.equal(app.saved().forwardVersion,1);
  const again=game(app.saved());again.run('saveProgress();');assert.deepEqual(again.saved(),app.saved());
});

test('partial and malformed old drafts remain editable while icon rows start with usable supplies',()=>{
  for(const draft of ['let r1 = (.) mkHero in _','let unfinished =']){
    const saved=legacySave();saved.currentLevel=1;saved.textDrafts[1]=draft;
    const app=game(saved);
    app.run('rowPrograms[1]=prepareIconRows(LEVELS[1],getRows());');
    assert.deepEqual(app.read('getRows().map(r=>r.expr)'),['(>>>)','','']);
    assert.equal(app.run('completedLevels.has(1)'),false);
    app.run('iconMode=false;');assert.equal(app.run('getTextSource()'),draft);
  }
});

test('an untouched old automatic head becomes the forward default without reviving a draft',()=>{
  const saved=legacySave();saved.currentLevel=1;delete saved.textDrafts[1];
  saved.rowPrograms[1]=[{id:'r1',expr:'(.)'},{id:'r2',expr:''},{id:'r3',expr:'',automatic:true}];
  saved.completed=saved.completed.filter(i=>i!==1);
  const app=game(saved);app.run('rowPrograms[1]=prepareIconRows(LEVELS[1],getRows());');
  assert.deepEqual(app.read('getRows().map(r=>r.expr)'),['(>>>)','','']);
  assert.equal(app.run('textDrafts[1]'),undefined);
});

test('already compatible solutions to redesigned puzzles survive the one-time upgrade',()=>{
  const saved=legacySave(), seed=game();
  for(const [i,old] of before.entries())if(redesigned.includes(old.level)){
    const solution=seed.run(`LEVELS[${i}].solution`);
    saved.textDrafts[i]=solution;saved.editorContents[i]=old.lhs+' '+solution;
    saved.rowPrograms[i]=seed.read(`RowProgram.migrate(${JSON.stringify(solution)})`);
  }
  const app=game(saved);
  assert.equal(app.run('completedLevels.size'),25);
});
