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
- **16 puzzles** — a wrapping introduction, the introductory composition puzzle, and increasingly complex transformations built before applying the starting value
- **GeckoGraph rendering** — SVG-based gecko graph visualization running entirely in the browser
- **Self-hosted fonts** — Fira Code, Exo, and Orbitron in `fonts/` (OFL licensed)
- **Offline-capable** — Works by opening `index.html` directly, no web server needed

### File structure

```
index.html      — Main app and type checker
update-check.js — Automatic release checks and progress-preserving reloads
version.json    — Generated release marker
levels.js       — 16 puzzle definitions
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

- **Fixed row slots** — a level with N supplied function copies has N slots from the start: N − 1 construction steps and one automatic final application. Clearing, replacing, undoing or completing steps never creates, removes or renumbers a slot. Levels 1 and 2 have one slot that applies the supplied transformation directly to the starting value.
- **One function argument per construction step** — each editable row applies one function to exactly one function and returns a function. A type `a -> b -> c` appears as one input `a` leading to a boxed function `b -> c`. The same boxes appear in the palette, function inputs and outputs. Apply returned functions in later rows. Operators use parenthesized prefix names. Text mode uses one `let` binding per application and the final `in` expression.
- **Automatic carry-forward** — Generated functions continue directly into the next row and never become palette cards. A combinator becomes the next head; a transformation becomes the next fixed input. Mixed lessons leave a plus button for choosing the receiving combinator. Initial combinator cards support dragging or tapping; initial transformations are supplied by tapping an empty input. Construction rows show only the function/input area, without a repeated output diagram. Palette cards support Enter/Space selection. Text mode supports tapping to insert at the caret.
- **Exact function supplies** — every initial function copy and every generated function must be used exactly once in the solution. Multiple initial copies have a remaining-count badge. Exhausted cards disappear. The same rules apply to text mode, including rejecting discarded or reused generated functions. There is no conciseness score.
- **Mandatory automatic continuation** — Every generated function is used in the immediately following row, with the last transformation applied to the starting value automatically. Combinators become locked heads; transformations become locked arguments. Purple borders and an arrow/lock indicator show both kinds of dependency. Generated functions cannot return to the palette independently. The player still chooses available functions; the editor never chooses a head in a mixed-combinator lesson. Clearing a manually selected head preserves its carried input, while clearing a producer cascades to dependent steps after confirmation. Links survive refresh, undo and mode switches; placement and continuation share one undo action. Text mode remains authored manually and enforces the same continuation rule. Existing drafts are retained, and outdated completions are rechecked once.
- **Single-combinator lessons** — A level with only one kind of supplied combinator hides that palette section and supplies its head automatically. This includes `(.)`, `(<**>)`, and `(>=>)` lessons. A generated combinator takes priority. Carrying a transformation into an automatic head can complete a row and generate another head immediately; selection advances to the next actual choice. Copies still count toward the exact supplies. Fixed slots are never added or removed. Mixed lessons retain every combinator choice even after other kinds are exhausted.
- **Inputs and results** — The type diagram inside a function is its argument drop target. An automatically carried argument is fixed to its producer; other filled arguments remain editable. Construction rows omit the outer arrow and output preview. Arrows inside function diagrams remain. The final row shows the starting value and fixed goal throughout construction, then applies the complete transformation once every construction slot is complete.
- **Clearing steps** — tap a manually filled input to clear it, or tap a function's blue border to return the whole step's cards. A step with no dependent steps clears immediately. Clearing a producer that also clears dependent steps asks for confirmation and shows the affected rows. Independent steps remain intact and all slots stay in place. Undo/redo shortcuts restore the fixed layout and its derived inventory.
- **Touch drag-and-drop** — dragging starts immediately, without a hold. The complete function rectangle accepts its missing input; manually filled argument diagrams remain replacement targets. Swipe the background to scroll. Icon mode has no text cursor or keyboard focus.
- **Text mode** — a continuous Haskell editor shows `let` bindings and `in`, with indentation, highlighting and draft history. Empty icon slots are omitted from source; `_` represents a pending head or final application. Saved programs and preferences survive refresh and mode switches. Older nested calls are expanded into unary rows. Oversized legacy programs remain available in text mode for review while icon mode uses the fixed slot count. Old completions that reuse or discard generated functions are rechecked.
- **Automatic completion** — reaching the target with exactly the supplied copies and one use per generated function marks the level solved and enables Next. The final celebration requires every level to be solved; Skip level never awards completion.
- Semantic icons show each level’s actual type transformations, including ordered slots, pairs, nested wrappers, and function arguments. Generic `a`, `b`, `c`, and `d` consistently use circle, square, diamond, and triangle shapes across levels. Generated functions carry these display identities through later rows, palette cards, inputs, refreshes and responsive wrapping. When functions are combined, the supplied function keeps its shapes wherever the type relationships allow; newly introduced independent types use unoccupied shapes. Actual swaps and rotations retain their real order. Generic types use distinct dotted gray outlines, with the same outline repeated wherever a type variable occurs in a function. Concrete types use colored hollow shapes. Starting parameters, placed value arguments, and completed value results use the same shapes filled with their type color. Empty inputs and function signature diagrams keep their type outlines. Expected outputs and the final goal show the values to produce: known concrete shapes are filled, while unknown generic parts remain dotted. Previews remain non-draggable until usable. As arguments specialize a call, assigned types in empty inputs appear inside their original gray outlines. The gray outline can grow around an entire pair, wrapper, or function without shrinking its contents. Starting values, placed arguments, and actual or expected value results show their own structure without the dotted generic slot around them. Clearing an argument restores the expected type slot. Function values keep the generic placeholders within their own signatures, without the receiving slot’s frame.
- Editor contents and display preferences persist in localStorage. Clear level resets only the current puzzle. Completed levels provide a “Show reference rows” option in text mode.

## Supported language: the game's LNF subset

The game accepts **let-normal form (LNF)** with named operands. Here this means
the strict convention where a call refers to an existing name for both its
function and its argument. LNF terminology varies between sources; these rules
define the game's supported subset, rather than claiming to implement all of
Haskell or every language called LNF.

```haskell
let
  r1 = (.) mkHero
  r2 = r1 runZero
in
  r2 z
```

- Every construction binding has the form `name = functionName argumentName`.
  There is exactly one unary application, and both operands are supplied names
  or earlier results. Parenthesized operator names such as `(.)` are names too.
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
requirements of LNF itself. Likewise, single-combinator levels automatically
choose their supplied combinator or the previous row's generated combinator; other levels expose
additional combinators. Both editors use the same validation. Icon mode builds
this form directly, and text mode reports unsupported syntax without silently
accepting it. Existing nested legacy expressions can still be expanded into
named unary rows when entering icon mode; saved text drafts remain available.

Background: [the stricter LNF convention in resource-analysis research](https://www.cambridge.org/core/journals/mathematical-structures-in-computer-science/article/two-decades-of-automatic-amortized-resource-analysis/9A47A8663CD8A7147E2F17865C368094).

## Required functions by level

Every supplied copy is required; each function has an exact usage count. The palette follows the learning goal, including higher-order functions even when manual steps could reach the same target. Every level has one starting value, reserved for its final application. All supplied transformations belong to the function palette.

| Level | Functions |
| --- | --- |
| 1 | `wrap` |
| 2 | `f` |
| 3 | `runZero`, `mkHero`, `(.)` |
| 4 | `f1`, `f3`, `(.)` |
| 5 | `f2`, `f4`, `(.)` |
| 6 | `snd`, `f1`, `f3`, `(.)` |
| 7 | `f1`, `f2`, `f3`, `(.)` |
| 8 | `f1`, `f2`, `f3`, `(<**>)` ×2 |
| 9 | `bd`, `fmap`, `f1` ×3, `f2`, `(.)`, `(>>>)` ×3 |
| 10 | `f1`, `f2`, `f3`, `(.)` |
| 11 | `f1`, `f2`, `f3`, `(.)` |
| 12 | `wrap`, `join`, `(.)` |
| 13 | `f`, `dup`, `(>>=)`, `flip`, `(.)` |
| 14 | `f`, `swap`, `(<$>)`, `(.)` |
| 15 | `f`, `dup`, `nest`, `(>=>)` ×2 |
| 16 | `f`, `g`, `pair`, `(<$>)`, `(<*>)` |

Level 1 starts with a plain value and supplies `wrap :: a -> Zero a`. Its goal is that same value inside Zero. In `Zero a`, `Zero` is a type constructor and `a` is the type of the contained value; the game displays type shapes rather than concrete contents such as numbers.

The former level 3, Assembly required, has been removed. Assembly by composition is now level 3, and every later level moves down by one number. Saved drafts, programs and completions move with their puzzles. A player on the removed level continues at composition; its old answer and solved mark do not transfer. The older pre-composition save format is still supported.

Every reference solution now builds functions in its intermediate rows and applies the single starting value in its final row. Every generated function is used exactly once, enforced in both editor modes. Every level enforces function-only intermediate applications and the final-input rule, in addition to exact supplies. Icon mode creates the final application automatically; text mode exposes the equivalent explicit Haskell expression.

Level 8 (TIE fighter) uses two copies of standard `(<**>) :: Applicative f => f a -> f (a -> b) -> f b`, specialized to functions sharing the same input. `f3` extracts the first component; `f1` produces the next transformation; `f2` produces the final transformation into Hero. The chain carries every result forward and creates the Hero wrapper only at the end. The checker retains both Hero and function Applicative instances and rejects unsupported contexts.

Level 9 (The middle man) keeps `Zero a B c -> Hero a D c`, `bd`, `fmap`, three rotations and the Hero conversion. One `(.)` puts the initial rotation before the mapped transformation; three forward compositions `(>>>)` append the remaining rotations and conversion. The standard function specialization is `(a -> b) -> (b -> c) -> a -> c`. Its reference rows carry every result immediately.

Level 15 (Double bind) uses two copies of standard Kleisli composition `(>=>)`, specialized to Hero: `(a -> Hero b) -> (b -> Hero c) -> a -> Hero c`. It chains `f`, `dup`, and `nest` before the automatic final application. Level 13 still introduces bind through `flip (>>=)`; level 12 teaches `join`, and level 14 maps inside Hero with `(<$>)`.

Level 16 (Applicative hero) has plain projections `f :: Zero a b -> a` and `g :: Zero a b -> b`, with `pair :: a -> b -> Hero (a, b)`. One `(<$>)`, specialized to the function Functor, and one standard `(<*>)` build the transformation into `Hero (b, a)`. Both projections share the one final input internally; the player supplies it only once. Nested Applicative layers are left for a future lesson.

All sixteen reference solutions follow immediate continuation. The existing functions and goals of levels 6, 7, 10 and 11 are unchanged; their composition reference rows are associated in a continuous order. Saved drafts survive these changes, including full legacy sources that exceed a redesigned level's slot count. Changed or deferred solutions lose their outdated completion mark once. Use Clear level to restart with the new supplies.

`($)` stays removed because rows already provide application and intermediate results.

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
