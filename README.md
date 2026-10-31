# Zero to Hero — Client-Side Edition

**[Play in your browser](https://yibers.github.io/zero-to-hero-offline/)**

A fully client-side reimplementation of [Zero to Hero](https://zerotohero.fly.dev), a Haskell type puzzle game where you implement a `zeroToHero` function to convert between types using only the provided functions.

## What is this?

The original **Zero to Hero** is a research project from [Monash University](https://www.monash.edu/) studying how programmers understand polymorphic types in Haskell. It was created by:

- **Shuai Fu** — Ph.D. student, Dept. of Human Centred Computing
- **Prof. Tim Dwyer** — Dept. of Human Centred Computing
- **Prof. Peter J. Stuckey** — Dept. of Data Science and AI

The original game also features **GeckoGraph**, a visual notation for polymorphic types. Their research paper is available at [arXiv:2405.12699](https://arxiv.org/abs/2405.12699).

## What we did here

This reimplements the game with no server dependencies:

- **Client-side type checker** — Hindley-Milner type inference engine written in JavaScript, replacing the original's server-side GHC calls
- **25 puzzles** — one new concept at a time, followed by practice and combinations of familiar operations
- **GeckoGraph rendering** — SVG-based gecko graph visualization running entirely in the browser
- **Self-hosted fonts** — Fira Code, Exo, and Orbitron in `fonts/` (OFL licensed)
- **Offline-capable** — Works by opening `index.html` directly, no web server needed

### File structure

```
index.html      — Main app and type checker
update-check.js — Automatic release checks and progress-preserving reloads
version.json    — Generated release marker
levels.js       — 25 puzzle definitions
semantic-icons.js — SVG type patterns and per-level action descriptions
row-program.js  — Expression parsing, row validation and migration
puzzle-rules.js — Target checking and required-function dependency checks
row-editor.js   — Icon row editing, references and mouse/touch interactions
text-editor.js  — Multiline Haskell editing, highlighting and draft history
row-editor.css  — Row layout and responsive controls
fonts/          — Exo, Fira Code, Orbitron (.ttf)
fonts/LICENSE   — SIL Open Font License
tests/          — Playwright + unit tests
```

### Features matching the original

- Live type inference as you type
- Semantic icon mode by default, with a text-mode toggle
- Prev / Next navigation, with automatic completion
- **Skip level** advances without solving or clearing the current puzzle. Drafts survive returning and refreshing. At the end, **Unsolved levels** returns to the first skipped puzzle; the completion celebration requires every level to be solved.
- Opens directly into the puzzle; a final dialog celebrates completing the game
- **Clear level** restarts only the current puzzle, restoring all supplied cards and removing its solved mark while preserving other levels and display preferences
- Solved (✓) indicator per level

### Additional features

- **Fixed row slots** — a level with N supplied function copies has N slots from the start: N − 1 construction steps and one automatic final application. Clearing, replacing, undoing or completing steps never creates, removes or renumbers a slot. Single-card introductory levels have one slot that applies the supplied transformation directly to the starting value.
- **One function argument per construction step** — each editable row applies one function to exactly one function and returns a function. A type `a -> b -> c` appears as one input `a` leading to a boxed function `b -> c`. The same boxes appear in the palette, function inputs and outputs. Apply returned functions in later rows. Operators use parenthesized prefix names. Text mode uses one `let` binding per application and the final `in` expression.
- **Automatic carry-forward** — Generated functions continue directly into the next row and never become palette cards. A combinator becomes the next head; a transformation becomes the next fixed input. Mixed lessons leave a plus button for choosing the receiving combinator. Initial combinator cards support dragging or tapping; initial transformations are supplied by tapping an empty input. Construction rows show only the function/input area, without a repeated output diagram. Palette cards support Enter/Space selection. Text mode supports tapping to insert at the caret.
- **Exact function supplies** — every initial function copy and every generated function must be used exactly once in the solution. Multiple initial copies have a remaining-count badge. Exhausted cards disappear. The same rules apply to text mode, including rejecting discarded or reused generated functions. There is no conciseness score.
- **Mandatory automatic continuation** — Every generated function is used in the immediately following row, with the last transformation applied to the starting value automatically. Combinators become locked heads; transformations become locked arguments. Purple borders and an arrow/lock indicator show both kinds of dependency. Generated functions cannot return to the palette independently. The player still chooses available functions; the editor never chooses a head in a mixed-combinator lesson. Clearing a manually selected head preserves its carried input, while clearing a producer cascades to dependent steps after confirmation. Links survive refresh, undo and mode switches; placement and continuation share one undo action. Text mode remains authored manually and enforces the same continuation rule. Existing drafts are retained, and outdated completions are rechecked once.
- **Automatic forward composition** — A level whose only kind of supplied combinator is `(>>>)` hides that palette section and supplies `(>>>)` automatically. Other combinators, including `fmap`, `(<**>)`, and `(>=>)`, stay in the palette until selected, even when they are the only kind. A generated combinator takes priority. Carrying a transformation into an automatic head can complete a row and generate another head immediately; selection advances to the next actual choice. Copies still count toward the exact supplies. Fixed slots are never added or removed. Mixed lessons retain every combinator choice even after other kinds are exhausted.
- **Inputs and results** — The type diagram inside a function is its argument drop target. An automatically carried argument is fixed to its producer; other filled arguments remain editable. Construction rows omit the outer arrow and output preview. Arrows inside function diagrams remain. The starting value has its own read-only row directly above the first function row. The goal stays at the bottom right; the complete transformation still receives the starting value once every construction slot is complete.
- **Live source preview** — As the connected chain grows, its diagrams specialize from the starting value and the functions actually chosen. Filled shapes show the values flowing through a transformation; unresolved types stay dotted, and unchosen inputs and stored function signatures remain type outlines. Mapping and rotations update immediately. The goal supplies no preview constraints. This is a visual preview of value types, not execution of Haskell or a change to the single final application. Palette definitions and saved code remain generic; clearing or changing a step recomputes the preview.
- **Clearing steps** — tap a manually filled input to clear it, or tap a function's blue border to return the whole step's cards. A step with no dependent steps clears immediately. Clearing a producer that also clears dependent steps asks for confirmation and shows the affected rows. Independent steps remain intact and all slots stay in place. Undo/redo shortcuts restore the fixed layout and its derived inventory.
- **Touch drag-and-drop** — dragging starts immediately, without a hold. The complete function rectangle accepts its missing input; manually filled argument diagrams remain replacement targets. Swipe the background to scroll. Icon mode has no text cursor or keyboard focus.
- **Text mode** — a continuous Haskell editor shows `let` bindings and `in`, with indentation, highlighting and draft history. Empty icon slots are omitted from source; `_` represents a pending head or final application. Saved programs and preferences survive refresh and mode switches. Older nested calls are expanded into unary rows. Oversized legacy programs remain available in text mode for review while icon mode uses the fixed slot count. Old completions that reuse or discard generated functions are rechecked.
- **Automatic completion** — reaching the target with exactly the supplied copies and one use per generated function marks the level solved and enables Next. The final celebration requires every level to be solved; Skip level never awards completion.
- Semantic icons show each level’s actual type transformations, including ordered slots, pairs, nested wrappers, and function arguments. Generic `a`, `b`, `c`, and `d` consistently use circle, square, diamond, and triangle shapes across levels. Generated functions carry these display identities through later rows, palette cards, inputs, refreshes and responsive wrapping. When functions are combined, the supplied function keeps its shapes wherever the type relationships allow; newly introduced independent types use unoccupied shapes. Actual swaps and rotations retain their real order. Generic types use distinct dotted gray outlines, with the same outline repeated wherever a type variable occurs in a function. Concrete types use colored hollow shapes. Starting parameters, placed value arguments, and completed value results use the same shapes filled with their type color. Empty inputs and function signature diagrams keep their type outlines. Expected outputs and the final goal show the values to produce: known concrete shapes are filled, while unknown generic parts remain dotted. Previews remain non-draggable until usable. As arguments specialize a call, resolved types replace their original dotted outlines everywhere, including empty inputs and returned function signatures. Pairs, wrappers, and functions retain their own structure; only unresolved parts stay dotted. Starting values, placed arguments, and actual or expected value results show their own structure without the dotted generic slot around them. Clearing an argument restores the expected type slot. Function values keep the generic placeholders within their own signatures, without the receiving slot’s frame.
- Editor contents and display preferences persist in localStorage. Clear level resets only the current puzzle. Completed levels provide a “Show reference rows” option in text mode.

## Supported language: the game's LNF subset

The game accepts **let-normal form (LNF)** with named operands. Here this means
the strict convention where a call refers to an existing name for both its
function and its argument. LNF terminology varies between sources; these rules
define the game's supported subset, rather than claiming to implement all of
Haskell or every language called LNF.

```haskell
let
  r1 = (>>>) runZero
  r2 = r1 mkHero
in
  r2 z
```

- Every construction binding has the form `name = functionName argumentName`.
  There is exactly one unary application, and both operands are supplied names
  or earlier results. Parenthesized operator names such as `(>>>)` are names too.
- Intermediate results are introduced with an explicit `let ... in` block.
  Each binding occupies its own line (semicolons also separate bindings).
  The final expression is one named-function application. A standalone call
  such as `wrap value` already fits this form and needs no redundant `let`.
- Names must be unique lowercase identifiers, must not shadow supplied names,
  and must not be Haskell keywords. Bindings can refer only to earlier results;
  recursive and forward references are rejected.
- `where`, nested calls, infix/backtick calls, nested `let` expressions,
  anonymous functions, literal expressions, and user-defined control expressions
  are outside this game's subset. The game supplies values and functions as
  cards; it does not add general-purpose literal or lambda definitions. General
  LNF languages can support such definitions when explicitly named.

The function-only construction steps, mandatory immediate continuation of generated functions,
exact card counts, single use of generated
results, and automatic final application are **additional puzzle rules**, not
requirements of LNF itself. The editor supplies `(>>>)` automatically only when
it is the level’s sole combinator. Other supplied combinators require selection.
Generated combinators still become the next row’s head automatically. Both editors use the same validation. Icon mode builds
this form directly, and text mode reports unsupported syntax without silently
accepting it. Existing nested legacy expressions can still be expanded into
named unary rows when entering icon mode; saved text drafts remain available.

Background: [the stricter LNF convention in resource-analysis research](https://www.cambridge.org/core/journals/mathematical-structures-in-computer-science/article/two-decades-of-automatic-amortized-resource-analysis/9A47A8663CD8A7147E2F17865C368094).

## Learning progression

Each level introduces one idea or gives a harder use of familiar operations. Short introductions precede the longer synthesis puzzles. Level titles describe the concept or practice goal; the learning objective is also recorded in each puzzle definition.

Every supplied copy is required exactly once. Every construction step uses functions only, every generated function continues immediately into the next row, and the one starting value is applied only at the end. These rules hold for all 25 reference solutions.

| Level | Title | Learning focus | Required functions |
| --- | --- | --- | --- |
| 1 | Wrap a value | Put a value inside a wrapper without changing its type. | `wrap` |
| 2 | Change a wrapper | Replace Zero with Hero while keeping the contained type. | `f` |
| 3 | Compose two functions | Connect transformations in execution order, matching the intermediate type. | `runZero`, `mkHero`, `(>>>)` |
| 4 | Make a pair | Duplicate a value into a pair inside Hero. | `f1`, `f3`, `(>>>)` |
| 5 | Match repeated types | Make repeated generic slots agree before changing the wrapper. | `f2`, `f4`, `(>>>)` |
| 6 | Compose three functions | Extend a familiar two-function composition by one more transformation. | `runZero`, `mkHero`, `dup`, `(>>>)` ×2 |
| 7 | Rearrange slots | Reorder and duplicate slots to meet a transformation’s input. | `f1`, `f2`, `f3`, `(>>>)` ×2 |
| 8 | Build a longer composition | Plan a longer chain using repeated duplication and rearrangement. | `f1` ×2, `f2`, `f3`, `(>>>)` ×3 |
| 9 | Select from a pair | Use snd to keep the second component of a pair. | `snd` |
| 10 | Work with nested pairs | Select a component after building and splitting a nested pair. | `snd`, `f1`, `f3`, `(>>>)` ×2 |
| 11 | Map inside a wrapper | Use fmap to change the contents of Hero without removing its wrapper. | `swap`, `fmap` |
| 12 | Convert a concrete type | Convert the fixed type B to D; fixed types are not interchangeable generic slots. | `bd` |
| 13 | Map a concrete type | Convert B to D inside Hero with familiar fmap. | `bd`, `fmap` |
| 14 | Map one of several slots | Use fmap on the last slot of Zero while its earlier slots stay unchanged. | `bd`, `fmap` |
| 15 | Map then rotate | Map the last slot, rotate it to the front, then change the wrapper. | `bd`, `fmap`, `f1`, `f2`, `(>>>)` ×2 |
| 16 | Apply a stored function | Apply the function stored beside its argument; () marks the emptied slot. | `apply`, `finish`, `(>>>)` |
| 17 | Apply a curried function | Apply a stored function one argument at a time, rotating between applications. | `f1` ×3, `f2` ×4, `f3`, `(>>>)` ×7 |
| 18 | Map a function’s output | Use fmap on functions to transform their output, keeping the same input. | `runZero`, `mkHero`, `fmap` |
| 19 | Share an input with &lt;*&gt; | Combine two functions that receive the same final input. | `f`, `g`, `pair`, `fmap`, `(<*>)` |
| 20 | Reverse applicative application | Use <**> to take the value-producing function before the function-producing one. | `f1`, `f2`, `f3`, `(<**>)` ×2 |
| 21 | Flatten nested wrappers | Use join to remove one layer of a nested Hero wrapper. | `wrap`, `join`, `(>>>)` |
| 22 | Reverse argument order | Use flip to reverse the two function arguments of familiar composition. | `runZero`, `mkHero`, `(>>>)`, `flip` |
| 23 | Bind a wrapped result | Use >>= to feed a wrapped value into a function that returns a wrapper. | `dup`, `(>>=)`, `flip` |
| 24 | Compose wrapped results | Use >=> to connect two transformations that each return Hero. | `f`, `dup`, `(>=>)` |
| 25 | Chain wrapped results | Extend Kleisli composition to three transformations that return Hero. | `f`, `dup`, `nest`, `(>=>)` ×2 |

Composition uses `(>>>)` throughout: supply the first transformation, then the next. For ordinary functions, `first >>> next` means `next . first`. The game retains prefix, unary rows; `>>>` is supplied automatically only when it is the sole combinator.

Levels 11 and 23 start with Hero, so mapping and bind can build the final transformation directly. Level 13 practises concrete conversion inside Hero. Level 15 starts with `Zero a b B`: map B to D, rotate once, then change Zero to Hero, producing `Hero D a b`. These goals let every generated function continue immediately. Level 22 deliberately uses `flip` to reverse the arguments of forward composition. Shared-input application follows mapping a function’s output.

Mapping consistently uses `fmap`; Haskell’s `(<$>)` is another spelling of the same operation. The game specializes mapping to Hero, Zero’s last slot, or function output as appropriate. `(<*>)` and `(<**>)` retain their Applicative constraints and support Hero and shared-input functions. The latter takes the value-producing function first; it is not a general claim that their effect ordering is interchangeable. `(>=>)` composes Hero-returning transformations. `($)` stays removed because rows already provide application.

Level 1 starts with a plain value and supplies `wrap :: a -> Zero a`. In `Zero a`, `Zero` is a type constructor and `a` is the type of the contained value. The shapes describe types and indicate where values occur; they do not display concrete contents such as numbers. The pair-selection and concrete-conversion introductions also use direct final applications, without an unnecessary construction step.

Saved progress stays attached to the same puzzle: array positions are persistent save identities, new puzzles are appended, and displayed numbers determine navigation. Stable puzzle IDs identify descriptions and old migrations independently of titles. Existing drafts, achievements, display preferences and the current puzzle survive the reorder. The two renamed mapping palettes migrate `(<$>)` to `fmap` in saved code and rows once; new lessons start unsolved. Finishing the last level returns to the first unsolved lesson, including any new introductions. Untouched starting heads inserted by the former any-single-combinator rule are removed once; played rows and text drafts remain intact. Older ordering and continuation migrations are still supported. Completed backward-composition solutions are translated to forward chains without changing their meaning; unchanged goals keep their achievements. The redesigned goals (11, 13, 15 and 23) start unsolved unless the saved program already solves the new puzzle. Incompatible partial work remains available as a text draft while icon mode starts with the new supplies. This upgrade runs once.

## Running

Open `index.html` in a browser. That's it.

Use the normal [play link](https://yibers.github.io/zero-to-hero-offline/); no version query or hard refresh is needed for subsequent updates. Online pages check a fresh release marker on opening, returning to the tab, browser history restoration, and reconnection. A newer release saves progress before reloading, then removes temporary version parameters from the address. Offline and failed checks leave the current game usable; local `file:` use makes no update requests.

Before publishing HTML, JavaScript or CSS changes, run `npm run version:assets` and commit both `index.html` and `version.json` with the changed files. This stamps the page and matching asset URLs with content hashes and generates the release marker used by automatic updates. Repeated generation without source changes produces the same version.

## Testing

```bash
node --test tests/*.test.cjs
npx playwright test
```

Runs Playwright end-to-end tests covering UI rendering, type inference, level completion, GeckoGraph display, mouse dragging, and phone touch gestures (Chromium).

## Attribution

All game design, puzzle design, and GeckoGraph notation credit belongs to the original authors at Monash University. This was built as a learning exercise and for offline use. The original game is at [zerotohero.fly.dev](https://zerotohero.fly.dev).
