const { test } = require('node:test');
const assert = require('node:assert/strict');
const { game } = require('./helpers/game-harness.cjs');
function palette(app) {
  app.nodes['function-palette'] = { dataset: {}, innerHTML: '', querySelectorAll: () => [] };
  app.run('diagnoseRows(); updateFunctionPalette(LEVELS[currentLevel],getCodeFromEditor());');
  return app.nodes['function-palette'].innerHTML;
}
function kind(html, name) {
  const card = [...html.matchAll(/<div class="func-card[^>]+>/g)].map(m => m[0])
    .find(c => c.includes(`data-func-name="${name}"`));
  return card && { kind: card.match(/data-card-kind="([^"]+)"/)[1], drag: card.includes('draggable="true"') };
}

test('palette splits map-then-rotate lesson by usable function type and restricts dragging to combinators', () => {
  const app = game(); app.run('currentLevel=7;');
  const html = palette(app);
  assert.match(html, /aria-label="Combinators"/);
  assert.match(html, /aria-label="Transformations"/);
  for (const name of ['(>>>)', 'fmap']) assert.deepEqual(kind(html, name.replaceAll('>', '&gt;')), {kind:'combinator',drag:true});
  for (const name of ['bd', 'f1', 'f2']) assert.deepEqual(kind(html, name.replaceAll('>', '&gt;')), {kind:'transformation',drag:false});
});

test('generated functions stay attached to rows and never return to the palette independently', () => {
  const app=game(); app.run("currentLevel=7;setEditorContent('fmap bd');");
  assert.equal(kind(palette(app),'r1'),undefined);
  app.run("rowPrograms[7]=placeInFixedRow(LEVELS[7],getRows(),1,'(>>>)').rows; rowPrograms[7]=placeInFixedRow(LEVELS[7],getRows(),1,'r1',true).rows;");
  const combined=palette(app);
  assert.equal(kind(combined,'r1'),undefined);
  assert.equal(kind(combined,'r2'),undefined);
  app.run('rowPrograms[7]=prepareIconRows(LEVELS[7],getRows());');
  assert.equal(app.run('getRows()[2].expr'),'r2');
  app.run('rowPrograms[7]=automaticRows(LEVELS[7],clearedRows(getRows(),1));');
  assert.equal(kind(palette(app),'r1'),undefined);
  assert.equal(app.run('getRows()[1].expr'),'_ r1');
});

test('every construction head in every reference solution is classified as draggable', () => {
  const app=game();
  assert.deepEqual(app.read(`LEVELS.flatMap(level=>{
    const {env,params}=functionProgramContext(level), failures=[];
    const rows=RowProgram.migrate(level.solution);
    for(const row of rows.slice(0,-1)) {
      const call=RowProgram.call(row.expr);
      if(!isRowCombinator(inferExpr(RowProgram.print({kind:'name',name:call.name}),env,params))) failures.push([level.level,row.id]);
      env[row.id]=inferExpr(row.expr,env,params);
    }
    return failures;
  })`),[]);
});

test('single-transformation introductory levels remain usable by selection without dragging',()=>{
  const app=game();
  for(const number of [1,2]) {
    app.run(`currentLevel=LEVELS.findIndex(l=>l.level===${number});`);
    const name=app.run('LEVELS[currentLevel].funcs[0].name');
    assert.deepEqual(kind(palette(app),name),{kind:'transformation',drag:false});
    app.run(`rowPrograms[currentLevel]=placeInFixedRow(LEVELS[currentLevel],getRows(),0,${JSON.stringify(name)}).rows;`);
    assert.equal(app.run('checkSolution(LEVELS[currentLevel],getCodeFromEditor()).ok'),true);
  }
});
