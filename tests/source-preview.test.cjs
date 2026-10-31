const {test}=require('node:test');
const assert=require('node:assert/strict');
const {game}=require('./helpers/game-harness.cjs');
const {solveIconLevel}=require('./helpers/solve-icon-level.cjs');

function prepare(app,index,source='') {
  app.run(`currentLevel=${index};setEditorContent(${JSON.stringify(source)});
    rowPrograms[currentLevel]=prepareIconRows(LEVELS[currentLevel],getRows());diagnoseRows();`);
}
function place(app,index,name,slot=false) {
  const result=app.read(`placeWithContinuation(LEVELS[currentLevel],getRows(),${index},${JSON.stringify(name)},${slot})`);
  assert.equal(result.error,undefined);
  app.run(`rowPrograms[currentLevel]=${JSON.stringify(result.rows)};diagnoseRows();`);
}
const signature=(app,expr)=>app.run(`typeToString(${expr}).replace(/SKOLEM/g,'')`);

test('the first selected transformation resolves from the source before the next function is supplied',()=>{
  const app=game();prepare(app,1);place(app,0,'runZero',true);
  assert.equal(signature(app,'rowDiagnostics[0].preview.call.arguments[0].type'),'Zero a -> a');
  const filled=app.run("rowSymbol('runZero',null,rowDiagnostics[0].preview.call.arguments[0])");
  assert.match(filled,/data-diagram-preview="true"/);
  assert.equal((filled.match(/fill="#d97706"/g)||[]).length,2);
  assert.doesNotMatch(filled,/type-placeholder|type-binding/);
  const waiting=app.run("rowSymbol('next',null,rowDiagnostics[1].preview.call.inputDiagrams[0])");
  assert.match(waiting,/data-type="a"/);
  assert.match(waiting,/type-placeholder/);
  assert.match(waiting,/data-marker="3"/); // Preserve the unresolved output's original shape.
  assert.doesNotMatch(waiting,/fill="#[^"]+"|Hero|data-diagram-preview/);
  assert.equal(app.run("parameterUsage(LEVELS[1],getCodeFromEditor()).find(f=>f.name==='z').used"),0);
  assert.equal(app.run('getRows().at(-1).expr'),'');
  assert.equal(app.run('checkSolution(LEVELS[1],getCodeFromEditor()).ok'),false);
});

test('mapping, rotating and changing the wrapper update the preview without adding value applications',()=>{
  const app=game();prepare(app,7);
  const slots=app.read('getRows().map(r=>r.id)'), palette=app.run('FUNCTION_CARD_ICONS[15].f1');
  place(app,0,'fmap');
  assert.equal(app.run('rowDiagnostics[0].preview'),undefined);
  place(app,0,'bd',true);
  assert.equal(signature(app,'rowDiagnostics[0].preview.diagram.type'),'Zero a b B -> Zero a b D');
  const mapped=app.run("rowSymbol('mapped',null,rowDiagnostics[0].preview.diagram)");
  assert.doesNotMatch(mapped,/type-placeholder|type-binding/);
  assert.match(mapped,/fill="#059669"/);
  assert.equal(app.run('getRows()[1].expr'),'_ r1');
  place(app,1,'(>>>)');place(app,2,'f1',true);
  assert.equal(signature(app,'rowDiagnostics[2].preview.call.arguments[0].type'),'Zero a b D -> Zero D a b');
  assert.equal(signature(app,'rowDiagnostics[2].preview.diagram.type'),'Zero a b B -> Zero D a b');
  assert.equal(app.run('getRows().at(-1).expr'),'');
  place(app,3,'(>>>)');place(app,4,'f2',true);
  assert.equal(signature(app,'rowDiagnostics[4].preview.diagram.type'),'Zero a b B -> Hero D a b');
  assert.deepEqual(app.read('getRows().map(r=>r.id)'),slots);
  assert.equal(app.run('FUNCTION_CARD_ICONS[15].f1'),palette);
  assert.equal(app.run('getCodeFromEditor()'),app.run('LEVELS[7].solution'));
  assert.equal(app.run("parameterUsage(LEVELS[7],getCodeFromEditor()).find(f=>f.name==='z').used"),1);
});

test('the goal never determines preview types or fills unknown outputs',()=>{
  const app=game();prepare(app,1);place(app,0,'runZero',true);
  const before=app.read('sourceRowPreviews(LEVELS[1],getRows(),rowDiagnostics)');
  for(const goal of ['D','Hero B','(a, a)','Zero (a -> b)']){
    assert.deepEqual(app.read(`sourceRowPreviews({...LEVELS[1],target:${JSON.stringify('Zero a -> '+goal)}},getRows(),rowDiagnostics)`),before);
  }
  assert.ok(app.run('findVars(rowDiagnostics[0].preview.diagram.type).size')>0);
});

test('incompatible source inputs, invalid calls and disconnected branches do not invent live values',()=>{
  const app=game();prepare(app,3,'(>>>) f2');
  // f2 needs two identical slots; this source contains two independent types.
  assert.equal(app.run('rowDiagnostics[0].error'),undefined);
  assert.equal(app.run('rowDiagnostics[0].preview'),undefined);
  prepare(app,7);
  app.run("rowPrograms[7][3].expr='fmap bd';diagnoseRows();");
  assert.equal(app.run('rowDiagnostics[3].error'),undefined);
  assert.equal(app.run('rowDiagnostics[3].preview'),undefined);
  prepare(app,1,'(>>>) runZero');
  const before=app.run('typeToString(rowDiagnostics[0].preview.call.arguments[0].type)');
  app.run("rowPrograms[1][1].expr='r1 missing';diagnoseRows();");
  assert.ok(app.run('rowDiagnostics[1].error'));
  assert.equal(app.run('rowDiagnostics[1].preview'),undefined);
  assert.equal(app.run('typeToString(rowDiagnostics[0].preview.call.arguments[0].type)'),before);
});

test('combinators retain unresolved arguments while their known types specialize',()=>{
  const app=game();prepare(app,11,'flip (>>=)');
  assert.match(signature(app,'rowDiagnostics[0].preview.diagram.type'),/^\(a -> Hero _t\d+\) -> Hero a -> Hero _t\d+$/);
  assert.ok(app.run('findVars(rowDiagnostics[0].preview.diagram.type).size')>0);
  place(app,1,'dup',true);
  assert.equal(signature(app,'rowDiagnostics[1].preview.diagram.type'),'Hero a -> Hero (a, a)');
  prepare(app,14,'fmap pair');
  // The Reader input is still ambiguous until its first transformation is given.
  assert.equal(app.run('rowDiagnostics[0].preview'),undefined);
  place(app,1,'f',true);
  // f selects a even though the goal begins with b: preview the chosen path.
  assert.match(signature(app,'rowDiagnostics[1].preview.diagram.type'),/^Zero a b -> _t\d+ -> Hero \(a, _t\d+\)$/);
});

test('every reference path still solves with fixed slots and fully resolved final transformation previews',()=>{
  const app=game();
  for(let index=0;index<app.run('LEVELS.length');index++){
    const result=solveIconLevel(app,index);
    assert.deepEqual(result.failures,[],`level ${app.run('LEVELS[currentLevel].level')}`);
    assert.equal(app.run('getCodeFromEditor()'),app.run('LEVELS[currentLevel].solution'));
    if(app.run('getRows().length')===1)continue;
    assert.equal(app.run('rowDiagnostics.slice(0,-1).every(d=>!!d.preview)'),true);
    assert.equal(app.run('findVars(rowDiagnostics.at(-2).preview.diagram.type).size'),0);
    assert.deepEqual(app.read(`rowDiagnostics.slice(0,-1).flatMap((d,i)=>{
      const pictures=[rowSymbol('pipeline',null,d.preview.diagram),...d.preview.call.arguments.filter(Boolean).map(a=>rowSymbol('function',null,a))];
      return pictures.some(svg=>/NaN|undefined|type-binding/.test(svg))?[i]:[];
    })`),[]);
  }
});

test('preview changes are reversible, recomputed on refresh, and never stored as code or inferred schemes',()=>{
  const app=game();prepare(app,7,'fmap bd');
  app.run('rememberRows();');place(app,1,'(>>>)');place(app,2,'f1',true);
  app.run('persistRows();');const before=app.read('rowDiagnostics.map(d=>d.preview||null)');
  assert.doesNotMatch(JSON.stringify(app.saved()),/liveFlow|"preview"/);
  const restored=game(app.saved());restored.run('diagnoseRows();');
  assert.deepEqual(restored.read('rowDiagnostics.map(d=>d.preview||null)'),before);
  app.run('rowPrograms[7]=prepareIconRows(LEVELS[7],JSON.parse(rowHistory.get(7).undo.at(-1)));diagnoseRows();');
  assert.equal(signature(app,'rowDiagnostics[0].preview.diagram.type'),'Zero a b B -> Zero a b D');
  assert.equal(app.run('rowDiagnostics[2].preview'),undefined);
  app.run('rowPrograms[7]=prepareIconRows(LEVELS[7],clearedRows(getRows(),0,true));diagnoseRows();');
  assert.equal(app.run('rowDiagnostics.every(d=>!d.preview)'),true);
  assert.match(app.run('FUNCTION_CARD_ICONS[15].fmap'),/type-placeholder/);
});

test('preview fills data but preserves the signatures of function values stored inside it',()=>{
  const app=game();
  const svg=app.run("renderSemanticType(fixedSemanticType('Zero (a -> b) a -> Zero () b'),'preview',[],null,true,true)");
  assert.equal((svg.match(/fill="#d97706"/g)||[]).length,1);
  assert.equal((svg.match(/fill="#0284c7"/g)||[]).length,1);
  assert.match(svg,/fill="none" stroke="#d97706"/);
  assert.match(svg,/fill="none" stroke="#0284c7"/);
  const definition=app.run("renderSemanticType(fixedSemanticType('a -> b'),'definition',[],null,true)");
  assert.doesNotMatch(definition,/fill="#[^"]+"|data-diagram-preview/);
});

test('responsive refitting preserves live fills and unresolved markers on phone widths',()=>{
  const app=game();
  assert.deepEqual(app.read(`(()=>{
    getComputedStyle=()=>({paddingLeft:'0',paddingRight:'0'});
    const decode=s=>s.replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
    const marks=s=>(s.match(/(?:fill="#[^"]+"|data-marker="\\d+")/g)||[]).sort();
    const failures=[];
    for(const [index,level] of LEVELS.entries()){
      currentLevel=index;setEditorContent(level.solution);diagnoseRows();
      for(const d of rowDiagnostics.filter(d=>d.preview)){
        const svg=rowSymbol('flow',null,d.preview.diagram);
        const attrs=Object.fromEntries([...svg.match(/<svg[^>]*>/)[0].matchAll(/([\\w-]+)="([^"]*)"/g)].map(m=>[m[1],decode(m[2])]));
        const holder={clientWidth:320};
        const node={dataset:{diagramType:attrs['data-diagram-type'],diagramVariables:attrs['data-diagram-variables'],diagramPreview:attrs['data-diagram-preview']},style:{},innerHTML:'',
          getAttribute:k=>attrs[k]??null,setAttribute:(k,v)=>attrs[k]=v,querySelector:()=>({}),
          closest:s=>s==='.argument-choice'?{}:s==='.argument-choices'?holder:null};
        for(const width of [320,800,320]){
          holder.clientWidth=width;fitSemanticDiagrams({querySelectorAll:()=>[node]});
          if(JSON.stringify(marks(node.innerHTML))!==JSON.stringify(marks(svg))||Number(attrs.width)>width-25||/NaN|undefined/.test(node.innerHTML))failures.push([level.level,width]);
        }
      }
    }
    return failures;
  })()`),[]);
});
