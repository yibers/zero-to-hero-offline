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

- **One function argument per construction step** — each editable row applies one function to exactly one function and must return a function. A type `a -> b -> c` is displayed as one input `a` leading to a boxed function `b -> c`. The same nested boxes appear in the top palette, function-valued inputs and row results. Apply the returned function in a later row. Icon mode uses one row per application; text mode uses one `let` binding per intermediate application and an `in` expression for the final answer. Nested calls and calls with multiple arguments must be split. Bare aliases and intermediate applications to ordinary values do not satisfy the row rule.
- **Composition follows the same rule** — apply `(.)` to its first function, apply the returned function to its second function, then let the automatic final row apply the composed function to the starting value. No special multi-input form is needed. Operators use parenthesized prefix names in these steps. Existing saved calls, including infix expressions, are automatically expanded into unary rows while retaining existing result names, unfinished drafts, progress and preferences.
- Earlier results have stable names (`r1`, `r2`, …) and can be reused by dragging the output beside a function into a later row, or by selecting it from an input’s picker. Results may themselves be functions. The input type diagrams inside each row are the argument drop targets; the function’s output appears once, to the right of the row’s arrow. Functions in the palette and function-valued arguments keep their complete diagrams. Intermediate rows show only their expected result pattern to the right of the arrow, even before all inputs are filled. It starts with generic placeholders, specializes as arguments are supplied, and returns to placeholders when those arguments are removed. Composition shows the function it produces. Intermediate results drag their actual inferred value, including partially applied functions; incomplete or invalid intermediate rows show a non-draggable preview. The bottom row automatically applies the initial value to the latest completed transformation. Its input and result cannot be dragged or edited; the fixed goal stays visible until the level is solved. Filled shapes represent values by their types; the pictures do not expose runtime contents such as numbers.
- **Function input slots** — in icon mode, each input initially shows its expected type inside the function’s rectangle. Drop directly onto that diagram or tap it to choose an argument. The argument replaces the expected-type diagram in place; clearing it restores the expected type. Drag the blue border to move or remove the whole function. Slots accept function-valued parameters, palette functions and earlier function results. Drop onto a filled slot to replace it, or drag its contents out to clear it. Each construction row has one function input. Complete that input before reusing the result in a later row. Text mode shows the entire program as editable Haskell source.
- In icon mode, completed construction rows offer one spare row above the automatic final application. Incomplete rows wait for their one function argument. The final row has a fixed starting value; it previews the actual result when the transformation accepts that value, and marks success only when the result and exact function supplies satisfy the puzzle. Placing the single transformation in levels 1 and 2 runs it immediately. The next drop target scrolls into view without focusing a text field or opening the keyboard. Empty rows are removed automatically. Undo/redo covers row changes and dragging.
- **Text mode** shows one continuous editor with properly indented `let` bindings and the final `in` expression, without row cards. Enter and Tab support indentation; edits, binding names and unfinished drafts survive refreshes and mode switches. Saved single-expression solutions automatically convert to rows, preserving their meaning. Unfinished expressions remain available to repair.
- **Exact function supplies** — each function has an explicit `uses` count per level, based on its reference solution. Placing a function as a call or an argument consumes one copy; a badge shows remaining copies when more than one is supplied. Exhausted functions disappear from the palette and input pickers. Moving a card costs no extra copy; replacing or removing it returns its copy. Undo, refresh, and mode switches preserve the inventory by deriving it from the program. Starting parameters also have explicit per-level supplies: one copy of the starting value in every level. The ordinary input is reserved for the automatic final row in icon mode; function-valued parameters remain selectable. Their cards disappear when depleted and return when cleared; counts and availability also apply to input pickers and text mode. References to earlier results remain reusable.
- **Learning requirements** — use exactly the supplied copies, all contributing to the final expression. Extra copies anywhere in the program fail validation, and unused bindings cannot satisfy missing uses. Text mode enforces the same counts while preserving invalid drafts for repair. Required higher-order functions cannot be skipped by manually producing the target. There is no length or operation-count score.
- **Automatic completion** — matching the target and satisfying the learning requirements immediately marks the level solved and enables Next (Finish on the last level). The editor stays open. Old completion records are rechecked against these rules while keeping saved programs and preferences.
- Touch drag-and-drop — drag a function/parameter card straight into the editor, in either mode. In icon mode, drag an editor token within or between rows, or out to remove it. No hold is needed. Swipe the background or gaps between cards to scroll.
- Semantic icons show each level’s actual type transformations, including ordered slots, pairs, nested wrappers, and function arguments. Generic types use distinct dotted gray outlines, with the same outline repeated wherever a type variable occurs in a function. Concrete types use colored hollow shapes. Starting parameters, placed value arguments, and completed value results use the same shapes filled with their type color. Empty inputs and function signature diagrams keep their type outlines. Expected outputs and the final goal show the values to produce: known concrete shapes are filled, while unknown generic parts remain dotted. Previews remain non-draggable until usable. As arguments specialize a call, assigned types in empty inputs appear inside their original gray outlines. The gray outline can grow around an entire pair, wrapper, or function without shrinking its contents. Starting values, placed arguments, and actual or expected value results show their own structure without the dotted generic slot around them. Clearing an argument restores the expected type slot. Function values keep the generic placeholders within their own signatures, without the receiving slot’s frame.
- In icon mode, drop beside a function to insert normally, with no automatic connector. Drop onto the center of a function to choose from the level’s operators, preview the resulting code, or swap the order. This works with touch and mouse, including moving existing editor tokens.
- Saved solutions from the earlier automatic-chaining editor retain their meaning through a one-time conversion to explicit `$` connectors.
- Dragging a row's main function out in icon mode clears that row's arguments too; undo restores the whole call. Dragging an argument out clears only that input. In unstructured expressions, dragging a function out also removes an adjacent explicit connector.
- A read-only function prefix on its own line, with a left-aligned solution playground below it
- Editor contents persisted in localStorage
- "Show reference rows" on completion

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

Every reference solution now builds functions in its intermediate rows and applies the single starting value in its final row. Every intermediate reference result is used once; the editor still allows reusing generated results. Every level enforces function-only intermediate applications and the final-input rule, in addition to exact supplies. Icon mode creates the final application automatically; text mode exposes the equivalent explicit Haskell expression.

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
