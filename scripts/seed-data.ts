/**
 * Fictional demo data. Every person, college and company here is invented; domains use the
 * reserved `.example` TLD and GitHub usernames use the `proofdemo-` prefix so nothing points at
 * a real person or organisation.
 */
import type { CheckTest } from "../src/db/schema";

export const DEMO_PASSWORD = "proof-demo-2026";

export const COLLEGES = [
  { key: "spit", name: "Sardar Patel Institute of Technology, Surat", shortName: "SPIT Surat", city: "Surat", state: "Gujarat", domain: "spit-surat.example" },
  { key: "wgit", name: "Western Ghats Institute of Technology, Pune", shortName: "WGIT Pune", city: "Pune", state: "Maharashtra", domain: "wgit-pune.example" },
  { key: "dvce", name: "Deccan Valley College of Engineering, Hyderabad", shortName: "DVCE", city: "Hyderabad", state: "Telangana", domain: "dvce.example" },
  { key: "nvie", name: "Narmada Valley Institute of Engineering, Vadodara", shortName: "NVIE", city: "Vadodara", state: "Gujarat", domain: "nvie.example" },
] as const;
export type CollegeKey = (typeof COLLEGES)[number]["key"];

export const COMPANIES = [
  { key: "kitecode", name: "Kitecode Labs", domain: "kitecode.example", industry: "Developer tools", size: "51-200", city: "Bengaluru", about: "Builds collaborative code-review tooling for engineering teams." },
  { key: "monsoonpay", name: "Monsoonpay", domain: "monsoonpay.example", industry: "Fintech", size: "201-500", city: "Mumbai", about: "UPI-first payments infrastructure for small merchants." },
  { key: "tiffinbox", name: "Tiffinbox Logistics", domain: "tiffinbox.example", industry: "Logistics", size: "51-200", city: "Pune", about: "Hyperlocal delivery routing for home kitchens." },
  { key: "banyan", name: "Banyan Health Systems", domain: "banyanhealth.example", industry: "Healthtech", size: "501-1000", city: "Hyderabad", about: "Clinic management software for tier-2 cities." },
  { key: "sabarmati", name: "Sabarmati Robotics", domain: "sabarmati-robotics.example", industry: "Robotics", size: "11-50", city: "Ahmedabad", about: "Warehouse automation and computer vision." },
  { key: "paperkite", name: "Paperkite Studio", domain: "paperkite.example", industry: "Product studio", size: "11-50", city: "Remote", about: "Designs and ships web products for early-stage startups." },
] as const;
export type CompanyKey = (typeof COMPANIES)[number]["key"];

export const SKILLS = [
  ["javascript", "JavaScript", "language"],
  ["typescript", "TypeScript", "language"],
  ["python", "Python", "language"],
  ["java", "Java", "language"],
  ["go", "Go", "language"],
  ["sql", "SQL", "data"],
  ["react", "React", "framework"],
  ["nextjs", "Next.js", "framework"],
  ["nodejs", "Node.js", "framework"],
  ["express", "Express", "framework"],
  ["django", "Django", "framework"],
  ["fastapi", "FastAPI", "framework"],
  ["spring", "Spring Boot", "framework"],
  ["tailwind", "Tailwind CSS", "framework"],
  ["postgresql", "PostgreSQL", "data"],
  ["mongodb", "MongoDB", "data"],
  ["pandas", "pandas", "data"],
  ["machine-learning", "Machine learning", "concept"],
  ["data-structures", "Data structures & algorithms", "concept"],
  ["docker", "Docker", "tooling"],
  ["aws", "AWS", "tooling"],
  ["git", "Git", "tooling"],
] as const;

/** Archetypes keep each fictional student's evidence coherent (a Django dev has Python repos). */
export const ARCHETYPES = [
  { headline: "Frontend developer who ships accessible React apps", roles: ["Frontend engineer"], skills: ["javascript", "typescript", "react", "nextjs", "tailwind", "git"], langs: ["TypeScript", "CSS"] },
  { headline: "Full-stack builder: Node, Postgres and React", roles: ["Full-stack engineer", "Backend engineer"], skills: ["javascript", "nodejs", "express", "postgresql", "react", "docker"], langs: ["JavaScript", "TypeScript"] },
  { headline: "Backend engineer in Python and FastAPI", roles: ["Backend engineer"], skills: ["python", "fastapi", "postgresql", "docker", "sql", "git"], langs: ["Python"] },
  { headline: "Django developer who likes clean data models", roles: ["Backend engineer", "Full-stack engineer"], skills: ["python", "django", "sql", "postgresql", "git"], langs: ["Python", "HTML"] },
  { headline: "Data analyst turning messy CSVs into decisions", roles: ["Data analyst", "ML engineer"], skills: ["python", "pandas", "sql", "machine-learning"], langs: ["Jupyter Notebook", "Python"] },
  { headline: "Java and Spring Boot services, tested properly", roles: ["Backend engineer", "SDE"], skills: ["java", "spring", "sql", "data-structures", "docker"], langs: ["Java"] },
  { headline: "Competitive programmer moving into systems", roles: ["SDE", "Backend engineer"], skills: ["data-structures", "go", "java", "git"], langs: ["Go", "C++"] },
  { headline: "Cloud-curious full-stack developer", roles: ["Full-stack engineer", "DevOps engineer"], skills: ["typescript", "nextjs", "nodejs", "aws", "docker", "mongodb"], langs: ["TypeScript", "Shell"] },
] as const;

export const FIRST_NAMES = [
  "Aarav", "Ishita", "Vihaan", "Ananya", "Kabir", "Diya", "Reyansh", "Saanvi", "Arjun", "Myra",
  "Advait", "Kiara", "Dhruv", "Aadhya", "Ayaan", "Navya", "Rohan", "Tanvi", "Siddharth", "Meher",
  "Yash", "Riya", "Neel", "Pooja", "Kunal", "Sneha", "Harsh", "Zoya", "Parth", "Aditi",
  "Om", "Nandini", "Varun", "Isha", "Karan", "Prisha", "Dev", "Anika", "Manav", "Gauri",
];
export const LAST_NAMES = [
  "Shah", "Varma", "Patel", "Iyer", "Reddy", "Nair", "Kulkarni", "Desai", "Bhatt", "Menon",
  "Joshi", "Chauhan", "Rao", "Pillai", "Trivedi", "Mehta", "Sinha", "Ghosh", "Kapadia", "Bose",
];
export const BRANCHES = ["Computer Engineering", "Information Technology", "Electronics & Communication", "AI & Data Science"];
export const REPO_NAMES = [
  "tiffin-tracker", "campus-events", "expense-split", "attendance-bot", "hostel-mess-menu", "library-queue",
  "pothole-map", "bus-pass-wallet", "placement-prep", "notes-sync", "quiz-arena", "farm-price-watch",
  "clinic-slots", "rideshare-pool", "budget-buddy", "resume-parser", "weather-kisan", "chai-orders",
];

type Check = {
  slug: string;
  title: string;
  skill: string;
  level: "beginner" | "intermediate" | "advanced";
  prompt: string;
  entry: string;
  starter: string;
  sample: CheckTest[];
  hidden: CheckTest[];
  minutes: number;
};

const t = (name: string, args: unknown[], expected: unknown): CheckTest => ({ name, args, expected });

/** Twelve JavaScript skill checks, graded server-side against hidden tests. */
export const SKILL_CHECKS: Check[] = [
  {
    slug: "chunk-array", title: "Chunk an array", skill: "javascript", level: "beginner", minutes: 15, entry: "chunk",
    prompt: "Write `chunk(items, size)` that splits `items` into arrays of length `size`. The last chunk may be shorter. Return `[]` for an empty input.",
    starter: "function chunk(items, size) {\n  // your code\n}\n",
    sample: [t("pairs", [[1, 2, 3, 4, 5], 2], [[1, 2], [3, 4], [5]])],
    hidden: [t("empty", [[], 3], []), t("exact", [[1, 2, 3], 3], [[1, 2, 3]]), t("size one", [["a", "b"], 1], [["a"], ["b"]])],
  },
  {
    slug: "is-anagram", title: "Anagram check", skill: "javascript", level: "beginner", minutes: 15, entry: "isAnagram",
    prompt: "Write `isAnagram(a, b)` returning true when the strings are anagrams, ignoring case and spaces.",
    starter: "function isAnagram(a, b) {\n  // your code\n}\n",
    sample: [t("listen", ["Listen", "Silent"], true)],
    hidden: [t("spaces", ["Dormitory", "dirty room"], true), t("no", ["abc", "abd"], false), t("lengths", ["ab", "abb"], false)],
  },
  {
    slug: "title-case", title: "Title case", skill: "javascript", level: "beginner", minutes: 15, entry: "titleCase",
    prompt: "Write `titleCase(s)` that capitalises the first letter of each word and lower-cases the rest. Words are separated by single spaces.",
    starter: "function titleCase(s) {\n  // your code\n}\n",
    sample: [t("basic", ["hello wORLD"], "Hello World")],
    hidden: [t("single", ["surat"], "Surat"), t("empty", [""], ""), t("mixed", ["pRoOf iS eViDeNcE"], "Proof Is Evidence")],
  },
  {
    slug: "group-by", title: "Group by key", skill: "javascript", level: "intermediate", minutes: 20, entry: "groupBy",
    prompt: "Write `groupBy(rows, key)` returning an object mapping each distinct `row[key]` to the array of rows with that value, preserving order.",
    starter: "function groupBy(rows, key) {\n  // your code\n}\n",
    sample: [t("city", [[{ c: "Pune", n: 1 }, { c: "Surat", n: 2 }, { c: "Pune", n: 3 }], "c"], { Pune: [{ c: "Pune", n: 1 }, { c: "Pune", n: 3 }], Surat: [{ c: "Surat", n: 2 }] })],
    hidden: [t("empty", [[], "x"], {}), t("numbers", [[{ y: 1 }, { y: 1 }], "y"], { "1": [{ y: 1 }, { y: 1 }] })],
  },
  {
    slug: "flatten-deep", title: "Flatten deeply", skill: "javascript", level: "intermediate", minutes: 20, entry: "flattenDeep",
    prompt: "Write `flattenDeep(arr)` that flattens arbitrarily nested arrays without using `Array.prototype.flat`.",
    starter: "function flattenDeep(arr) {\n  // your code\n}\n",
    sample: [t("nested", [[1, [2, [3, [4]]]]], [1, 2, 3, 4])],
    hidden: [t("flat", [[1, 2]], [1, 2]), t("empties", [[[], [[]], 5]], [5]), t("strings", [["a", ["b"]]], ["a", "b"])],
  },
  {
    slug: "rle", title: "Run-length encoding", skill: "javascript", level: "intermediate", minutes: 20, entry: "encode",
    prompt: "Write `encode(s)` producing run-length encoding: `\"aaabcc\"` becomes `\"3a1b2c\"`.",
    starter: "function encode(s) {\n  // your code\n}\n",
    sample: [t("basic", ["aaabcc"], "3a1b2c")],
    hidden: [t("empty", [""], ""), t("single", ["z"], "1z"), t("long", ["wwwwwwwwwwww"], "12w")],
  },
  {
    slug: "invoice-totals", title: "Invoice totals", skill: "javascript", level: "intermediate", minutes: 25, entry: "invoiceTotals",
    prompt: "Given line items `{ sku, qty, price }` (price in paise), return `{ subtotal, gst, total }` where GST is 18% rounded to the nearest paisa.",
    starter: "function invoiceTotals(items) {\n  // your code\n}\n",
    sample: [t("two", [[{ sku: "a", qty: 2, price: 500 }, { sku: "b", qty: 1, price: 1000 }]], { subtotal: 2000, gst: 360, total: 2360 })],
    hidden: [t("empty", [[]], { subtotal: 0, gst: 0, total: 0 }), t("rounding", [[{ sku: "x", qty: 1, price: 333 }]], { subtotal: 333, gst: 60, total: 393 })],
  },
  {
    slug: "retry-async", title: "Retry with attempts", skill: "javascript", level: "advanced", minutes: 25, entry: "retry",
    prompt: "Write `async retry(fn, attempts)` that calls async `fn` until it resolves, at most `attempts` times, and rethrows the last error. Tests pass a fn that fails N times then returns `\"ok\"`; return the resolved value.",
    starter: "async function retry(fn, attempts) {\n  // your code\n}\n",
    sample: [t("fails twice", [{ __failTimes: 2 }, 3], "ok")],
    hidden: [t("first try", [{ __failTimes: 0 }, 1], "ok"), t("exhausted", [{ __failTimes: 3 }, 3], { __throws: true })],
  },
  {
    slug: "promise-pool", title: "Concurrency-limited map", skill: "javascript", level: "advanced", minutes: 30, entry: "mapLimit",
    prompt: "Write `async mapLimit(items, limit, fn)` that maps with async `fn`, never running more than `limit` at once, and returns results in input order.",
    starter: "async function mapLimit(items, limit, fn) {\n  // your code\n}\n",
    sample: [t("double", [[1, 2, 3], 2, { __double: true }], [2, 4, 6])],
    hidden: [t("empty", [[], 3, { __double: true }], []), t("limit one", [[5, 6], 1, { __double: true }], [10, 12])],
  },
  {
    slug: "debounce-pure", title: "Debounce timeline", skill: "javascript", level: "advanced", minutes: 25, entry: "debounceTimeline",
    prompt: "Pure-function debounce. Given call timestamps (ms, ascending) and `wait`, return the timestamps at which a trailing-edge debounced function would fire.",
    starter: "function debounceTimeline(calls, wait) {\n  // your code\n}\n",
    sample: [t("burst", [[0, 50, 100, 400], 200], [300, 600])],
    hidden: [t("none", [[], 100], []), t("spaced", [[0, 500], 100], [100, 600])],
  },
  {
    slug: "cart-reducer", title: "Cart reducer (React logic)", skill: "react", level: "intermediate", minutes: 25, entry: "cartReducer",
    prompt: "Write a React-style reducer `cartReducer(state, action)`. State is `{ items: { [id]: qty } }`. Actions: `add {id}`, `remove {id}` (decrement, delete at 0), `clear`. Never mutate `state`.",
    starter: "function cartReducer(state, action) {\n  // your code\n}\n",
    sample: [t("add", [{ items: {} }, { type: "add", id: "tee" }], { items: { tee: 1 } })],
    hidden: [t("remove to zero", [{ items: { tee: 1 } }, { type: "remove", id: "tee" }], { items: {} }), t("clear", [{ items: { a: 2 } }, { type: "clear" }], { items: {} })],
  },
  {
    slug: "derive-visible-todos", title: "Derived state: visible todos", skill: "react", level: "beginner", minutes: 15, entry: "visibleTodos",
    prompt: "Write `visibleTodos(todos, filter)` where filter is `all`, `active` or `done`. Return the matching todos, preserving order (as a selector for a React component).",
    starter: "function visibleTodos(todos, filter) {\n  // your code\n}\n",
    sample: [t("active", [[{ id: 1, done: false }, { id: 2, done: true }], "active"], [{ id: 1, done: false }])],
    hidden: [t("all", [[{ id: 1, done: true }], "all"], [{ id: 1, done: true }]), t("done none", [[{ id: 1, done: false }], "done"], [])],
  },
];
