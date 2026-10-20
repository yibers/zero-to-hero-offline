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
- **15 levels** — 10 original levels plus 5 monad levels (Functor, Applicative, Monad, MonadFish, MonadJoin)
- **GeckoGraph rendering** — SVG-based gecko graph visualization running entirely in the browser
- **Self-hosted fonts** — Fira Code, Exo, and Orbitron in `fonts/` (OFL licensed)
- **Offline-capable** — Works by opening `index.html` directly, no web server needed

### File structure

```
index.html      — Main app and type checker
levels.js       — 15 puzzle definitions
semantic-icons.js — SVG type patterns and per-level action descriptions
row-program.js  — Expression parsing, row validation, migration and scoring
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
- Prev / Attempt / Bypass / Next navigation
- Bypass points earned by solving levels
- Intro dialog and level completion dialogs
- Solved (✓) and Optimal (★) indicators per level

### Additional features

- **One operation per step** — apply a function to its arguments, or use one infix operator. Icon mode uses one row per step; text mode uses one `let` binding per intermediate step and an `in` expression for the final answer. Nested calls belong in separate steps. Bare function/value references are also allowed.
- Earlier results have stable names (`r1`, `r2`, …) and can be reused by dragging the output below a function into a later row, or by selecting it from an input’s picker. Results may themselves be functions. Each row renders its inferred output as a draggable pictogram, including pairs, nested wrappers and functions; the bottom row is the final answer. These pictures describe types, not concrete runtime values.
- **Function input slots** — in icon mode, each argument appears once, inside its function’s rectangle. Drop into an input or tap it to choose a value. Slots accept parameters, functions and earlier results. Drop onto a filled slot to replace it, or drag its contents out to clear it. Inputs can be filled in any order; an internal gap stays visible as `_` until filled. Leaving trailing inputs empty keeps a valid partially applied function. **Edit code** switches that row to the expression editor; **Show block** returns to the function block. Text mode shows the entire program as editable Haskell source.
- In icon mode, an empty row is always ready for the next function until the current program solves the level. The spare drop target becomes part of the program only when used, so it does not affect the final answer or conciseness. You can also add rows with **+ Add row** or Enter. Each row has an **×** button. Before deleting, a confirmation highlights and lists that row and all rows below that depend on it, including indirect dependencies. Confirming removes them together; one undo restores them all. Undo/redo covers typing, row changes and dragging.
- **Text mode** shows one continuous editor with properly indented `let` bindings and the final `in` expression, without row cards. Enter and Tab support indentation; edits, binding names and unfinished drafts survive refreshes and mode switches. Icon mode also has a **Haskell code** preview of the generated non-recursive `let … in …` definition. Saved single-expression solutions automatically convert to rows, preserving their meaning. Unfinished expressions remain available to repair.
- Conciseness compares the number of operations with a reference solution, including unused operations. Row names, whitespace and generated `let` syntax do not count.
- Touch drag-and-drop — drag a function/parameter card straight into the editor, in either mode. In icon mode, drag an editor token within or between rows, or out to remove it. No hold is needed. Swipe the background or gaps between cards to scroll.
- Semantic icons show each level’s actual type transformations, including ordered slots, pairs, nested wrappers, and function arguments. Open “Icon key” for the shared shape legend.
- Operator cards are marked with an “Operator” badge in both text and icon modes.
- In icon mode, drop beside a function to insert normally, with no automatic connector. Drop onto the center of a function to choose from the level’s operators, preview the resulting code, or swap the order. This works with touch and mouse, including moving existing editor tokens.
- Saved solutions from the earlier automatic-chaining editor retain their meaning through a one-time conversion to explicit `$` connectors.
- Dragging a row's main function out in icon mode clears that row's arguments too; undo restores the whole call. Dragging an argument out clears only that input. In unstructured expressions, dragging a function out also removes an adjacent explicit connector.
- A read-only function prefix on its own line, with a left-aligned solution playground below it
- Editor contents persisted in localStorage
- "Show reference rows" on completion
- "Try again" option to improve your solution

## Running

Open `index.html` in a browser. That's it.

## Testing

```bash
npx playwright test
```

Runs Playwright end-to-end tests covering UI rendering, type inference, level completion, GeckoGraph display, mouse dragging, and phone touch gestures (Chromium).

## Attribution

All game design, puzzle design, and GeckoGraph notation credit belongs to the original authors at Monash University. This was built as a learning exercise and for offline use. The original game is at [zerotohero.fly.dev](https://zerotohero.fly.dev).
