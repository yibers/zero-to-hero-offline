// ─── Level Data ───
const LEVELS = [
  {
    level: 1, name: "Trial",
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
    level: 2, name: "Assembly required",
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
    solution: "let\n  r1 = (.) mkHero runZero\nin\n  r1 z"
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
    solution: "let\n  r1 = (.) f3 f1\nin\n  r1 z"
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
    solution: "let\n  r1 = (.) f2 f4\nin\n  r1 z"
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
    solution: "let\n  r1 = (.) f3 f1\n  r2 = (.) snd r1\nin\n  r2 z"
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
    solution: "let\n  r1 = (.) f1 f2\n  r2 = (.) f3 r1\nin\n  r2 z"
  },
  {
    level: 8, name: "TIE fighter",
    init: ["data Zero a b c = DontUseMeZero a b c", "data Hero a = DontUseMeHero a"],
    target: "Zero a b c -> Hero c",
    lhs: "zeroToHero z =",
    parameterUses: { z: 3 },
    testing: "b = zeroToHero (undefined :: Zero SKOLEMa SKOLEMb SKOLEMc)",
    funcs: [
      { name: "f1", sig: "Zero a b c -> Hero (a -> b)", uses: 1 },
      { name: "f2", sig: "Zero a b c -> Hero (b -> c)", uses: 1 },
      { name: "f3", sig: "Zero a b c -> Hero a", uses: 1 },
      { name: "(<$>)", sig: "(a -> b) -> Hero a -> Hero b", uses: 1 },
      { name: "(<*>)", sig: "Hero (a -> c) -> Hero a -> Hero c", uses: 2 },
      { name: "(.)", sig: "(b -> c) -> (a -> b) -> a -> c", uses: 1 }
    ],
    solution: "let\n  r1 = f2 z\n  r2 = (<$>) (.) r1\n  r3 = f1 z\n  r4 = (<*>) r2 r3\n  r5 = f3 z\nin\n  (<*>) r4 r5"
  },
  {
    level: 9, name: "The middle man",
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
    solution: "let\n  r1 = fmap bd\n  r2 = (.) r1 f1\n  r3 = (.) f1 r2\n  r4 = (.) f1 r3\n  r5 = (.) f2 r4\nin\n  r5 z"
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
    solution: "let\n  r1 = (.) f1 f3\n  r2 = (.) f1 r1\n  r3 = (.) f2 r2\nin\n  r3 z"
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
    solution: "let\n  r1 = (.) f2 f1\n  r2 = (.) f1 r1\n  r3 = (.) f2 r2\n  r4 = (.) f1 r3\n  r5 = (.) f2 r4\n  r6 = (.) f2 r5\n  r7 = (.) f3 r6\nin\n  r7 z"
  },
  // ─── Monad levels ───
  {
    level: 12, name: "Flat is justice",
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
    level: 13, name: "Bind them all",
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
    solution: "let\n  r1 = f z\nin\n  r1 >>= dup"
  },
  {
    level: 14, name: "Lift off",
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
    solution: "let\n  r1 = f z\nin\n  swap <$> r1"
  },
  {
    level: 15, name: "Double bind",
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
    solution: "let\n  r1 = f z\n  r2 = r1 >>= dup\nin\n  r2 >>= nest"
  },
  {
    level: 16, name: "Applicative hero",
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
      { name: "(<*>)", sig: "Hero (a -> b) -> Hero a -> Hero b", uses: 1 }
    ],
    solution: "let\n  r1 = g z\n  r2 = pair <$> r1\n  r3 = f z\nin\n  r2 <*> r3"
  },
  {
    level: 0, name: "Wrap a value",
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
