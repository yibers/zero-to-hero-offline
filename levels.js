// Array positions are persistent save identities. Append new puzzles; never reorder this array.
// Display numbers define the curriculum and can change without moving saved work.
const LEVELS = [
  {
    id: "change-wrapper", level: 2, name: "Change a wrapper",
    objective: "Replace Zero with Hero while keeping the contained type.",
    init: ["data Zero a = DontUseMeZero a", "data Hero a = DontUseMeHero a"],
    target: "Zero a -> Hero a",
    lhs: "zeroToHero z =",
    parameterUses: { z: 1 },
    testing: "b = zeroToHero (undefined :: Zero SKOLEMa)",
    funcs: [
      { name: "f", sig: "Zero a -> Hero a", uses: 1 }
    ],
    solution: "f z"
  },
  {
    id: "compose-two", level: 3, name: "Compose two functions",
    objective: "Connect transformations in execution order with >>>, matching the intermediate type.",
    init: ["data Zero a = DontUseMeZero a", "data Hero a = DontUseMeHero a"],
    target: "Zero a -> Hero a",
    lhs: "zeroToHero z =",
    parameterUses: { z: 1 },
    testing: "b = zeroToHero (undefined :: Zero SKOLEMa)",
    funcs: [
      { name: "runZero", sig: "Zero a -> a", uses: 1 },
      { name: "mkHero", sig: "a -> Hero a", uses: 1 },
      { name: "(>>>)", sig: "(a -> b) -> (b -> c) -> a -> c", uses: 1 }
    ],
    solution: "let\n  r1 = (>>>) runZero\n  r2 = r1 mkHero\nin\n  r2 z"
  },
  {
    id: "make-pair", level: 4, name: "Make a pair",
    objective: "Duplicate a value into a pair inside Hero.",
    init: ["data Zero a = DontUseMeZero a", "data Hero a = DontUseMeHero a"],
    target: "Zero a -> Hero (a, a)",
    lhs: "zeroToHero z =",
    parameterUses: { z: 1 },
    testing: "b = zeroToHero (undefined :: Zero SKOLEMa)",
    funcs: [
      { name: "f1", sig: "Zero a -> Hero a", uses: 1 },
      { name: "f3", sig: "Hero a -> Hero (a, a)", uses: 1 },
      { name: "(>>>)", sig: "(a -> b) -> (b -> c) -> a -> c", uses: 1 }
    ],
    solution: "let\n  r1 = (>>>) f1\n  r2 = r1 f3\nin\n  r2 z"
  },
  {
    id: "match-types", level: 5, name: "Match repeated types",
    objective: "Make repeated generic slots agree before changing the wrapper.",
    init: ["data Zero a b = DontUseMeZero a b", "data Hero a b = DontUseMeHero a b"],
    target: "Zero a b -> Hero b b",
    lhs: "zeroToHero z =",
    parameterUses: { z: 1 },
    testing: "b = zeroToHero (undefined :: Zero SKOLEMa SKOLEMb)",
    funcs: [
      { name: "f2", sig: "Zero a a -> Hero a a", uses: 1 },
      { name: "f4", sig: "Zero a b -> Zero b b", uses: 1 },
      { name: "(>>>)", sig: "(a -> b) -> (b -> c) -> a -> c", uses: 1 }
    ],
    solution: "let\n  r1 = (>>>) f4\n  r2 = r1 f2\nin\n  r2 z"
  },
  {
    id: "nested-pairs", level: 10, name: "Work with nested pairs",
    objective: "Select a component after building and splitting a nested pair.",
    init: ["data Zero a b = DontUseMeZero a b", "data Hero a = DontUseMeHero a"],
    target: "Zero a b -> Hero (a, b)",
    lhs: "zeroToHero z =",
    parameterUses: { z: 1 },
    testing: "b = zeroToHero (undefined :: Zero SKOLEMa SKOLEMb)",
    funcs: [
      { name: "snd", sig: "(a, b) -> b", uses: 1 },
      { name: "f1", sig: "Zero a b -> Zero a (a, b)", uses: 1 },
      { name: "f3", sig: "Zero a b -> (Hero a, Hero b)", uses: 1 },
      { name: "(>>>)", sig: "(a -> b) -> (b -> c) -> a -> c", uses: 2 }
    ],
    solution: "let\n  r1 = (>>>) f1\n  r2 = r1 f3\n  r3 = (>>>) r2\n  r4 = r3 snd\nin\n  r4 z"
  },
  {
    id: "rearrange-slots", level: 7, name: "Rearrange slots",
    objective: "Reorder and duplicate slots to meet a transformation’s input.",
    init: ["data Zero a b c = DontUseMeZero a b c", "data Hero a b = DontUseMeHero a b"],
    target: "Zero a b c -> Hero c a",
    lhs: "zeroToHero z =",
    parameterUses: { z: 1 },
    testing: "b = zeroToHero (undefined :: Zero SKOLEMa SKOLEMb SKOLEMc)",
    funcs: [
      { name: "f1", sig: "Zero a b c -> Zero c b a", uses: 1 },
      { name: "f2", sig: "Zero a b c -> Zero a c c", uses: 1 },
      { name: "f3", sig: "Zero a b c -> Hero b c", uses: 1 },
      { name: "(>>>)", sig: "(a -> b) -> (b -> c) -> a -> c", uses: 2 }
    ],
    solution: "let\n  r1 = (>>>) f2\n  r2 = r1 f1\n  r3 = (>>>) r2\n  r4 = r3 f3\nin\n  r4 z"
  },
  {
    id: "reverse-applicative", level: 20, name: "Reverse applicative application",
    objective: "Use <**> to take the value-producing function before the function-producing one.",
    init: ["data Zero a b c = DontUseMeZero a b c", "data Hero a = DontUseMeHero a"],
    target: "Zero a b c -> Hero c",
    lhs: "zeroToHero z =",
    parameterUses: { z: 1 },
    finalInput: "z",
    testing: "b = zeroToHero (undefined :: Zero SKOLEMa SKOLEMb SKOLEMc)",
    funcs: [
      { name: "f1", sig: "Zero a b c -> a -> b", uses: 1 },
      { name: "f2", sig: "Zero a b c -> b -> Hero c", uses: 1 },
      { name: "f3", sig: "Zero a b c -> a", uses: 1 },
      { name: "(<**>)", sig: "Applicative f => f a -> f (a -> b) -> f b", uses: 2 }
    ],
    solution: "let\n  r1 = (<**>) f3\n  r2 = r1 f1\n  r3 = (<**>) r2\n  r4 = r3 f2\nin\n  r4 z"
  },
  {
    id: "map-middle", level: 15, name: "Map then rotate",
    objective: "Map Zero’s last slot, then rotate the converted value to the front and change Zero to Hero.",
    init: ["data Zero a b c = DontUseMeZero a b c", "data Hero a b c = DontUseMeHero a b c", "data B = DontUseMeB", "data D = DontUseMeD"],
    target: "Zero a c B -> Hero D a c",
    lhs: "zeroToHero z =",
    parameterUses: { z: 1 },
    finalInput: "z",
    testing: "b = zeroToHero (undefined :: Zero SKOLEMa SKOLEMc B)",
    funcs: [
      { name: "bd", sig: "B -> D", uses: 1 },
      { name: "fmap", sig: "(c -> d) -> Zero a b c -> Zero a b d", uses: 1 },
      { name: "f1", sig: "Zero a b c -> Zero c a b", uses: 1 },
      { name: "f2", sig: "Zero a b c -> Hero a b c", uses: 1 },
      { name: "(>>>)", sig: "(a -> b) -> (b -> c) -> a -> c", uses: 2 }
    ],
    solution: "let\n  r1 = fmap bd\n  r2 = (>>>) r1\n  r3 = r2 f1\n  r4 = (>>>) r3\n  r5 = r4 f2\nin\n  r5 z"
  },
  {
    id: "longer-composition", level: 8, name: "Build a longer composition",
    objective: "Plan a longer chain using repeated duplication and rearrangement.",
    init: ["data Zero a b c d = DontUseMeZero a b c d", "data Hero a b c d = DontUseMeHero a b c d"],
    target: "Zero a b c d -> Hero d d d d",
    lhs: "zeroToHero z =",
    parameterUses: { z: 1 },
    testing: "b = zeroToHero (undefined :: Zero SKOLEMa SKOLEMb SKOLEMc SKOLEMd)",
    funcs: [
      { name: "f1", sig: "Zero a b c d -> Zero a a b b", uses: 2 },
      { name: "f2", sig: "Zero a b c d -> Hero c c d d", uses: 1 },
      { name: "f3", sig: "Zero a b c d -> Zero d c b a", uses: 1 },
      { name: "(>>>)", sig: "(a -> b) -> (b -> c) -> a -> c", uses: 3 }
    ],
    solution: "let\n  r1 = (>>>) f3\n  r2 = r1 f1\n  r3 = (>>>) r2\n  r4 = r3 f1\n  r5 = (>>>) r4\n  r6 = r5 f2\nin\n  r6 z"
  },
  {
    id: "curried-application", level: 17, name: "Apply a curried function",
    objective: "Apply a stored function one argument at a time, rotating between applications.",
    init: ["data Zero a b c d = DontUseMeZero a b c d", "data Hero a = DontUseMeHero a"],
    target: "Zero (a -> b -> c -> d) a b c -> Hero d",
    lhs: "zeroToHero z =",
    parameterUses: { z: 1 },
    testing: "b = zeroToHero (undefined :: Zero (SKOLEMa -> SKOLEMb -> SKOLEMc -> SKOLEMd) SKOLEMa SKOLEMb SKOLEMc)",
    funcs: [
      { name: "f1", sig: "Zero (a -> b) a c d -> Zero () b c d", uses: 3 },
      { name: "f2", sig: "Zero a b c d -> Zero b c d a", uses: 4 },
      { name: "f3", sig: "Zero a b c d -> Hero d", uses: 1 },
      { name: "(>>>)", sig: "(a -> b) -> (b -> c) -> a -> c", uses: 7 }
    ],
    solution: "let\n  r1 = (>>>) f1\n  r2 = r1 f2\n  r3 = (>>>) r2\n  r4 = r3 f1\n  r5 = (>>>) r4\n  r6 = r5 f2\n  r7 = (>>>) r6\n  r8 = r7 f1\n  r9 = (>>>) r8\n  r10 = r9 f2\n  r11 = (>>>) r10\n  r12 = r11 f2\n  r13 = (>>>) r12\n  r14 = r13 f3\nin\n  r14 z"
  },
  {
    id: "flatten-wrappers", level: 21, name: "Flatten nested wrappers",
    objective: "Use join to remove one layer of a nested Hero wrapper.",
    init: ["data Zero a = DontUseMeZero a", "data Hero a = DontUseMeHero a"],
    target: "Zero a -> Hero a",
    lhs: "zeroToHero z =",
    parameterUses: { z: 1 },
    finalInput: "z",
    testing: "b = zeroToHero (undefined :: Zero SKOLEMa)",
    funcs: [
      { name: "wrap", sig: "Zero a -> Hero (Hero a)", uses: 1 },
      { name: "join", sig: "Hero (Hero a) -> Hero a", uses: 1 },
      { name: "(>>>)", sig: "(a -> b) -> (b -> c) -> a -> c", uses: 1 }
    ],
    solution: "let\n  r1 = (>>>) wrap\n  r2 = r1 join\nin\n  r2 z"
  },
  {
    id: "bind", level: 23, name: "Bind a wrapped result",
    objective: "Use >>= to feed a wrapped value into a function that returns a wrapper.",
    init: ["data Hero a = DontUseMeHero a"],
    target: "Hero a -> Hero (a, a)",
    lhs: "zeroToHero z =",
    parameterUses: { z: 1 },
    finalInput: "z",
    testing: "b = zeroToHero (undefined :: Hero SKOLEMa)",
    funcs: [
      { name: "dup", sig: "a -> Hero (a, a)", uses: 1 },
      { name: "(>>=)", sig: "Hero a -> (a -> Hero b) -> Hero b", uses: 1 },
      { name: "flip", sig: "(a -> b -> c) -> b -> a -> c", uses: 1 }
    ],
    solution: "let\n  r1 = flip (>>=)\n  r2 = r1 dup\nin\n  r2 z"
  },
  {
    id: "map-wrapper", level: 11, name: "Map inside a wrapper",
    objective: "Use fmap to change the contents of Hero without removing its wrapper.",
    init: ["data Hero a = DontUseMeHero a"],
    target: "Hero (a, b) -> Hero (b, a)",
    lhs: "zeroToHero z =",
    parameterUses: { z: 1 },
    finalInput: "z",
    testing: "b = zeroToHero (undefined :: Hero (SKOLEMa, SKOLEMb))",
    funcs: [
      { name: "swap", sig: "(a, b) -> (b, a)", uses: 1 },
      { name: "fmap", sig: "(a -> b) -> Hero a -> Hero b", uses: 1 }
    ],
    solution: "let\n  r1 = fmap swap\nin\n  r1 z"
  },
  {
    id: "chain-wrapped", level: 25, name: "Chain wrapped results",
    objective: "Extend Kleisli composition to three transformations that return Hero.",
    init: ["data Zero a = DontUseMeZero a", "data Hero a = DontUseMeHero a"],
    target: "Zero a -> Hero (a, (a, a))",
    lhs: "zeroToHero z =",
    parameterUses: { z: 1 },
    finalInput: "z",
    testing: "b = zeroToHero (undefined :: Zero SKOLEMa)",
    funcs: [
      { name: "f", sig: "Zero a -> Hero a", uses: 1 },
      { name: "dup", sig: "a -> Hero (a, a)", uses: 1 },
      { name: "nest", sig: "(a, a) -> Hero (a, (a, a))", uses: 1 },
      { name: "(>=>)", sig: "(a -> Hero b) -> (b -> Hero c) -> a -> Hero c", uses: 2 }
    ],
    solution: "let\n  r1 = (>=>) f\n  r2 = r1 dup\n  r3 = (>=>) r2\n  r4 = r3 nest\nin\n  r4 z"
  },
  {
    id: "shared-input", level: 19, name: "Share an input with <*>",
    objective: "Combine two functions that receive the same final input.",
    init: ["data Zero a b = DontUseMeZero a b", "data Hero a = DontUseMeHero a"],
    target: "Zero a b -> Hero (b, a)",
    lhs: "zeroToHero z =",
    parameterUses: { z: 1 },
    finalInput: "z",
    testing: "b = zeroToHero (undefined :: Zero SKOLEMa SKOLEMb)",
    funcs: [
      { name: "f", sig: "Zero a b -> a", uses: 1 },
      { name: "g", sig: "Zero a b -> b", uses: 1 },
      { name: "pair", sig: "a -> b -> Hero (a, b)", uses: 1 },
      { name: "fmap", sig: "(a -> b) -> (r -> a) -> r -> b", uses: 1 },
      { name: "(<*>)", sig: "Applicative f => f (a -> b) -> f a -> f b", uses: 1 }
    ],
    solution: "let\n  r1 = fmap pair\n  r2 = r1 g\n  r3 = (<*>) r2\n  r4 = r3 f\nin\n  r4 z"
  },
  {
    id: "wrap-value", level: 1, name: "Wrap a value",
    objective: "Put a value inside a wrapper without changing its type.",
    init: ["data Zero a = DontUseMeZero a"],
    target: "a -> Zero a",
    lhs: "wrapValue value =",
    parameterUses: { value: 1 },
    testing: "b = wrapValue (undefined :: SKOLEMa)",
    funcs: [
      { name: "wrap", sig: "a -> Zero a", uses: 1 }
    ],
    solution: "wrap value"
  },
  {
    id: "compose-three", level: 6, name: "Compose three functions",
    objective: "Extend a familiar two-function composition by one more transformation.",
    init: ["data Zero a = DontUseMeZero a", "data Hero a = DontUseMeHero a"],
    target: "Zero a -> Hero (a, a)",
    lhs: "zeroToHero z =",
    parameterUses: { z: 1 },
    finalInput: "z",
    testing: "b = zeroToHero (undefined :: Zero SKOLEMa)",
    funcs: [
      { name: "runZero", sig: "Zero a -> a", uses: 1 },
      { name: "mkHero", sig: "a -> Hero a", uses: 1 },
      { name: "dup", sig: "Hero a -> Hero (a, a)", uses: 1 },
      { name: "(>>>)", sig: "(a -> b) -> (b -> c) -> a -> c", uses: 2 }
    ],
    solution: "let\n  r1 = (>>>) runZero\n  r2 = r1 mkHero\n  r3 = (>>>) r2\n  r4 = r3 dup\nin\n  r4 z"
  },
  {
    id: "select-pair", level: 9, name: "Select from a pair",
    objective: "Use snd to keep the second component of a pair.",
    init: [],
    target: "(a, b) -> b",
    lhs: "zeroToHero z =",
    parameterUses: { z: 1 },
    finalInput: "z",
    testing: "b = zeroToHero (undefined :: (SKOLEMa, SKOLEMb))",
    funcs: [
      { name: "snd", sig: "(a, b) -> b", uses: 1 }
    ],
    solution: "snd z"
  },
  {
    id: "concrete-conversion", level: 12, name: "Convert a concrete type",
    objective: "Convert the fixed type B to D; fixed types are not interchangeable generic slots.",
    init: ["data B = DontUseMeB", "data D = DontUseMeD"],
    target: "B -> D",
    lhs: "zeroToHero z =",
    parameterUses: { z: 1 },
    finalInput: "z",
    testing: "b = zeroToHero (undefined :: B)",
    funcs: [
      { name: "bd", sig: "B -> D", uses: 1 }
    ],
    solution: "bd z"
  },
  {
    id: "compose-forward", level: 13, name: "Map a concrete type",
    objective: "Use familiar fmap to convert the fixed type B to D inside Hero.",
    init: ["data Hero a = DontUseMeHero a", "data B = DontUseMeB", "data D = DontUseMeD"],
    target: "Hero B -> Hero D",
    lhs: "zeroToHero z =",
    parameterUses: { z: 1 },
    finalInput: "z",
    testing: "b = zeroToHero (undefined :: Hero B)",
    funcs: [
      { name: "bd", sig: "B -> D", uses: 1 },
      { name: "fmap", sig: "(a -> b) -> Hero a -> Hero b", uses: 1 }
    ],
    solution: "let\n  r1 = fmap bd\nin\n  r1 z"
  },
  {
    id: "map-last", level: 14, name: "Map one of several slots",
    objective: "Use fmap on the last slot of Zero while its earlier slots stay unchanged.",
    init: ["data Zero a b c = DontUseMeZero a b c", "data B = DontUseMeB", "data D = DontUseMeD"],
    target: "Zero a b B -> Zero a b D",
    lhs: "zeroToHero z =",
    parameterUses: { z: 1 },
    finalInput: "z",
    testing: "b = zeroToHero (undefined :: Zero SKOLEMa SKOLEMb B)",
    funcs: [
      { name: "bd", sig: "B -> D", uses: 1 },
      { name: "fmap", sig: "(c -> d) -> Zero a b c -> Zero a b d", uses: 1 }
    ],
    solution: "let\n  r1 = fmap bd\nin\n  r1 z"
  },
  {
    id: "stored-application", level: 16, name: "Apply a stored function",
    objective: "Apply the function stored beside its argument; () marks the emptied slot.",
    init: ["data Zero a b = DontUseMeZero a b", "data Hero a = DontUseMeHero a"],
    target: "Zero (a -> b) a -> Hero b",
    lhs: "zeroToHero z =",
    parameterUses: { z: 1 },
    finalInput: "z",
    testing: "b = zeroToHero (undefined :: Zero (SKOLEMa -> SKOLEMb) SKOLEMa)",
    funcs: [
      { name: "apply", sig: "Zero (a -> b) a -> Zero () b", uses: 1 },
      { name: "finish", sig: "Zero a b -> Hero b", uses: 1 },
      { name: "(>>>)", sig: "(a -> b) -> (b -> c) -> a -> c", uses: 1 }
    ],
    solution: "let\n  r1 = (>>>) apply\n  r2 = r1 finish\nin\n  r2 z"
  },
  {
    id: "map-function", level: 18, name: "Map a function’s output",
    objective: "Use fmap on functions to transform their output, keeping the same input.",
    init: ["data Zero a = DontUseMeZero a", "data Hero a = DontUseMeHero a"],
    target: "Zero a -> Hero a",
    lhs: "zeroToHero z =",
    parameterUses: { z: 1 },
    finalInput: "z",
    testing: "b = zeroToHero (undefined :: Zero SKOLEMa)",
    funcs: [
      { name: "runZero", sig: "Zero a -> a", uses: 1 },
      { name: "mkHero", sig: "a -> Hero a", uses: 1 },
      { name: "fmap", sig: "(a -> b) -> (r -> a) -> r -> b", uses: 1 }
    ],
    solution: "let\n  r1 = fmap mkHero\n  r2 = r1 runZero\nin\n  r2 z"
  },
  {
    id: "reverse-arguments", level: 22, name: "Reverse argument order",
    objective: "Use flip to reverse the two function arguments of familiar composition.",
    init: ["data Zero a = DontUseMeZero a", "data Hero a = DontUseMeHero a"],
    target: "Zero a -> Hero a",
    lhs: "zeroToHero z =",
    parameterUses: { z: 1 },
    finalInput: "z",
    testing: "b = zeroToHero (undefined :: Zero SKOLEMa)",
    funcs: [
      { name: "runZero", sig: "Zero a -> a", uses: 1 },
      { name: "mkHero", sig: "a -> Hero a", uses: 1 },
      { name: "(>>>)", sig: "(a -> b) -> (b -> c) -> a -> c", uses: 1 },
      { name: "flip", sig: "(a -> b -> c) -> b -> a -> c", uses: 1 }
    ],
    solution: "let\n  r1 = flip (>>>)\n  r2 = r1 mkHero\n  r3 = r2 runZero\nin\n  r3 z"
  },
  {
    id: "compose-wrapped", level: 24, name: "Compose wrapped results",
    objective: "Use >=> to connect two transformations that each return Hero.",
    init: ["data Zero a = DontUseMeZero a", "data Hero a = DontUseMeHero a"],
    target: "Zero a -> Hero (a, a)",
    lhs: "zeroToHero z =",
    parameterUses: { z: 1 },
    finalInput: "z",
    testing: "b = zeroToHero (undefined :: Zero SKOLEMa)",
    funcs: [
      { name: "f", sig: "Zero a -> Hero a", uses: 1 },
      { name: "dup", sig: "a -> Hero (a, a)", uses: 1 },
      { name: "(>=>)", sig: "(a -> Hero b) -> (b -> Hero c) -> a -> Hero c", uses: 1 }
    ],
    solution: "let\n  r1 = (>=>) f\n  r2 = r1 dup\nin\n  r2 z"
  }
];

const LEVEL_ORDER = LEVELS.map((_, index) => index).sort((a, b) => LEVELS[a].level - LEVELS[b].level);
