// ─── Level Data ───
const LEVELS = [
  {
    level: 1, name: "Trial",
    init: ["data Zero a = DontUseMeZero a", "data Hero a = DontUseMeHero a"],
    target: "Zero a -> Hero a",
    lhs: "zeroToHero z =",
    testing: "b = zeroToHero (undefined :: Zero SKOLEMa)",
    funcs: [
      { name: "f", sig: "Zero a -> Hero a" }
    ],
    solution: "f z"
  },
  {
    level: 2, name: "Assembly required",
    init: ["data Zero a = DontUseMeZero a", "data Hero a = DontUseMeHero a"],
    target: "Zero a -> Hero a",
    lhs: "zeroToHero z =",
    testing: "b = zeroToHero (undefined :: Zero SKOLEMa)",
    funcs: [
      { name: "runZero", sig: "Zero a -> a" },
      { name: "mkHero", sig: "a -> Hero a" }
    ],
    solution: "let\n  r1 = runZero z\nin\n  mkHero r1"
  },
  {
    level: 3, name: "Which path?",
    init: ["data Zero a = DontUseMeZero a", "data Hero a = DontUseMeHero a"],
    target: "Zero a -> Hero (a, a)",
    lhs: "zeroToHero z =",
    testing: "b = zeroToHero (undefined :: Zero SKOLEMa)",
    funcs: [
      { name: "f1", sig: "Zero a -> Hero a" },
      { name: "f3", sig: "Hero a -> Hero (a, a)" }
    ],
    solution: "let\n  r1 = f1 z\nin\n  f3 r1"
  },
  {
    level: 4, name: "A repeating pattern",
    init: ["data Zero a b = DontUseMeZero a b", "data Hero a b = DontUseMeHero a b"],
    target: "Zero a b -> Hero b b",
    lhs: "zeroToHero z =",
    testing: "b = zeroToHero (undefined :: Zero SKOLEMa SKOLEMb)",
    funcs: [
      { name: "f2", sig: "Zero a a -> Hero a a" },
      { name: "f4", sig: "Zero a b -> Zero b b" }
    ],
    solution: "let\n  r1 = f4 z\nin\n  f2 r1"
  },
  {
    level: 5, name: "A perfect pair",
    init: ["data Zero a b = DontUseMeZero a b", "data Hero a = DontUseMeHero a"],
    target: "Zero a b -> Hero (a, b)",
    lhs: "zeroToHero z =",
    testing: "b = zeroToHero (undefined :: Zero SKOLEMa SKOLEMb)",
    funcs: [
      { name: "snd", sig: "(a, b) -> b" },
      { name: "f1", sig: "Zero a b -> Zero a (a, b)" },
      { name: "f3", sig: "Zero a b -> (Hero a, Hero b)" }
    ],
    solution: "let\n  r1 = f1 z\n  r2 = f3 r1\nin\n  snd r2"
  },
  {
    level: 6, name: "Monty Hall",
    init: ["data Zero a b c = DontUseMeZero a b c", "data Hero a b = DontUseMeHero a b"],
    target: "Zero a b c -> Hero c a",
    lhs: "zeroToHero z =",
    testing: "b = zeroToHero (undefined :: Zero SKOLEMa SKOLEMb SKOLEMc)",
    funcs: [
      { name: "f1", sig: "Zero a b c -> Zero c b a" },
      { name: "f2", sig: "Zero a b c -> Zero a c c" },
      { name: "f3", sig: "Zero a b c -> Hero b c" }
    ],
    solution: "let\n  r1 = f2 z\n  r2 = f1 r1\nin\n  f3 r2"
  },
  {
    level: 7, name: "TIE fighter",
    init: ["data Zero a b c = DontUseMeZero a b c", "data Hero a = DontUseMeHero a"],
    target: "Zero a b c -> Hero c",
    lhs: "zeroToHero z =",
    testing: "b = zeroToHero (undefined :: Zero SKOLEMa SKOLEMb SKOLEMc)",
    funcs: [
      { name: "f1", sig: "Zero a b c -> Hero (a -> b)" },
      { name: "f2", sig: "Zero a b c -> Hero (b -> c)" },
      { name: "f3", sig: "Zero a b c -> Hero a" },
      { name: "(<*>)", sig: "Hero (a -> c) -> Hero a -> Hero c" }
    ],
    solution: "let\n  r1 = f2 z\n  r2 = f1 z\n  r3 = f3 z\n  r4 = r2 <*> r3\nin\n  r1 <*> r4"
  },
  {
    level: 8, name: "The middle man",
    init: ["data Zero a b c = DontUseMeZero a b c", "data Hero a b c = DontUseMeHero a b c"],
    target: "(a -> d) -> (b -> d) -> (c -> d) -> Zero a b c -> Hero a d c",
    lhs: "zeroToHero ad bd cd z =",
    testing: "b = zeroToHero (undefined :: SKOLEMa -> SKOLEMd) (undefined :: SKOLEMb -> SKOLEMd) (undefined :: SKOLEMc -> SKOLEMd) (undefined :: Zero SKOLEMa SKOLEMb SKOLEMc)",
    funcs: [
      { name: "fmap", sig: "(c -> d) -> Zero a b c -> Zero a b d" },
      { name: "f1", sig: "Zero a b c -> Zero c a b" },
      { name: "f2", sig: "Zero a b c -> Hero a b c" }
    ],
    solution: "let\n  r1 = f1 z\n  r2 = fmap bd r1\n  r3 = f1 r2\n  r4 = f1 r3\nin\n  f2 r4"
  },
  {
    level: 9, name: "Split the difference",
    init: ["data Zero a b c d = DontUseMeZero a b c d", "data Hero a b c d = DontUseMeHero a b c d"],
    target: "Zero a b c d -> Hero d d d d",
    lhs: "zeroToHero z =",
    testing: "b = zeroToHero (undefined :: Zero SKOLEMa SKOLEMb SKOLEMc SKOLEMd)",
    funcs: [
      { name: "f1", sig: "Zero a b c d -> Zero a a b b" },
      { name: "f2", sig: "Zero a b c d -> Hero c c d d" },
      { name: "f3", sig: "Zero a b c d -> Zero d c b a" }
    ],
    solution: "let\n  r1 = f3 z\n  r2 = f1 r1\n  r3 = f1 r2\nin\n  f2 r3"
  },
  {
    level: 10, name: "The roller coaster",
    init: ["data Zero a b c d = DontUseMeZero a b c d", "data Hero a = DontUseMeHero a"],
    target: "Zero (a -> b -> c -> d) a b c -> Hero d",
    lhs: "zeroToHero z =",
    testing: "b = zeroToHero (undefined :: Zero (SKOLEMa -> SKOLEMb -> SKOLEMc -> SKOLEMd) SKOLEMa SKOLEMb SKOLEMc)",
    funcs: [
      { name: "f1", sig: "Zero (a -> b) a c d -> Zero () b c d" },
      { name: "f2", sig: "Zero a b c d -> Zero b c d a" },
      { name: "f3", sig: "Zero a b c d -> Hero d" }
    ],
    solution: "let\n  r1 = f1 z\n  r2 = f2 r1\n  r3 = f1 r2\n  r4 = f2 r3\n  r5 = f1 r4\n  r6 = f2 r5\n  r7 = f2 r6\nin\n  f3 r7"
  },
  // ─── Monad levels ───
  {
    level: 11, name: "Flat is justice",
    init: ["data Zero a = DontUseMeZero a", "data Hero a = DontUseMeHero a"],
    target: "Zero a -> Hero a",
    lhs: "zeroToHero z =",
    testing: "b = zeroToHero (undefined :: Zero SKOLEMa)",
    funcs: [
      { name: "wrap", sig: "Zero a -> Hero (Hero a)" },
      { name: "join", sig: "Hero (Hero a) -> Hero a" }
    ],
    solution: "let\n  r1 = wrap z\nin\n  join r1"
  },
  {
    level: 12, name: "Bind them all",
    init: ["data Zero a = DontUseMeZero a", "data Hero a = DontUseMeHero a"],
    target: "Zero a -> Hero (a, a)",
    lhs: "zeroToHero z =",
    testing: "b = zeroToHero (undefined :: Zero SKOLEMa)",
    funcs: [
      { name: "f", sig: "Zero a -> Hero a" },
      { name: "dup", sig: "a -> Hero (a, a)" },
      { name: "(>>=)", sig: "Hero a -> (a -> Hero b) -> Hero b" }
    ],
    solution: "let\n  r1 = f z\nin\n  r1 >>= dup"
  },
  {
    level: 13, name: "Lift off",
    init: ["data Zero a b = DontUseMeZero a b", "data Hero a = DontUseMeHero a"],
    target: "Zero a b -> Hero (b, a)",
    lhs: "zeroToHero z =",
    testing: "b = zeroToHero (undefined :: Zero SKOLEMa SKOLEMb)",
    funcs: [
      { name: "f", sig: "Zero a b -> Hero (a, b)" },
      { name: "swap", sig: "(a, b) -> (b, a)" },
      { name: "(<$>)", sig: "(a -> b) -> Hero a -> Hero b" }
    ],
    solution: "let\n  r1 = f z\nin\n  swap <$> r1"
  },
  {
    level: 14, name: "Double bind",
    init: ["data Zero a = DontUseMeZero a", "data Hero a = DontUseMeHero a"],
    target: "Zero a -> Hero (a, (a, a))",
    lhs: "zeroToHero z =",
    testing: "b = zeroToHero (undefined :: Zero SKOLEMa)",
    funcs: [
      { name: "f", sig: "Zero a -> Hero a" },
      { name: "dup", sig: "a -> Hero (a, a)" },
      { name: "nest", sig: "(a, a) -> Hero (a, (a, a))" },
      { name: "(>>=)", sig: "Hero a -> (a -> Hero b) -> Hero b" }
    ],
    solution: "let\n  r1 = f z\n  r2 = r1 >>= dup\nin\n  r2 >>= nest"
  },
  {
    level: 15, name: "Applicative hero",
    init: ["data Zero a b = DontUseMeZero a b", "data Hero a = DontUseMeHero a"],
    target: "Zero a b -> Hero (b, a)",
    lhs: "zeroToHero z =",
    testing: "b = zeroToHero (undefined :: Zero SKOLEMa SKOLEMb)",
    funcs: [
      { name: "f", sig: "Zero a b -> Hero a" },
      { name: "g", sig: "Zero a b -> Hero b" },
      { name: "pair", sig: "a -> b -> (a, b)" },
      { name: "(<$>)", sig: "(a -> b) -> Hero a -> Hero b" },
      { name: "(<*>)", sig: "Hero (a -> b) -> Hero a -> Hero b" }
    ],
    solution: "let\n  r1 = g z\n  r2 = pair <$> r1\n  r3 = f z\nin\n  r2 <*> r3"
  }
];
