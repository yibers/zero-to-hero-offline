const {test} = require('node:test');
const assert = require('node:assert/strict');
const {game} = require('./helpers/game-harness.cjs');

test('every reference uses the supported LNF form and solves in both editor modes',()=>{
  const app=game();
  assert.deepEqual(app.read(`LEVELS.flatMap((level,index)=>{
    const failures=[];
    for(const icons of [true,false]) {
      currentLevel=index;iconMode=icons;setEditorContent(level.solution);
      if(getRowError()||!checkSolution(level,getCodeFromEditor()).ok)failures.push([level.level,icons]);
    }
    return failures;
  })`),[]);
  assert.equal(app.run('checkSolution(LEVELS[15],"wrap value").ok'),true);
  assert.equal(app.run('checkSolution(LEVELS[0],"f z").ok'),true);
});

test('text validation and completion reject non-LNF and unsupported constructs',()=>{
  const app=game();app.run('currentLevel=1;iconMode=false;');
  for(const code of [
    'mkHero (runZero z)',
    '(.) mkHero runZero',
    'mkHero . runZero',
    'runZero `mkHero` z',
    'runZero z where other = z',
    'let step = \\x -> mkHero x in step z',
    '(\\x -> mkHero x) z',
    'mkHero 42',
    'mkHero "hello"',
    'let r1 = let r2 = runZero z in r2 in mkHero r1',
    'if z then runZero else mkHero',
    'let r1 = r2 runZero; r2 = (.) mkHero in r1 z',
    'let r1 = r1 runZero in r1 z'
  ]) {
    app.run(`setEditorContent(${JSON.stringify(code)});textDrafts[1]=${JSON.stringify(code)};`);
    assert.ok(app.run('getTextError()'),code);
    assert.equal(app.run('checkSolution(LEVELS[1],getCodeFromEditor()).ok'),false,code);
    assert.equal(app.run('getTextSource()'),code,'draft remains editable');
  }
  // Even an explicitly supplied application operator must use prefix rows.
  assert.match(app.run(`RowProgram.validate([{id:'r1',expr:'mkHero $ z'}],
    {...LEVELS[1],funcs:[...LEVELS[1].funcs,{name:'($)',sig:'(a -> b) -> a -> b'}]})[0]`),/LNF.*prefix/);
});

test('Haskell keywords cannot become row names, while ordinary identifiers retain their meaning',()=>{
  const app=game();app.run('currentLevel=1;iconMode=false;');
  for(const name of ['where','case','do','data','if','type','class','module']) {
    const code=`let ${name} = (.) mkHero; r2 = ${name} runZero in r2 z`;
    app.run(`setEditorContent(${JSON.stringify(code)});`);
    assert.match(app.run('getTextError()'),/Haskell keyword/);
    assert.equal(app.run('checkSolution(LEVELS[1],getCodeFromEditor()).ok'),false);
  }
  const code="let somewhere = (.) mkHero; where' = somewhere runZero in where' z";
  app.run(`setEditorContent(${JSON.stringify(code)});`);
  assert.equal(app.run('getTextError()'),null);
  assert.equal(app.run('checkSolution(LEVELS[1],getCodeFromEditor()).ok'),true);
});

test('legacy calls normalize to LNF in icon mode while unsupported drafts survive reload',()=>{
  const app=game();app.run("currentLevel=1;setEditorContent('mkHero (runZero z)');diagnoseRows();");
  assert.deepEqual(app.read('getRows().filter(r=>r.expr).map(r=>RowProgram.call(r.expr)?.args.length)'),[1,1]);
  // This is syntactically LNF after conversion, but fails the separate puzzle
  // rules: construction uses z early and omits the required composition.
  assert.deepEqual(app.read('RowProgram.validate(getRows().slice(0,-1),LEVELS[1])'),[null,null]);
  assert.equal(app.run('checkSolution(LEVELS[1],getCodeFromEditor()).ok'),false);
  app.run("iconMode=false;textDrafts[1]='runZero z where other = z';saveProgress();");
  const restored=game(app.saved());
  assert.equal(restored.run('getTextSource()'),'runZero z where other = z');
  assert.match(restored.run('getTextError()'),/LNF.*where/);
});
