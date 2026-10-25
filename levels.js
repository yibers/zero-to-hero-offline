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
    level: 3, name: "Assembly required",
    init: ["data Zero a = DontUseMeZero a", "data Hero a = DontUseMeHero a"],
    target: "Zero a -> Hero a",
    lhs: "zeroToHero z =",
    parameterUses: { z: 1 },
    testing: "b = zeroToHero (undefined :: Zero SKOLEMa)",
    funcs: [
      { name: "runZero", sig: "Zero a -> a", uses: 1 },
      { name: "mkHero", sig: "a -> Hero a", uses: 1 }
    ],
    solution: "let\n  r1 = runZero z\nin\n  mkHero r1"
  },
  {
    level: 4, name: "Assembly by composition",
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
    level: 5, name: "Which path?",
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
    level: 6, name: "A repeating pattern",
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
    level: 7, name: "A perfect pair",
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
    solution: "let\n  r1 = (.) f3\n  r2 = r1 f1\n  r3 = (.) snd\n  r4 = r3 r2\nin\n  r4 z"
  },
  {
    level: 8, name: "Monty Hall",
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
    solution: "let\n  r1 = (.) f1\n  r2 = r1 f2\n  r3 = (.) f3\n  r4 = r3 r2\nin\n  r4 z"
  },
  {
    level: 9, name: "TIE fighter",
    init: ["data Zero a b c = DontUseMeZero a b c", "data Hero a = DontUseMeHero a"],
    target: "Zero a b c -> Hero c",
    lhs: "zeroToHero z =",
    parameterUses: { z: 1 },
    finalInput: "z",
    testing: "b = zeroToHero (undefined :: Zero SKOLEMa SKOLEMb SKOLEMc)",
    funcs: [
      { name: "f1", sig: "Zero a b c -> Hero (a -> b)", uses: 1 },
      { name: "f2", sig: "Zero a b c -> Hero (b -> c)", uses: 1 },
      { name: "f3", sig: "Zero a b c -> Hero a", uses: 1 },
      { name: "(<*>)", sig: "Applicative f => f (a -> b) -> f a -> f b", uses: 4 },
      { name: "(.)", sig: "(b -> c) -> (a -> b) -> a -> c", uses: 2 }
    ],
    solution: "let\n  r1 = (.) (<*>)\n  r2 = r1 f1\n  r3 = (<*>) r2\n  r4 = r3 f3\n  r5 = (.) (<*>)\n  r6 = r5 f2\n  r7 = (<*>) r6\n  r8 = r7 r4\nin\n  r8 z"
  },
  {
    level: 10, name: "The middle man",
    init: ["data Zero a b c = DontUseMeZero a b c", "data Hero a b c = DontUseMeHero a b c"],
    target: "(a -> d) -> (b -> d) -> (c -> d) -> Zero a b c -> Hero a d c",
    lhs: "zeroToHero ad bd cd z =",
    parameterUses: { ad: 1, bd: 1, cd: 1, z: 1 },
    testing: "b = zeroToHero (undefined :: SKOLEMa -> SKOLEMd) (undefined :: SKOLEMb -> SKOLEMd) (undefined :: SKOLEMc -> SKOLEMd) (undefined :: Zero SKOLEMa SKOLEMb SKOLEMc)",
    funcs: [
      { name: "fmap", sig: "(c -> d) -> Zero a b c -> Zero a b d", uses: 1 },
      { name: "f1", sig: "Zero a b c -> Zero c a b", uses: 3 },
      { name: "f2", sig: "Zero a b c -> Hero a b c", uses: 1 },
      { name: "(.)", sig: "(b -> c) -> (a -> b) -> a -> c", uses: 4 }
    ],
    solution: "let\n  r1 = fmap bd\n  r2 = (.) r1\n  r3 = r2 f1\n  r4 = (.) f1\n  r5 = r4 r3\n  r6 = (.) f1\n  r7 = r6 r5\n  r8 = (.) f2\n  r9 = r8 r7\nin\n  r9 z"
  },
  {
    level: 11, name: "Split the difference",
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
    solution: "let\n  r1 = (.) f1\n  r2 = r1 f3\n  r3 = (.) f1\n  r4 = r3 r2\n  r5 = (.) f2\n  r6 = r5 r4\nin\n  r6 z"
  },
  {
    level: 12, name: "The roller coaster",
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
    solution: "let\n  r1 = (.) f2\n  r2 = r1 f1\n  r3 = (.) f1\n  r4 = r3 r2\n  r5 = (.) f2\n  r6 = r5 r4\n  r7 = (.) f1\n  r8 = r7 r6\n  r9 = (.) f2\n  r10 = r9 r8\n  r11 = (.) f2\n  r12 = r11 r10\n  r13 = (.) f3\n  r14 = r13 r12\nin\n  r14 z"
  },
  // ─── Monad levels ───
  {
    level: 13, name: "Flat is justice",
    init: ["data Zero a = DontUseMeZero a", "data Hero a = DontUseMeHero a"],
    target: "Zero a -> Hero a",
    lhs: "zeroToHero z =",
    parameterUses: { z: 1 },
    testing: "b = zeroToHero (undefined :: Zero SKOLEMa)",
    funcs: [
      { name: "wrap", sig: "Zero a -> Hero (Hero a)", uses: 1 },
      { name: "join", sig: "Hero (Hero a) -> Hero a", uses: 1 }
    ],
    solution: "let\n  r1 = wrap z\nin\n  join r1"
  },
  {
    level: 14, name: "Bind them all",
    init: ["data Zero a = DontUseMeZero a", "data Hero a = DontUseMeHero a"],
    target: "Zero a -> Hero (a, a)",
    lhs: "zeroToHero z =",
    parameterUses: { z: 1 },
    testing: "b = zeroToHero (undefined :: Zero SKOLEMa)",
    funcs: [
      { name: "f", sig: "Zero a -> Hero a", uses: 1 },
      { name: "dup", sig: "a -> Hero (a, a)", uses: 1 },
      { name: "(>>=)", sig: "Hero a -> (a -> Hero b) -> Hero b", uses: 1 }
    ],
    solution: "let\n  r1 = f z\n  r2 = (>>=) r1\nin\n  r2 dup"
  },
  {
    level: 15, name: "Lift off",
    init: ["data Zero a b = DontUseMeZero a b", "data Hero a = DontUseMeHero a"],
    target: "Zero a b -> Hero (b, a)",
    lhs: "zeroToHero z =",
    parameterUses: { z: 1 },
    testing: "b = zeroToHero (undefined :: Zero SKOLEMa SKOLEMb)",
    funcs: [
      { name: "f", sig: "Zero a b -> Hero (a, b)", uses: 1 },
      { name: "swap", sig: "(a, b) -> (b, a)", uses: 1 },
      { name: "(<$>)", sig: "(a -> b) -> Hero a -> Hero b", uses: 1 }
    ],
    solution: "let\n  r1 = f z\n  r2 = (<$>) swap\nin\n  r2 r1"
  },
  {
    level: 16, name: "Double bind",
    init: ["data Zero a = DontUseMeZero a", "data Hero a = DontUseMeHero a"],
    target: "Zero a -> Hero (a, (a, a))",
    lhs: "zeroToHero z =",
    parameterUses: { z: 1 },
    testing: "b = zeroToHero (undefined :: Zero SKOLEMa)",
    funcs: [
      { name: "f", sig: "Zero a -> Hero a", uses: 1 },
      { name: "dup", sig: "a -> Hero (a, a)", uses: 1 },
      { name: "nest", sig: "(a, a) -> Hero (a, (a, a))", uses: 1 },
      { name: "(>>=)", sig: "Hero a -> (a -> Hero b) -> Hero b", uses: 2 }
    ],
    solution: "let\n  r1 = f z\n  r2 = (>>=) r1\n  r3 = r2 dup\n  r4 = (>>=) r3\nin\n  r4 nest"
  },
  {
    level: 17, name: "Applicative hero",
    init: ["data Zero a b = DontUseMeZero a b", "data Hero a = DontUseMeHero a"],
    target: "Zero a b -> Hero (b, a)",
    lhs: "zeroToHero z =",
    parameterUses: { z: 2 },
    testing: "b = zeroToHero (undefined :: Zero SKOLEMa SKOLEMb)",
    funcs: [
      { name: "f", sig: "Zero a b -> Hero a", uses: 1 },
      { name: "g", sig: "Zero a b -> Hero b", uses: 1 },
      { name: "pair", sig: "a -> b -> (a, b)", uses: 1 },
      { name: "(<$>)", sig: "(a -> b) -> Hero a -> Hero b", uses: 1 },
      { name: "(<*>)", sig: "Applicative f => f (a -> b) -> f a -> f b", uses: 1 }
    ],
    solution: "let\n  r1 = g z\n  r2 = (<$>) pair\n  r3 = r2 r1\n  r4 = f z\n  r5 = (<*>) r3\nin\n  r5 r4"
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

// Keep saved array indices stable; navigation follows the displayed level order.
const LEVEL_ORDER = LEVELS.map((_, index) => index).sort((a, b) => LEVELS[a].level - LEVELS[b].level);
