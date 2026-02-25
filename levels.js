// ─── Level Data ───
const LEVELS = [
  {
    level: 1, name: "Trial",
    init: ["data Zero a = DontUseMeZero a", "data Hero a = DontUseMeHero a"],
    target: "Zero a -> Hero a",
    lhs: "zeroToHero z =",
    testing: "b = zeroToHero (undefined :: Zero SKOLEMa)",
    funcs: [{ name: "f", sig: "Zero a -> Hero a" }],
    best: "f z"
  },
  {
    level: 2, name: "Assembly required",
    init: ["data Zero a = DontUseMeZero a", "data Hero a = DontUseMeHero a"],
    target: "Zero a -> Hero a",
    lhs: "zeroToHero z =",
    testing: "b = zeroToHero (undefined :: Zero SKOLEMa)",
    funcs: [
      { name: "runZero", sig: "Zero a -> a" },
      { name: "mkHero", sig: "a -> Hero a" },
      { name: "($)", sig: "(a -> b) -> a -> b" }
    ],
    best: "mkHero $ runZero z"
  },
  {
    level: 3, name: "Which path?",
    init: ["data Zero a = DontUseMeZero a", "data Hero a = DontUseMeHero a"],
    target: "Zero a -> Hero (a, a)",
    lhs: "zeroToHero z =",
    testing: "b = zeroToHero (undefined :: Zero SKOLEMa)",
    funcs: [
      { name: "f1", sig: "Zero a -> Hero a" },
      { name: "f2", sig: "Zero a -> (a, a)" },
      { name: "f3", sig: "Hero a -> Hero (a, a)" },
      { name: "($)", sig: "(a -> b) -> a -> b" },
      { name: "(.)", sig: "(b -> c) -> (a -> b) -> a -> c" }
    ],
    best: "f3 $ f1 z"
  },
  {
    level: 4, name: "A repeating pattern",
    init: ["data Zero a b = DontUseMeZero a b", "data Hero a b = DontUseMeHero a b"],
    target: "Zero a b -> Hero b b",
    lhs: "zeroToHero z =",
    testing: "b = zeroToHero (undefined :: Zero SKOLEMa SKOLEMb)",
    funcs: [
      { name: "f1", sig: "Zero a b -> Hero b a" },
      { name: "f2", sig: "Zero a a -> Hero a a" },
      { name: "f3", sig: "Zero a b -> Zero b a" },
      { name: "f4", sig: "Zero a b -> Zero b b" },
      { name: "($)", sig: "(a -> b) -> a -> b" },
      { name: "(.)", sig: "(b -> c) -> (a -> b) -> a -> c" }
    ],
    best: "f2 $ f4 z"
  },
  {
    level: 5, name: "A perfect pair",
    init: ["data Zero a b = DontUseMeZero a b", "data Hero a = DontUseMeHero a"],
    target: "Zero a b -> Hero (a, b)",
    lhs: "zeroToHero z =",
    testing: "b = zeroToHero (undefined :: Zero SKOLEMa SKOLEMb)",
    funcs: [
      { name: "fst", sig: "(a, b) -> a" },
      { name: "snd", sig: "(a, b) -> b" },
      { name: "f1", sig: "Zero a b -> Zero a (a, b)" },
      { name: "f2", sig: "Zero a b -> Hero (b, a)" },
      { name: "f3", sig: "Zero a b -> (Hero a, Hero b)" },
      { name: "($)", sig: "(a -> b) -> a -> b" },
      { name: "(.)", sig: "(b -> c) -> (a -> b) -> a -> c" }
    ],
    best: "snd $ f3 $ f1 z"
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
      { name: "f3", sig: "Zero a b c -> Hero b c" },
      { name: "($)", sig: "(a -> b) -> a -> b" },
      { name: "(.)", sig: "(b -> c) -> (a -> b) -> a -> c" }
    ],
    best: "f3 $ f1 $ f2 z"
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
      { name: "(<$>)", sig: "(a -> b) -> Hero a -> Hero b" },
      { name: "(<*>)", sig: "Hero (a -> c) -> Hero a -> Hero c" },
      { name: "($)", sig: "(a -> b) -> a -> b" },
      { name: "(.)", sig: "(b -> c) -> (a -> b) -> a -> c" }
    ],
    best: "f2 z <*> (f1 z <*> f3 z)"
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
      { name: "f2", sig: "Zero a b c -> Hero a b c" },
      { name: "($)", sig: "(a -> b) -> a -> b" },
      { name: "(.)", sig: "(b -> c) -> (a -> b) -> a -> c" }
    ],
    best: "f2 $ f1 $ f1 $ fmap bd $ f1 z"
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
      { name: "f3", sig: "Zero a b c d -> Zero d c b a" },
      { name: "($)", sig: "(a -> b) -> a -> b" },
      { name: "(.)", sig: "(b -> c) -> (a -> b) -> a -> c" }
    ],
    best: "f2 $ f1 $ f1 $ f3 z"
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
      { name: "f3", sig: "Zero a b c d -> Hero d" },
      { name: "($)", sig: "(a -> b) -> a -> b" },
      { name: "(.)", sig: "(b -> c) -> (a -> b) -> a -> c" }
    ],
    best: "f3 $ f2 $ f2 $ f1 $ f2 $ f1 $ f2 $ f1 z"
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
      { name: "join", sig: "Hero (Hero a) -> Hero a" },
      { name: "($)", sig: "(a -> b) -> a -> b" }
    ],
    best: "join $ wrap z"
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
      { name: "(>>=)", sig: "Hero a -> (a -> Hero b) -> Hero b" },
      { name: "($)", sig: "(a -> b) -> a -> b" }
    ],
    best: "f z >>= dup"
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
      { name: "(<$>)", sig: "(a -> b) -> Hero a -> Hero b" },
      { name: "($)", sig: "(a -> b) -> a -> b" }
    ],
    best: "swap <$> f z"
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
      { name: "(>>=)", sig: "Hero a -> (a -> Hero b) -> Hero b" },
      { name: "($)", sig: "(a -> b) -> a -> b" }
    ],
    best: "f z >>= dup >>= nest"
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
      { name: "(<*>)", sig: "Hero (a -> b) -> Hero a -> Hero b" },
      { name: "(>>=)", sig: "Hero a -> (a -> Hero b) -> Hero b" },
      { name: "($)", sig: "(a -> b) -> a -> b" }
    ],
    best: "pair <$> g z <*> f z"
  }
];
