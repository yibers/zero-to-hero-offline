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
- **17 puzzles** — a wrapping introduction before the original puzzles, 10 original levels, an introductory composition puzzle, and 5 additional functional-programming puzzles
- **GeckoGraph rendering** — SVG-based gecko graph visualization running entirely in the browser
- **Self-hosted fonts** — Fira Code, Exo, and Orbitron in `fonts/` (OFL licensed)
- **Offline-capable** — Works by opening `index.html` directly, no web server needed

### File structure

```
index.html      — Main app and type checker
levels.js       — 17 puzzle definitions
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
- GeckoGraph toggle for visual type display
- Prev / Next navigation, with automatic completion
- Opens directly into the puzzle; a final dialog celebrates completing the game
- **Clear level** restarts only the current puzzle, restoring all supplied cards and removing its solved mark while preserving other levels and display preferences
- Solved (✓) indicator per level

### Additional features

- **One operation per step** — apply a function to its arguments, or use one infix operator. Icon mode uses one row per step; text mode uses one `let` binding per intermediate step and an `in` expression for the final answer. Nested calls belong in separate steps. Bare function/value references are also allowed.
- **Composition builds a function** — `(.)` has two function inputs. Apply its resulting function to a value in a separate step, or compose that result with another function to build a longer transformation. The same rule applies in text mode and when using aliases or partially applied composition.
- Earlier results have stable names (`r1`, `r2`, …) and can be reused by dragging the output beside a function into a later row, or by selecting it from an input’s picker. Results may themselves be functions. The input type diagrams inside each row are the argument drop targets; the function’s output appears once, to the right of the row’s arrow. Functions in the palette and function-valued arguments keep their complete diagrams. Intermediate rows show only their expected result pattern to the right of the arrow, even before all inputs are filled. It starts with generic placeholders, specializes as arguments are supplied, and returns to placeholders when those arguments are removed. Composition shows the function it produces. Intermediate results drag their actual inferred value, including partially applied functions; incomplete or invalid intermediate rows show a non-draggable preview. The pending final goal is read-only until the puzzle is solved. The bottom row is the final answer. Filled shapes represent values by their types; the pictures do not expose runtime contents such as numbers.
- **Function input slots** — in icon mode, each input initially shows its expected type inside the function’s rectangle. Drop directly onto that diagram or tap it to choose an argument. The argument replaces the expected-type diagram in place; clearing it restores the expected type. Drag the blue border to move or remove the whole function. Slots accept parameters, functions and earlier results. Drop onto a filled slot to replace it, or drag its contents out to clear it. Inputs can be filled in any order; an internal gap stays visible as `_` until filled. Leaving trailing inputs empty keeps a valid partially applied function. Text mode shows the entire program as editable Haskell source.
- In icon mode, the final row keeps the fixed goal beside its function while the expected output can still match that goal. Unfilled inputs remain generic. Supplying an argument that makes the output incompatible creates a spare row with the goal; clearing or changing inputs can bring the goal back and remove the unused spare. This compatibility check does not mark the puzzle solved or fill in inputs from the goal. The next drop target scrolls into view when the last step changes. Adding a row keeps focus out of text fields and does not show a typing cursor or request the on-screen keyboard. The spare drop target becomes part of the program only when used, so it does not affect the final answer. Empty rows are removed automatically. Undo/redo covers typing, row changes and dragging.
- **Text mode** shows one continuous editor with properly indented `let` bindings and the final `in` expression, without row cards. Enter and Tab support indentation; edits, binding names and unfinished drafts survive refreshes and mode switches. Saved single-expression solutions automatically convert to rows, preserving their meaning. Unfinished expressions remain available to repair.
- **Exact function supplies** — each function has an explicit `uses` count per level, based on its reference solution. Placing a function as a call or an argument consumes one copy; a badge shows remaining copies when more than one is supplied. Exhausted functions disappear from the palette and input pickers. Moving a card costs no extra copy; replacing or removing it returns its copy. Undo, refresh, and mode switches preserve the inventory by deriving it from the program. Starting parameters also have explicit per-level supplies: normally one copy, with three copies of `z` in level 9 and two in level 17. Their cards disappear when depleted and return when cleared; counts and availability also apply to input pickers and text mode. Unused parameter choices (such as `ad` and `cd` in level 10) may remain. References to earlier results remain reusable.
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

Every listed function is required; repeated use is allowed. The palette follows the learning goal, including higher-order functions even when manual steps could reach the same target. Starting parameters, including the function parameters in level 10, remain puzzle inputs.

| Level | Functions |
| --- | --- |
| 1 | `wrap` |
| 2 | `f` |
| 3 | `runZero`, `mkHero` |
| 4 | `runZero`, `mkHero`, `(.)` |
| 5 | `f1`, `f3`, `(.)` |
| 6 | `f2`, `f4`, `(.)` |
| 7 | `snd`, `f1`, `f3`, `(.)` |
| 8 | `f1`, `f2`, `f3`, `(.)` |
| 9 | `f1`, `f2`, `f3`, `(<$>)`, `(<*>)`, `(.)` |
| 10 | `fmap`, `f1`, `f2`, `(.)` |
| 11 | `f1`, `f2`, `f3`, `(.)` |
| 12 | `f1`, `f2`, `f3`, `(.)` |
| 13 | `wrap`, `join` |
| 14 | `f`, `dup`, `(>>=)` |
| 15 | `f`, `swap`, `(<$>)` |
| 16 | `f`, `dup`, `nest`, `(>>=)` |
| 17 | `f`, `g`, `pair`, `(<$>)`, `(<*>)` |

Level 1 starts with a plain value and supplies `wrap :: a -> Zero a`. Its goal is that same value inside Zero. In `Zero a`, `Zero` is a type constructor and `a` is the type of the contained value; the game displays type shapes rather than concrete contents such as numbers. The original levels are now numbered 2–17; saved programs and completions remain attached to their original puzzles.

Level 4 repeats level 3’s `runZero`/`mkHero` puzzle and adds required composition. Existing saved work and completion records move with their original levels; the new level starts unsolved. Composition is introduced in level 4 and remains required through level 12. In these levels, build reusable transformations with `(.)` instead of bypassing it with a chain of value-only rows. Level 9 also requires `(<$>)` to lift composition into `Hero`, then `(<*>)` to combine the wrapped functions and apply them to the wrapped value.

Levels 14 and 16 teach bind; level 17 focuses on combining independent `Hero` values with `(<$>)` and `(<*>)`. Its removed bind operator has no useful matching step with the existing helpers. `($)` stays removed because rows already provide application and intermediate results. The removed `f2` in level 5, `f1`/`f3` in level 6, and `fst`/`f2` in level 7 stay removed because they do not contribute to these lessons' solutions.

## Running

Open `index.html` in a browser. That's it.

Before publishing JavaScript or CSS changes, run `npm run version:assets`. This updates the file versions in `index.html` so browsers load the matching assets instead of an older cached editor.

## Testing

```bash
node --test tests/*.test.cjs
npx playwright test
```

Runs Playwright end-to-end tests covering UI rendering, type inference, level completion, GeckoGraph display, mouse dragging, and phone touch gestures (Chromium).

## Attribution

All game design, puzzle design, and GeckoGraph notation credit belongs to the original authors at Monash University. This was built as a learning exercise and for offline use. The original game is at [zerotohero.fly.dev](https://zerotohero.fly.dev).
