// ─── Level Data ───
const LEVELS = [
  {
    level: 2, name: "Trial",
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
    level: 3, name: "Assembly by composition",
    init: ["data Zero a = DontUseMeZero a", "data Hero a = DontUseMeHero a"],
    target: "Zero a -> Hero a",
    lhs: "zeroToHero z =",
    parameterUses: { z: 1 },
    testing: "b = zeroToHero (undefined :: Zero SKOLEMa)",
    funcs: [
      { name: "runZero", sig: "Zero a -> a", uses: 1 },
      { name: "mkHero", sig: "a -> Hero a", uses: 1 },
      { name: "(.)", sig: "(b -> c) -> (a -> b) -> a -> c", uses: 1 }
    ],
    solution: "let\n  r1 = (.) mkHero\n  r2 = r1 runZero\nin\n  r2 z"
  },
  {
    level: 4, name: "Which path?",
    init: ["data Zero a = DontUseMeZero a", "data Hero a = DontUseMeHero a"],
    target: "Zero a -> Hero (a, a)",
    lhs: "zeroToHero z =",
    parameterUses: { z: 1 },
    testing: "b = zeroToHero (undefined :: Zero SKOLEMa)",
    funcs: [
      { name: "f1", sig: "Zero a -> Hero a", uses: 1 },
      { name: "f3", sig: "Hero a -> Hero (a, a)", uses: 1 },
      { name: "(.)", sig: "(b -> c) -> (a -> b) -> a -> c", uses: 1 }
    ],
    solution: "let\n  r1 = (.) f3\n  r2 = r1 f1\nin\n  r2 z"
  },
  {
    level: 5, name: "A repeating pattern",
    init: ["data Zero a b = DontUseMeZero a b", "data Hero a b = DontUseMeHero a b"],
    target: "Zero a b -> Hero b b",
    lhs: "zeroToHero z =",
    parameterUses: { z: 1 },
    testing: "b = zeroToHero (undefined :: Zero SKOLEMa SKOLEMb)",
    funcs: [
      { name: "f2", sig: "Zero a a -> Hero a a", uses: 1 },
      { name: "f4", sig: "Zero a b -> Zero b b", uses: 1 },
      { name: "(.)", sig: "(b -> c) -> (a -> b) -> a -> c", uses: 1 }
    ],
    solution: "let\n  r1 = (.) f2\n  r2 = r1 f4\nin\n  r2 z"
  },
  {
    level: 6, name: "A perfect pair",
    init: ["data Zero a b = DontUseMeZero a b", "data Hero a = DontUseMeHero a"],
    target: "Zero a b -> Hero (a, b)",
    lhs: "zeroToHero z =",
    parameterUses: { z: 1 },
    testing: "b = zeroToHero (undefined :: Zero SKOLEMa SKOLEMb)",
    funcs: [
      { name: "snd", sig: "(a, b) -> b", uses: 1 },
      { name: "f1", sig: "Zero a b -> Zero a (a, b)", uses: 1 },
      { name: "f3", sig: "Zero a b -> (Hero a, Hero b)", uses: 1 },
      { name: "(.)", sig: "(b -> c) -> (a -> b) -> a -> c", uses: 2 }
    ],
    solution: "let\n  r1 = (.) snd\n  r2 = r1 f3\n  r3 = (.) r2\n  r4 = r3 f1\nin\n  r4 z"
  },
  {
    level: 7, name: "Monty Hall",
    init: ["data Zero a b c = DontUseMeZero a b c", "data Hero a b = DontUseMeHero a b"],
    target: "Zero a b c -> Hero c a",
    lhs: "zeroToHero z =",
    parameterUses: { z: 1 },
    testing: "b = zeroToHero (undefined :: Zero SKOLEMa SKOLEMb SKOLEMc)",
    funcs: [
      { name: "f1", sig: "Zero a b c -> Zero c b a", uses: 1 },
      { name: "f2", sig: "Zero a b c -> Zero a c c", uses: 1 },
      { name: "f3", sig: "Zero a b c -> Hero b c", uses: 1 },
      { name: "(.)", sig: "(b -> c) -> (a -> b) -> a -> c", uses: 2 }
    ],
    solution: "let\n  r1 = (.) f3\n  r2 = r1 f1\n  r3 = (.) r2\n  r4 = r3 f2\nin\n  r4 z"
  },
  {
    level: 8, name: "TIE fighter",
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
    level: 9, name: "The middle man",
    init: ["data Zero a b c = DontUseMeZero a b c", "data Hero a b c = DontUseMeHero a b c", "data B = DontUseMeB", "data D = DontUseMeD"],
    target: "Zero a B c -> Hero a D c",
    lhs: "zeroToHero z =",
    parameterUses: { z: 1 },
    finalInput: "z",
    testing: "b = zeroToHero (undefined :: Zero SKOLEMa B SKOLEMc)",
    funcs: [
      { name: "bd", sig: "B -> D", uses: 1 },
      { name: "fmap", sig: "(c -> d) -> Zero a b c -> Zero a b d", uses: 1 },
      { name: "f1", sig: "Zero a b c -> Zero c a b", uses: 3 },
      { name: "f2", sig: "Zero a b c -> Hero a b c", uses: 1 },
      { name: "(.)", sig: "(b -> c) -> (a -> b) -> a -> c", uses: 1 },
      { name: "(>>>)", sig: "(a -> b) -> (b -> c) -> a -> c", uses: 3 }
    ],
    solution: "let\n  r1 = fmap bd\n  r2 = (.) r1\n  r3 = r2 f1\n  r4 = (>>>) r3\n  r5 = r4 f1\n  r6 = (>>>) r5\n  r7 = r6 f1\n  r8 = (>>>) r7\n  r9 = r8 f2\nin\n  r9 z"
  },
  {
    level: 10, name: "Split the difference",
    init: ["data Zero a b c d = DontUseMeZero a b c d", "data Hero a b c d = DontUseMeHero a b c d"],
    target: "Zero a b c d -> Hero d d d d",
    lhs: "zeroToHero z =",
    parameterUses: { z: 1 },
    testing: "b = zeroToHero (undefined :: Zero SKOLEMa SKOLEMb SKOLEMc SKOLEMd)",
    funcs: [
      { name: "f1", sig: "Zero a b c d -> Zero a a b b", uses: 2 },
      { name: "f2", sig: "Zero a b c d -> Hero c c d d", uses: 1 },
      { name: "f3", sig: "Zero a b c d -> Zero d c b a", uses: 1 },
      { name: "(.)", sig: "(b -> c) -> (a -> b) -> a -> c", uses: 3 }
    ],
    solution: "let\n  r1 = (.) f2\n  r2 = r1 f1\n  r3 = (.) r2\n  r4 = r3 f1\n  r5 = (.) r4\n  r6 = r5 f3\nin\n  r6 z"
  },
  {
    level: 11, name: "The roller coaster",
    init: ["data Zero a b c d = DontUseMeZero a b c d", "data Hero a = DontUseMeHero a"],
    target: "Zero (a -> b -> c -> d) a b c -> Hero d",
    lhs: "zeroToHero z =",
    parameterUses: { z: 1 },
    testing: "b = zeroToHero (undefined :: Zero (SKOLEMa -> SKOLEMb -> SKOLEMc -> SKOLEMd) SKOLEMa SKOLEMb SKOLEMc)",
    funcs: [
      { name: "f1", sig: "Zero (a -> b) a c d -> Zero () b c d", uses: 3 },
      { name: "f2", sig: "Zero a b c d -> Zero b c d a", uses: 4 },
      { name: "f3", sig: "Zero a b c d -> Hero d", uses: 1 },
      { name: "(.)", sig: "(b -> c) -> (a -> b) -> a -> c", uses: 7 }
    ],
    solution: "let\n  r1 = (.) f3\n  r2 = r1 f2\n  r3 = (.) r2\n  r4 = r3 f2\n  r5 = (.) r4\n  r6 = r5 f1\n  r7 = (.) r6\n  r8 = r7 f2\n  r9 = (.) r8\n  r10 = r9 f1\n  r11 = (.) r10\n  r12 = r11 f2\n  r13 = (.) r12\n  r14 = r13 f1\nin\n  r14 z"
  },
  // ─── Monad levels ───
  {
    level: 12, name: "Flat is justice",
    init: ["data Zero a = DontUseMeZero a", "data Hero a = DontUseMeHero a"],
    target: "Zero a -> Hero a",
    lhs: "zeroToHero z =",
    parameterUses: { z: 1 },
    finalInput: "z",
    testing: "b = zeroToHero (undefined :: Zero SKOLEMa)",
    funcs: [
      { name: "wrap", sig: "Zero a -> Hero (Hero a)", uses: 1 },
      { name: "join", sig: "Hero (Hero a) -> Hero a", uses: 1 },
      { name: "(.)", sig: "(b -> c) -> (a -> b) -> a -> c", uses: 1 }
    ],
    solution: "let\n  r1 = (.) join\n  r2 = r1 wrap\nin\n  r2 z"
  },
  {
    level: 13, name: "Bind them all",
    init: ["data Zero a = DontUseMeZero a", "data Hero a = DontUseMeHero a"],
    target: "Zero a -> Hero (a, a)",
    lhs: "zeroToHero z =",
    parameterUses: { z: 1 },
    finalInput: "z",
    testing: "b = zeroToHero (undefined :: Zero SKOLEMa)",
    funcs: [
      { name: "f", sig: "Zero a -> Hero a", uses: 1 },
      { name: "dup", sig: "a -> Hero (a, a)", uses: 1 },
      { name: "(>>=)", sig: "Hero a -> (a -> Hero b) -> Hero b", uses: 1 },
      { name: "flip", sig: "(a -> b -> c) -> b -> a -> c", uses: 1 },
      { name: "(.)", sig: "(b -> c) -> (a -> b) -> a -> c", uses: 1 }
    ],
    solution: "let\n  r1 = flip (>>=)\n  r2 = r1 dup\n  r3 = (.) r2\n  r4 = r3 f\nin\n  r4 z"
  },
  {
    level: 14, name: "Lift off",
    init: ["data Zero a b = DontUseMeZero a b", "data Hero a = DontUseMeHero a"],
    target: "Zero a b -> Hero (b, a)",
    lhs: "zeroToHero z =",
    parameterUses: { z: 1 },
    finalInput: "z",
    testing: "b = zeroToHero (undefined :: Zero SKOLEMa SKOLEMb)",
    funcs: [
      { name: "f", sig: "Zero a b -> Hero (a, b)", uses: 1 },
      { name: "swap", sig: "(a, b) -> (b, a)", uses: 1 },
      { name: "(<$>)", sig: "(a -> b) -> Hero a -> Hero b", uses: 1 },
      { name: "(.)", sig: "(b -> c) -> (a -> b) -> a -> c", uses: 1 }
    ],
    solution: "let\n  r1 = (<$>) swap\n  r2 = (.) r1\n  r3 = r2 f\nin\n  r3 z"
  },
  {
    level: 15, name: "Double bind",
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
    level: 16, name: "Applicative hero",
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
      { name: "(<$>)", sig: "(a -> b) -> (r -> a) -> r -> b", uses: 1 },
      { name: "(<*>)", sig: "Applicative f => f (a -> b) -> f a -> f b", uses: 1 }
    ],
    solution: "let\n  r1 = (<$>) pair\n  r2 = r1 g\n  r3 = (<*>) r2\n  r4 = r3 f\nin\n  r4 z"
  },
  {
    level: 1, name: "Wrap a value",
    init: ["data Zero a = DontUseMeZero a"],
    target: "a -> Zero a",
    lhs: "wrapValue value =",
    parameterUses: { value: 1 },
    testing: "b = wrapValue (undefined :: SKOLEMa)",
    funcs: [
      { name: "wrap", sig: "a -> Zero a", uses: 1 }
    ],
    solution: "wrap value"
  }
];

// Navigation follows displayed numbers; levelOrderVersion 2 migrates saved indices
// after removing the old Assembly required puzzle at array index 1.
const LEVEL_ORDER = LEVELS.map((_, index) => index).sort((a, b) => LEVELS[a].level - LEVELS[b].level);
