import assert from "node:assert/strict";
import { validateLayerBoundaries } from "./verify-structure.mjs";

const validGraph = new Map([
  ["src/features/todos/derived.ts", new Set(["src/lib/contracts.ts"])],
  ["src/components/NightValleyViews.tsx", new Set(["src/features/todos/TodoDateGroupList.tsx"])],
  ["src/components/GraphiteConsoleViews.tsx", new Set(["src/features/todos/TodoDateGroupList.tsx"])],
]);
validateLayerBoundaries(validGraph, new Map());

const invalidGraph = new Map([
  ["src/features/todos/derived.ts", new Set(["src/components/GraphiteConsoleViews.tsx"])],
]);
assert.throws(
  () => validateLayerBoundaries(invalidGraph, new Map()),
  /must not import concrete theme/,
  "a feature importing a concrete theme must fail the structure check",
);

assert.throws(
  () => validateLayerBoundaries(
    new Map([["src/components/NightValleyViews.tsx", new Set(["src/components/GraphiteConsoleViews.tsx"])]]),
    new Map(),
  ),
  /must not import sibling theme/,
  "a theme importing a sibling theme must fail the structure check",
);

console.log(JSON.stringify({ success: true, cases: ["valid-layer-graph", "feature-theme-violation", "theme-sibling-violation"] }, null, 2));
