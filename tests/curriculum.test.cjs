const {test}=require('node:test');
const assert=require('node:assert/strict');
const {game}=require('./helpers/game-harness.cjs');
const oldLevels=require('./fixtures/levels-before-curriculum.json');
const order=[
  'wrap-value','change-wrapper','compose-two','make-pair','match-types',
  'compose-three','rearrange-slots','longer-composition','select-pair','nested-pairs',
  'map-wrapper','concrete-conversion','compose-forward','map-last','map-middle',
  'stored-application','curried-application','map-function','shared-input','reverse-applicative',
  'flatten-wrappers','reverse-arguments','bind','compose-wrapped','chain-wrapped'
];
const rename=source=>source.replaceAll('(<$>)','fmap');

test('introductions precede synthesis, titles identify the lesson, and old puzzle identities remain stable',()=>{
  const app=game();
  assert.deepEqual(app.read('LEVEL_ORDER.map(i=>LEVELS[i].id)'),order);
  assert.equal(app.run('new Set(LEVELS.map(l=>l.name)).size'),25);
  assert.equal(app.run('LEVELS.every(l=>l.objective && l.name.length < 35)'),true);
  assert.deepEqual(app.read('LEVELS.map(l=>l.level).sort((a,b)=>a-b)'),Array.from({length:25},(_,i)=>i+1));
  oldLevels.forEach((old,index)=>{
    if (![7,11,12].includes(index)) assert.equal(app.run(`LEVELS[${index}].target`),old.target);
    assert.equal(app.run(`checkSolution(LEVELS[${index}],LEVELS[${index}].solution).ok`),true);
  });
  // The first mapping lesson uses the same name as both later contexts.
  assert.deepEqual(app.read('LEVEL_ORDER.map(i=>LEVELS[i]).filter(l=>l.funcs.some(f=>f.name==="fmap")).map(l=>l.level)'),[11,13,14,15,18,19]);
  assert.equal(app.run('LEVELS.some(l=>l.funcs.some(f=>f.name==="(<$>)"))'),false);
});

for(const icons of [true,false])test(`curriculum migration keeps all solved work with its puzzle in ${icons?'icon':'text'} mode`,()=>{
  const source=game();source.run('saveProgress();');
  const saved=source.saved();delete saved.curriculumVersion;delete saved.forwardVersion;
  saved.currentLevel=7;saved.iconMode=icons;saved.completed=oldLevels.map((_,i)=>i);
  oldLevels.forEach((old,i)=>{
    saved.editorContents[i]=old.lhs+' '+old.solution;
    saved.textDrafts[i]=old.solution;
    saved.rowPrograms[i]=source.read(`RowProgram.migrate(${JSON.stringify(old.solution)})`);
  });
  const app=game(saved);
  assert.equal(app.run('LEVELS[currentLevel].id'),'map-middle');
  assert.equal(app.run('levelProgressLabel()'),'Level 15 / 25');
  assert.equal(app.run('iconMode'),icons);
  assert.deepEqual(app.read('[...completedLevels]'),saved.completed.filter(i=>![7,11,12].includes(i)));
  oldLevels.forEach((old,i)=>{
    app.run(`currentLevel=${i};`);
    if ([7,11,12].includes(i)) {
      assert.equal(app.saved().textDrafts[i],rename(old.solution));
      assert.equal(app.run('getRows().every(r=>!r.expr)'),true);
    } else {
      assert.equal(app.run('checkSolution(LEVELS[currentLevel],getCodeFromEditor()).ok'),true);
      if (!old.solution.includes('(.)')) assert.equal(app.saved().textDrafts[i],rename(old.solution));
      else assert.doesNotMatch(app.run('getCodeFromEditor()'),/\(\.\)/);
    }
  });
  assert.equal(app.saved().curriculumVersion,1);
  const again=game(app.saved());again.run('saveProgress();');
  assert.deepEqual(again.saved(),app.saved());
  // Existing completions never grant the new introductions an achievement.
  app.run('currentLevel=LEVEL_ORDER.at(-1);nextLevel();');
  assert.equal(app.run('showComplete'),false);
  assert.equal(app.run('LEVELS[currentLevel].id'),'compose-three');
  app.run('prevLevel();');assert.equal(app.run('LEVELS[currentLevel].id'),'match-types');
});

test('renaming map retains unfinished text when the redesigned wrapper lesson starts clean',()=>{
  const seed=game();seed.run('saveProgress();');const saved=seed.saved();delete saved.curriculumVersion;delete saved.forwardVersion;
  saved.currentLevel=12;saved.iconMode=false;
  saved.editorContents={12:'zeroToHero z = let\n  r1 = (<$>) swap\n  r2 = (.) r1\nin\n  _',0:'zeroToHero z = f'};
  saved.textDrafts={12:'let\n  r1 = (<$>) swap\n  r2 = (.) r1\nin\n  _',14:'let\n  r1 = (<$>)\nin\n  _',0:'f'};
  saved.rowPrograms={12:[{id:'r1',expr:'(<$>) swap'},{id:'r2',expr:'(.) r1'}]};
  const app=game(saved);
  assert.equal(app.run('currentLevel'),12);
  assert.equal(app.run('getTextSource()'),rename(saved.textDrafts[12]));
  assert.equal(app.run('getRows().every(r=>!r.expr)'),true);
  assert.equal(app.saved().textDrafts[14],rename(saved.textDrafts[14]));
  assert.equal(app.saved().textDrafts[0],'f');
  app.run('iconMode=true;rowPrograms[currentLevel]=prepareIconRows(LEVELS[currentLevel],getRows());');
  assert.equal(app.run('getRows().every(r=>!r.expr)'),true);
  app.run('iconMode=false;');
  assert.equal(app.run('getTextSource()'),rename(saved.textDrafts[12]));
});

test('the new one-card lessons select their value automatically and describe its actual type',()=>{
  const app=game();
  for(const id of ['select-pair','concrete-conversion']){
    app.run(`currentLevel=LEVELS.findIndex(l=>l.id===${JSON.stringify(id)});`);
    const name=app.run('LEVELS[currentLevel].funcs[0].name');
    app.run(`rowPrograms[currentLevel]=placeWithContinuation(LEVELS[currentLevel],getRows(),0,${JSON.stringify(name)}).rows;diagnoseRows();`);
    assert.equal(app.run('getRows().length'),1);
    assert.equal(app.run('getRows()[0].automaticInput'),true);
    assert.equal(app.run('checkSolution(LEVELS[currentLevel],getCodeFromEditor()).ok'),true);
    assert.doesNotMatch(app.run('LEVEL_ICONS[LEVELS[currentLevel].level].z'),/starting Zero|before it is wrapped/);
  }
});
