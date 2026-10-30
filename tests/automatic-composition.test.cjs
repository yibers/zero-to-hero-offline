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

test('only lessons whose sole combinator is standard composition get automatic heads',()=>{
  const app=game();
  assert.deepEqual(app.read('LEVEL_ORDER.map(i=>LEVELS[i]).filter(automaticCombinator).map(l=>l.level)'),[3,4,5,6,7,8,10,16,17,21]);
  for(let i=0;i<app.run('LEVELS.length');i++) {
    app.run(`currentLevel=${i};`);prepare(app);
    const auto=app.run('!!automaticCombinator(LEVELS[currentLevel])');
    assert.equal(app.run('getRows()[0].expr'),auto?app.run('automaticCombinator(LEVELS[currentLevel])'):'');
    assert.equal(app.run('getRows().length'),app.run('rowSlotCount(LEVELS[currentLevel])'));
    const hasChoices=app.run('LEVELS[currentLevel].funcs.some(f=>isRowCombinator(parseType(f.sig)))')&&!auto;
    assert.equal(palette(app).includes('aria-label="Combinators"'),hasChoices);
    if(auto) {
      assert.doesNotMatch(palette(app),/data-func-name="\(\.\)"/);
      assert.equal(app.run('functionUsage(LEVELS[currentLevel],getCodeFromEditor()).find(f=>f.name===automaticCombinator(LEVELS[currentLevel])).used'),1);
    }
  }
});

test('automatic standard-composition lessons solve by selecting only supplied arguments',()=>{
  const {solveIconLevel}=require('./helpers/solve-icon-level.cjs');
  const app=game();
  for(const index of app.read('LEVELS.flatMap((level,i)=>automaticCombinator(level)?[i]:[])')) {
    const result=solveIconLevel(app,index);
    assert.deepEqual(result.failures,[]);
    assert.equal(result.placements,app.run('LEVELS[currentLevel].funcs.filter(f=>f.name!==automaticCombinator(LEVELS[currentLevel])).reduce((n,f)=>n+f.uses,0)'));
  }
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
  assert.deepEqual(app.read('getRows().map(r=>r.expr)'),['(.)','','','','']);
  assert.equal(app.run('continuationSource(getRows(),3)'),null);
  app.run("currentLevel=1;rowPrograms[1]=[{id:'r1',expr:'(.) mkHero'},{id:'r2',expr:'(.)'}];");prepare(app);
  assert.deepEqual(app.read('getRows().map(r=>r.expr)'),['(.) mkHero','r1','']);
  assert.equal(app.run('functionUsage(LEVELS[1],getCodeFromEditor()).find(f=>f.name===automaticCombinator(LEVELS[currentLevel])).used'),1);
});

test('mixed-combinator lessons retain their choices even after one kind is exhausted, and text mode stays manual',()=>{
  const app=game();app.run("currentLevel=7;setEditorContent('fmap bd');");prepare(app);
  assert.equal(app.run('getRows()[1].expr'),'_ r1');
  assert.match(palette(app),/aria-label="Combinators"/);
  app.run("currentLevel=1;iconMode=false;setEditorContent('');");
  assert.equal(app.run('getTextSource()'),'');
  assert.match(palette(app),/data-func-name="\(\.\)"/);
  app.run('iconMode=true;');prepare(app);
  assert.equal(app.run('getRows()[0].expr'),'(.)');
  assert.doesNotMatch(palette(app),/aria-label="Combinators"/);
});

const manualSingleCombinatorLevels=[13,14,18,20,24,25];

test('other sole combinators start in the palette and clear level returns them there',()=>{
  const app=game();
  for(const number of manualSingleCombinatorLevels){
    app.run(`currentLevel=LEVELS.findIndex(l=>l.level===${number});`);prepare(app);
    assert.equal(app.run('getRows().every(r=>!r.expr)'),true);
    assert.equal(app.run('functionUsage(LEVELS[currentLevel],getCodeFromEditor()).every(f=>f.used===0)'),true);
    assert.match(palette(app),/aria-label="Combinators"/);
    const head=app.run('LEVELS[currentLevel].funcs.find(f=>isRowCombinator(parseType(f.sig))).name');
    app.run(`rowPrograms[currentLevel]=placeWithContinuation(LEVELS[currentLevel],getRows(),0,${JSON.stringify(head)}).rows;persistRows();`);
    const restored=game(app.saved());prepare(restored);
    assert.equal(restored.run('getRows()[0].expr'),head);
    // Manually chosen heads remain removable rather than locked as defaults.
    restored.run('rowPrograms[currentLevel]=prepareIconRows(LEVELS[currentLevel],clearedRows(getRows(),0));');
    assert.equal(restored.run('getRows()[0].expr'),'');
    app.run('clearLevel();');prepare(app);
    assert.equal(app.run('getRows().every(r=>!r.expr)'),true);
    assert.equal(app.run('activeRow'),0);
  }
});

test('old untouched nonstandard automatic heads are removed once without changing other progress',()=>{
  const seed=game();seed.run('saveProgress();');const saved=seed.saved();delete saved.automaticHeadVersion;
  saved.completed=[0];saved.currentLevel=seed.run('LEVELS.findIndex(l=>l.level===13)');
  for(const number of manualSingleCombinatorLevels){
    seed.run(`currentLevel=LEVELS.findIndex(l=>l.level===${number});`);
    const index=seed.run('currentLevel');
    seed.run(`rowPrograms[currentLevel]=automaticRows(LEVELS[currentLevel],[{id:'r1',expr:LEVELS[currentLevel].funcs.find(f=>isRowCombinator(parseType(f.sig))).name}]);`);
    saved.rowPrograms[index]=seed.read('getRows()');
    saved.editorContents[index]=seed.run('LEVELS[currentLevel].lhs')+' '+(number%2?'undefined':seed.run('RowProgram.source(getRows())'));
  }
  const restored=game(saved);prepare(restored);
  assert.equal(restored.run('LEVELS[currentLevel].level'),13);
  assert.equal(restored.run('getRows().every(r=>!r.expr)'),true);
  assert.deepEqual(restored.read('[...completedLevels]'),[0]);
  for(const number of manualSingleCombinatorLevels){
    restored.run(`currentLevel=LEVELS.findIndex(l=>l.level===${number});`);prepare(restored);
    assert.equal(restored.run('getRows().every(r=>!r.expr)'),true);
  }
  assert.equal(restored.saved().automaticHeadVersion,1);
  const again=game(restored.saved());again.run('saveProgress();');
  assert.deepEqual(again.saved(),restored.saved());
});

test('automatic-head migration preserves partial work, completed solutions and authored text',()=>{
  const seed=game();seed.run('saveProgress();');const saved=seed.saved();delete saved.automaticHeadVersion;
  const index=seed.run('LEVELS.findIndex(l=>l.level===13)');saved.currentLevel=index;
  const variants=[
    {rows:[{id:'r1',expr:'(>>>) runZero'},{id:'r2',expr:'r1'},{id:'r3',expr:'',automatic:true}],icons:true},
    {rows:[{id:'r1',expr:'(>>>)'},{id:'r2',expr:''},{id:'r3',expr:'',automatic:true}],icons:false},
    {rows:[{id:'r1',expr:'(>>>)'},{id:'r2',expr:''},{id:'r3',expr:'',automatic:true}],icons:true,text:'let\n  r1 = (>>>)\nin\n  _'},
    {rows:seed.read(`RowProgram.migrate(LEVELS[${index}].solution)`),icons:true,complete:true}
  ];
  for(const variant of variants){
    const fixture=JSON.parse(JSON.stringify(saved));fixture.iconMode=variant.icons;
    fixture.rowPrograms[index]=variant.rows;
    if(variant.text)fixture.textDrafts[index]=variant.text;
    if(variant.complete)fixture.completed=[index];
    const restored=game(fixture);
    assert.deepEqual(restored.saved().rowPrograms[index],variant.rows);
    assert.deepEqual(restored.saved().textDrafts,fixture.textDrafts);
    assert.deepEqual(restored.saved().completed,fixture.completed);
  }
});
