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
- **Generated functions join the top palette** — a completed row contributes one function card. Drag it from the top into a later row, as either the row's function or its argument. The card disappears when consumed and returns if its consumer is cleared. Incomplete, invalid and consumed results are unavailable. Row outputs remain visible as read-only diagrams; all icon-mode drags start in the top palette. Tapping a card or using Enter/Space also places it in the selected empty row/input.
- **Exact function supplies** — every initial function copy and every generated function must be used exactly once in the solution. Multiple initial copies have a remaining-count badge. Exhausted cards disappear. The same rules apply to text mode, including rejecting discarded or reused generated functions. There is no conciseness score.
- **Inputs and results** — the type diagram inside a function is its argument drop target. The right side of the arrow shows only its output, starting as a generic preview and specializing as the input is supplied. Generated functions keep complete type diagrams in the top palette. The final row shows the starting value and fixed goal throughout construction. Once every construction slot is complete, it applies the complete transformation to the value once and shows the actual result.
- **Clearing steps** — tap a filled input to clear it, or tap a function's blue border to return the whole step's cards. Clearing a producer also clears dependent steps, with a confirmation showing the affected rows. Independent steps remain intact and all slots stay in place. Undo/redo shortcuts restore the fixed layout and its derived inventory.
- **Touch drag-and-drop** — dragging starts immediately, without a hold. The complete function rectangle accepts its missing input; filled argument diagrams remain replacement targets. Swipe the background to scroll. Icon mode has no text cursor or keyboard focus.
- **Text mode** — a continuous Haskell editor shows `let` bindings and `in`, with indentation, highlighting and draft history. Empty icon slots are omitted from source; `_` represents the pending final application. Saved programs and preferences survive refresh and mode switches. Older nested calls are expanded into unary rows. Oversized legacy programs remain available in text mode for review while icon mode uses the fixed slot count. Old completions that reuse or discard generated functions are rechecked.
- **Automatic completion** — reaching the target with exactly the supplied copies and one use per generated function marks the level solved and enables Next. The final celebration requires every level to be solved; Skip level never awards completion.
- Semantic icons show each level’s actual type transformations, including ordered slots, pairs, nested wrappers, and function arguments. Generic types use distinct dotted gray outlines, with the same outline repeated wherever a type variable occurs in a function. Concrete types use colored hollow shapes. Starting parameters, placed value arguments, and completed value results use the same shapes filled with their type color. Empty inputs and function signature diagrams keep their type outlines. Expected outputs and the final goal show the values to produce: known concrete shapes are filled, while unknown generic parts remain dotted. Previews remain non-draggable until usable. As arguments specialize a call, assigned types in empty inputs appear inside their original gray outlines. The gray outline can grow around an entire pair, wrapper, or function without shrinking its contents. Starting values, placed arguments, and actual or expected value results show their own structure without the dotted generic slot around them. Clearing an argument restores the expected type slot. Function values keep the generic placeholders within their own signatures, without the receiving slot’s frame.
- Editor contents and display preferences persist in localStorage. Clear level resets only the current puzzle. Completed levels provide a “Show reference rows” option in text mode.

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
| 8 | `f1`, `f2`, `f3`, `(<*>)`, `(.)` |
| 9 | `bd`, `fmap`, `f1`, `f2`, `(.)` |
| 10 | `f1`, `f2`, `f3`, `(.)` |
| 11 | `f1`, `f2`, `f3`, `(.)` |
| 12 | `wrap`, `join`, `(.)` |
| 13 | `f`, `dup`, `(>>=)`, `flip`, `(.)` |
| 14 | `f`, `swap`, `(<$>)`, `(.)` |
| 15 | `f`, `dup`, `nest`, `(>>=)`, `flip`, `(.)` |
| 16 | `f`, `g`, `pair`, `(<$>)`, `(<*>)`, `(.)` |

Level 1 starts with a plain value and supplies `wrap :: a -> Zero a`. Its goal is that same value inside Zero. In `Zero a`, `Zero` is a type constructor and `a` is the type of the contained value; the game displays type shapes rather than concrete contents such as numbers.

The former level 3, Assembly required, has been removed. Assembly by composition is now level 3, and every later level moves down by one number. Saved drafts, programs and completions move with their puzzles. A player on the removed level continues at composition; its old answer and solved mark do not transfer. The older pre-composition save format is still supported.

Every reference solution now builds functions in its intermediate rows and applies the single starting value in its final row. Every generated function is used exactly once, enforced in both editor modes. Every level enforces function-only intermediate applications and the final-input rule, in addition to exact supplies. Icon mode creates the final application automatically; text mode exposes the equivalent explicit Haskell expression.

Level 8 (TIE fighter) supplies two compositions and four copies of `(<*>)`: two specialize to Hero application and two combine functions that share an input. It does not supply or require `(<$>)`. The standard signature `Applicative f => f (a -> b) -> f a -> f b` is used wherever `(<*>)` is supplied; the checker supports the Hero and function (`((->) r)`) instances and rejects unsupported contexts. Generic dotted context containers resolve into Hero or function diagrams as arguments are added.

Level 9 (The middle man) starts with only `z :: Zero a B c` and targets `Hero a D c`. The concrete square-to-triangle conversion `bd :: B -> D` is supplied once in the function palette, alongside one `fmap`, three `f1`, one `f2`, and four `(.)`. Build the complete transformation before the automatic final row applies `z` once. The unused `ad` and `cd` inputs are removed. Existing valid solutions retain their work and completion; outdated drafts remain editable.

The final five lessons retain their targets and teaching functions:

| Former → current level | Added or adjusted supplies |
| --- | --- |
| 13 → 12, Flat is justice | One `(.)` to compose `join` with `wrap` |
| 14 → 13, Bind them all | One `flip` and one `(.)` |
| 15 → 14, Lift off | One `(.)` after partially applying `(<$>)` |
| 16 → 15, Double bind | Two `flip` and two `(.)` |
| 17 → 16, Applicative hero | Two `(.)`, two `(<*>)` total, and only one `z` |

`flip :: (a -> b -> c) -> b -> a -> c` reverses a function's first two inputs. In the bind lessons, `flip (>>=)` allows the continuation function to be supplied before the Hero value, so the resulting transformation can be composed with `f`. The last lesson combines the functions that produce Hero values before sending `z` through both branches. No custom lifting or sharing helper is needed. Old drafts for these five lessons are preserved, but their completions are rechecked once against the new rules. Use Clear level to start again with the updated supplies.

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
