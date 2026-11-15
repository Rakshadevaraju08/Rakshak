# Search & Routing Module Audit & Algorithm Engine Specification

**Date**: November 15, 2026  
**Status**: Step 3 Complete (Engine, Visualisation, Comparison Table, Polish & End-to-End Verification)  
**Scope**: Search & Routing Lab (`src/algorithms/gridSearch.ts`, `src/pages/SearchRoutingPage.tsx`), Route Integration (`/routing` in `src/App.tsx`), and Shared Boundaries  

---

## 1. Executive Summary

The **Search & Routing** interface is an educational algorithm laboratory within the Rakshak platform. It allows operators and students to interactively configure a 2D discrete grid, set arbitrary start and goal positions, place or remove obstacles, and observe the step-by-step exploration and path reconstruction of four canonical graph search algorithms:
1. **Breadth-First Search (BFS)** (Uninformed)
2. **Depth-First Search (DFS)** (Uninformed)
3. **Greedy Best-First Search** (Heuristic)
4. **A* Search** (Heuristic / Optimal)

### Key Distinction from Operational Road Routing
- **Search & Routing (`/routing`)**: Strictly a **simulation / algorithm laboratory** operating on a discrete mathematical grid. It does not access live GIS map tiles, GPS coordinates, road network graphs, traffic data, emergency vehicles, or incident records.
- **Route Agent (`ai-service/app/agents/route_agent.py`)** & **Dispatch Planning (`/dispatch`)**: Operational backend microservices that calculate actual road routes for response vehicles (ambulances, rescue teams) using real geographic coordinates (lat/lng) and routing engines (e.g. OSRM / Haversine fallback).
- **Strict Constraint**: The Search & Routing laboratory must remain isolated from live vehicle dispatch and road routing.

---

## 2. File Map & Topology

| File Path | Role | Status | Shared / Protected |
|---|---|---|---|
| [`src/algorithms/gridSearch.ts`](file:///c:/Users/Raksha/Rakshak/src/algorithms/gridSearch.ts) | Core algorithm implementations, data structures (min-heap), pure validation, and algorithm metadata | Modified (Step 1) | Shared only with `SearchRoutingPage` and test suite |
| [`src/algorithms/gridSearch.test.ts`](file:///c:/Users/Raksha/Rakshak/src/algorithms/gridSearch.test.ts) | Node test suite verifying algorithms, heuristics, determinism, and validation | Modified (Step 1) | Engine test file |
| [`src/pages/SearchRoutingPage.tsx`](file:///c:/Users/Raksha/Rakshak/src/pages/SearchRoutingPage.tsx) | Interactive grid UI, playback controls, step ticker, and algorithm comparison table | Audited (Do not redesign UI in Step 1) | Page component |
| [`src/App.tsx`](file:///c:/Users/Raksha/Rakshak/src/App.tsx#L71-L76) | Navigation entry `{ path: '/routing', title: 'Search & Routing' }` and `<Route path="/routing" element={<SearchRoutingPage />} />` | Audited | Navigation & routing hub (**Do NOT break**) |
| [`src/index.css`](file:///c:/Users/Raksha/Rakshak/src/index.css) | Styles for `.search-workspace`, `.search-grid`, `.search-cell`, `.search-map-toolbar`, `.search-comparison-table` | Audited | Global application stylesheet |
| `docs/search-routing-audit.md` | Audit findings, algorithm guarantees, bug log, and verification trace | Created | Documentation |

---

## 3. Algorithm Signatures & Execution Model

### How Algorithms Run
- **Execution**: All algorithms execute synchronously in full when invoked, returning an immutable `GridSearchResult` containing the complete path, summary metrics, and a deterministic list of `SearchStep` entries (`'visit'` and `'backtrack'`).
- **Animation & Playback**: The UI uses the recorded `steps` array to render animation frames incrementally (`playback: 'running' | 'paused' | 'complete'`), displaying current depth, $g(n)$, $h(n)$, and $f(n)$ values at each tick.
- **State Mutation**: Algorithms **never mutate** the input grid, the obstacle set, or external parameters.
- **Movement Model**: Strictly **orthogonal 4-directional movement** (Up, Right, Down, Left). Diagonal movement is not enabled.
- **Edge Costs**: Unweighted grid. Every move between adjacent cells has a uniform cost of $1$.

### Unified Return Interface
Every algorithm conforms to the unified interface:
```typescript
export type GridSearchResult = {
  algorithm: SearchAlgorithm;
  found: boolean;
  path: GridCell[];
  pathLength: number;
  visitedOrder: GridCell[];
  visitedCount: number;
  nodesVisited: number; // Backwards-compatible alias
  steps: SearchStep[];
};
```

### Exported Signatures
```typescript
// Individual algorithms
export function breadthFirstSearch(
  rows: number,
  columns: number,
  start: GridCell,
  destination: GridCell,
  obstacles?: ReadonlySet<string>,
): GridSearchResult;

export function depthFirstSearch(
  rows: number,
  columns: number,
  start: GridCell,
  destination: GridCell,
  obstacles?: ReadonlySet<string>,
): GridSearchResult;

export function greedyBestFirstSearch(
  rows: number,
  columns: number,
  start: GridCell,
  destination: GridCell,
  obstacles?: ReadonlySet<string>,
): GridSearchResult;

export function aStarSearch(
  rows: number,
  columns: number,
  start: GridCell,
  destination: GridCell,
  obstacles?: ReadonlySet<string>,
): GridSearchResult;

// Unified runner
export function runGridSearch(
  algorithm: SearchAlgorithm,
  rows: number,
  columns: number,
  start: GridCell,
  destination: GridCell,
  obstacles?: ReadonlySet<string>,
): GridSearchResult;
```

---

## 4. Detailed Algorithm Analysis & Theoretical Guarantees

### 1. Breadth-First Search (BFS)
- **Data Structure**: Standard FIFO Queue (`queue: GridCell[]` with pointer index).
- **Frontier Ordering**: First-In, First-Out. Neighbors are discovered in order: Up, Right, Down, Left.
- **Optimality**: **YES**. On an unweighted graph where every transition has equal unit cost ($c = 1$), BFS guarantees the shortest path (minimum number of steps).
- **Time Complexity**: $O(V + E)$ where $V = \text{rows} \times \text{columns}$ and $E \le 4V$.
- **Space Complexity**: $O(V)$ to store discovered set, queue, and parent pointers.

### 2. Depth-First Search (DFS)
- **Data Structure**: Explicit LIFO Frame Stack (`stack: DfsFrame[]`) with backtrack recording.
- **Frontier Ordering**: Last-In, First-Out. Follows each branch to exhaustion before backtracking.
- **Optimality**: **NO**. DFS does not consider path length and can return highly convoluted, suboptimal paths even when a direct path is available.
- **Time Complexity**: $O(V + E)$.
- **Space Complexity**: $O(V)$ in the worst case (e.g. spiral/snake path filling the entire grid).

### 3. Greedy Best-First Search
- **Data Structure**: Binary Min-Priority Queue ordered by heuristic distance $h(n)$ to the goal.
- **Heuristic**: Manhattan distance $h(n) = |row_n - row_{goal}| + |col_n - col_{goal}|$.
- **Frontier Ordering**: Expands the node that appears closest to the goal based on $h(n)$ alone.
- **Optimality**: **NO**. Because Greedy ignores the accumulated path cost $g(n)$, it can be easily diverted by obstacles into long detours and dead ends.
- **Time Complexity**: $O((V + E) \log V)$ due to heap operations.
- **Space Complexity**: $O(V)$.

### 4. A* Search
- **Data Structure**: Binary Min-Priority Queue ordered by evaluation function $f(n) = g(n) + h(n)$.
- **Heuristic**: Manhattan distance $h(n) = |row_n - row_{goal}| + |col_n - col_{goal}|$.
- **Admissibility**: **YES**. On a 4-connected grid with unit move cost $1$, Manhattan distance never overestimates the actual remaining distance ($h(n) \le h^*(n)$).
- **Consistency (Monotonicity)**: **YES**. For any adjacent cell $n'$, $|h(n) - h(n')| \le 1 = c(n, n')$. Hence, $f(n)$ is non-decreasing along any path, and the first time any node is dequeued from the priority queue, its optimal $g$-cost is guaranteed. Closed nodes never need to be reopened.
- **Optimality**: **YES**. A* with an admissible, consistent heuristic guarantees finding the shortest path on this grid.
- **Time Complexity**: $O((V + E) \log V)$.
- **Space Complexity**: $O(V)$.

---

## 5. Audit Findings: Bugs, Misconceptions & Gaps

### 1. Misconceptions & Labelling Audit
- **Algorithm Descriptions**: Audited and confirmed accurate. DFS and Greedy are explicitly labeled as **non-optimal** (`optimal: false`) in both the engine metadata and the UI table. BFS and A* are correctly marked as **optimal** (`optimal: true`).
- **Heuristic Admissibility**: Audited and confirmed. Manhattan distance on a 4-direction unit-cost grid is mathematically admissible and consistent.
- **Path Reconstruction**: Audited and confirmed. Paths are properly reconstructed using reverse parent pointer traversal for BFS, Greedy, and A*, and using the active frame stack for DFS. All paths connect start to destination contiguously with step distance $1$.

### 2. Bugs & Deficiencies Identified in Step 1
1. **Missing `visitedOrder` and `visitedCount` in Interface**:
   - *Issue*: `GridSearchResult` only exposed `steps: SearchStep[]` and `nodesVisited: number`. External consumers and test suites requiring a simple ordered list of visited cells had to filter and map `steps` manually.
   - *Fix*: Added `visitedOrder: GridCell[]` and `visitedCount: number` to `GridSearchResult`, while retaining `nodesVisited` as an alias for backwards compatibility with `SearchRoutingPage.tsx`.
2. **Missing Pure Validation Function**:
   - *Issue*: Grid configuration validation was partially implemented as inline click guards inside `SearchRoutingPage.tsx` and a dimension range check throwing `RangeError`. There was no pure validation function returning structured error messages.
   - *Fix*: Created and exported `validateGridConfig(rows, columns, start, destination, obstacles): GridValidationResult` covering missing endpoints, out-of-bounds coordinates, start-equals-goal, obstacle collisions, and invalid dimensions.
3. **Unsafe `obstacles` Parameter**:
   - *Issue*: If a caller passed `undefined` or `null` for `obstacles`, `obstacles.has()` would throw a `TypeError`.
   - *Fix*: Defaulted `obstacles: ReadonlySet<string> = new Set()` in all algorithm signatures and added safe null-checks in `hasInvalidEndpoint` and `validateGridConfig`.
4. **Missing Exported Algorithm Metadata Map**:
   - *Issue*: Algorithm descriptions, optimality guarantees, complexities, and data structures were hardcoded inside UI JSX cards and local objects in `SearchRoutingPage.tsx`.
   - *Fix*: Consolidated and exported typed `ALGORITHM_METADATA: Record<SearchAlgorithm, AlgorithmMetadata>` from `src/algorithms/gridSearch.ts`.
5. **No Unified Algorithm Runner**:
   - *Issue*: Running an algorithm dynamically required callers to maintain their own lookup table.
   - *Fix*: Added `runGridSearch(algorithm, rows, columns, start, destination, obstacles)` with full exhaustive type checking.

---

## 6. Engine Enhancements Implemented (Step 1)

1. **`validateGridConfig` Pure Validation Function**:
   - Pure function returning `{ valid: boolean, error?: string, errors: string[] }`.
   - Detects:
     - `rows` or `columns` not integer or $< 1$.
     - Missing or malformed `start` or `goal`.
     - `start` or `goal` outside $[0, \text{rows}-1] \times [0, \text{columns}-1]$.
     - `start` and `goal` on the identical cell.
     - `start` or `goal` placed on an obstacle.
2. **Deterministic Tie-Breaking & Exploration Order**:
   - `DIRECTIONS` constant exported: `[Up, Right, Down, Left]`.
   - BFS explores neighbors in Up, Right, Down, Left order.
   - DFS explores neighbors in Up, Right, Down, Left order.
   - Greedy breaks equal $h(n)$ ties using insertion order (Up, Right, Down, Left).
   - A* breaks equal $f(n)$ ties by lower $h(n)$ (closer to goal), then insertion order (Up, Right, Down, Left).
3. **Unreachable Goals Guarantee**:
   - When a goal is blocked or isolated, algorithms exhaust all reachable nodes in the connected component and return `found: false`, `path: []`, `pathLength: 0`, and the complete `visitedOrder` and `steps`. Never throws or loops infinitely.
4. **Algorithm Metadata Map**:
   - Fully typed `AlgorithmMetadata` with `id`, `name`, `fullName`, `shortExplanation`, `description`, `optimal`, `optimalityGuarantee`, `usesHeuristic`, `heuristicName`, `dataStructure`, `completeness`, `timeComplexity`, and `spaceComplexity`.

---

## 7. Verification & Acceptance Trace

| Test Category | Suite / Check | Result |
|---|---|---|
| **Validation: Grid Dimensions** | `validateGridConfig` catches 0, negative, and float dimensions | **PASSED** |
| **Validation: Missing Endpoints** | `validateGridConfig` catches null and undefined start/goal | **PASSED** |
| **Validation: Out of Bounds** | `validateGridConfig` catches negative and >= rows/columns coordinates | **PASSED** |
| **Validation: Start Equals Goal** | `validateGridConfig` rejects `start === goal` with clear message | **PASSED** |
| **Validation: Obstacle Collisions** | `validateGridConfig` rejects start or goal on obstacles | **PASSED** |
| **Open Grid Traversal** | All 4 algorithms find paths on open grid with contiguous unit steps | **PASSED** |
| **BFS & A* Equivalence** | BFS and A* yield identical optimal path length on unweighted grids | **PASSED** |
| **Obstacle Navigation** | All 4 algorithms navigate around walls without intersecting obstacles | **PASSED** |
| **Greedy Suboptimality** | Greedy finds valid path but takes suboptimal detour ($14 > 10$) | **PASSED** |
| **Unreachable Goals** | Blocked goals return `found: false`, `path: []`, and full explored set | **PASSED** |
| **Obstacle Immunity** | Passing obstacles to algorithms does not mutate the set | **PASSED** |
| **Determinism & Replay** | Identical layouts produce identical `GridSearchResult` and steps | **PASSED** |
| **Metadata Map Completeness** | `ALGORITHM_METADATA` accurately documents all 4 algorithms | **PASSED** |
| **Grid Utilities** | `manhattanDistance`, `cellKey`, `sameCell`, `isInsideGrid` unit tests | **PASSED** |
| **TypeScript Typecheck** | `npm run lint` (`tsc --noEmit`) | **PASSED (0 errors)** |
| **Production Build** | `npm run build` (`vite build`) | **PASSED (dist generated)** |

**Unit Test Execution Summary**:
- **Total Tests**: 23 tests across 8 suites
- **Passed**: 23
- **Failed**: 0
- **Duration**: ~34 ms

---

## 8. Protected Modules & Boundaries (What Must NOT Be Touched)

1. **Planning & Dispatch (`src/App.tsx` -> `/dispatch`)**: Must not be modified or coupled with grid simulation.
2. **Backend API Endpoints (`backend/src/routes/api.js`)**: Real database models and routes (`/incidents`, `/roads`, `/resources`, `/hospitals`, `/dispatch`) must remain unchanged.
3. **AI Route Agent (`ai-service/app/agents/route_agent.py`)**: Real-world GPS vehicle routing must remain independent of this grid lab.
4. **Active UI Layout in Step 1**: The UI redesign is reserved for Steps 2 and 3; existing UI behavior and controls in `SearchRoutingPage.tsx` must remain functional without regression.

---

## 9. Interactive Visualisation & Controls Implementation (Step 2)

1. **Accessible Grid & Non-Colour Cues**:
   - High-contrast visual distinctions for all cell states:
     - Empty: Clean white background with hover cue.
     - Obstacle: Dark slate background with a repeating 45° diagonal crosshatch pattern for clear non-colour texture discrimination.
     - Start: Bold sky-blue background (`#e0f2fe`) with thick primary border and `S` badge.
     - Destination: High-contrast rose background (`#ffe4e6`) with thick red border and `D` badge.
     - Visited: Pale blue background with visit sequence order number.
     - Backtracked (DFS): Dashed amber border (`#f59e0b`) and light yellow background.
     - Final Path: Solid deep teal background (`#1e708c`), thick border, higher z-index, and white path step index, rendered on top of explored cells.
     - Active / Frontier: Cyan glow with prominent focus ring.
   - Accessible legend featuring both shapes/patterns and textual symbols.
   - Comprehensive `aria-label` and `title` on every cell describing its exact row, column, and exploration state.

2. **Pointer & Touch Drag Support**:
   - `onPointerDown`, `onPointerEnter`, and global window `pointerup` handlers support fluid click-and-drag drawing and erasing across mouse, stylus, and touchscreens.
   - Direct drag-to-move support for Start and Destination cells.
   - `touch-action: none` applied to the grid container to prevent accidental page scroll while drawing walls on mobile devices.
   - Inline guard notices: Blocks placing walls over Start/Goal or moving Start/Goal onto walls with user-friendly notices instead of silent failure.

3. **Configurable Grid Sizes & Utility Tools**:
   - Safe dimension presets: `10 × 10 (Compact)`, `12 × 12 (Default)`, `16 × 16 (Expanded)`, and `20 × 20 (Dense)`.
   - Automatic coordinate clamping when resizing.
   - "Clear walls" action to quickly reset terrain.
   - "Reset grid" action to restore default endpoints and clear obstacles.
   - "Random walls" generator with a 25% density that strictly guarantees Start and Destination remain unblocked.

4. **Robust Animation & Playback Engine**:
   - Animation states: `idle`, `running`, `paused`, `complete`.
   - Dedicated timer ref (`timerRef.current`) with guaranteed cleanup on unmount, pause, reset, or grid edit—eliminating memory leaks and double timers.
   - Controls: Run (disabled when running or on invalid configuration), Pause (running only), Resume (paused only), Replay (completed only), and Reset (clears exploration, keeps walls and endpoints).
   - Speed slider: 1x to 10x with live adjustment during playback.
   - Performance optimization: `GridCellButton` is memoized via `React.memo` so that only active/updated cells re-render on each tick, maintaining 60fps on 20×20 grids.

5. **Info Panel & Real-Time Metrics**:
   - Algorithm metadata banner from `ALGORITHM_METADATA`: full name, short explanation, data structure, heuristic, and shortest path guarantee badge (`is-optimal` vs `is-not-optimal`).
   - Live execution metrics: dynamically updates visited count, path length, and execution time during the run.
   - Live step ticker displaying the active node's coordinates, depth, $g(n)$, $h(n)$, and $f(n)$ scores.
   - Unreachable goal banner: Clearly notifies the user when a destination is enclosed by obstacles while preserving the explored connected component on the grid.


---

## 10. Final State, Verification Trace & Known Limitations (Step 3)

### 10.1 Step 3 Implemented Capabilities

1. **Side-by-Side Algorithm Comparison Table**:
   - **Real Engine Runs**: Evaluates BFS, DFS, Greedy Best-First, and A* on the current grid synchronously using `runGridSearch`. No hardcoded data.
   - **Metrics Tracked**: Nodes visited, path length in moves (and cells), path found status, pure execution time (ms), optimality guarantee, time complexity, space complexity, and action replay.
   - **Best Value Highlighting**: Automatically identifies the best values per column among completed runs using `.comparison-best` styling and colored badge pills (`.best-pill`):
     - **Fewest Nodes Visited**: Highlights the algorithm with minimum node expansions.
     - **Shortest Path Length**: Highlights the optimal path among runs where a path was found.
     - **Fastest Execution Time**: Highlights the quickest compute duration.
   - **Interactive Replay / Animate**: Each row in the table provides an **Animate** button allowing operators to instantly select and visualize any algorithm's exploration on the grid.
   - **Stale Detection**: Any modification to obstacles, endpoints, or dimensions immediately sets `isComparisonStale: true` and displays a warning badge (`.search-stale-badge`), prompting the user with a **Re-run comparison** button.

2. **Dynamic One-Line Comparative Takeaway**:
   - Synthesizes live results into an intelligent takeaway banner (`.comparison-takeaway-card`):
     - Compares BFS and A* path optimality and highlights node expansion reduction via Manhattan distance heuristic.
     - Detects when Greedy Best-First finds a suboptimal route due to ignoring path cost $g(n)$, reporting the exact detour overhead (+X moves).
     - Explains DFS wandering down deep unguided branches when applicable.
     - Accurately reports unreachable goal scenarios when all algorithms exhaust the connected component without finding a path.

3. **Accuracy, Terminology & Accessibility Polish**:
   - **Consistent Path Length Terminology**: Explicitly states `"X moves (Y cells)"` across all metric displays, tooltips, step descriptions, and table notes, eliminating ambiguity between vertex count and edge transitions.
   - **Quick Start Usage Hint**: Adds a persistent instructional banner (`.search-usage-hint`) guiding users on drawing walls, adjusting endpoints, and starting traversals.
   - **Screen Reader Announcements**: Integrated `aria-live="polite"` element announcing simulation completion, path found / unreachable status, and comparison table updates.
   - **Instant Execution / Reduced-Motion Preference**:
     - Automatically detects `prefers-reduced-motion: reduce`.
     - Provides an interactive user toggle (`.search-instant-toggle`) to skip timer-based animation and render the full traversal and path immediately.
   - **Mobile Touch Handling**: Applied `touch-action: none` and `user-select: none` specifically to the grid frame, preventing viewport scroll hijack during wall-drawing on touchscreens.

4. **Edge Cases & Extreme Configurations**:
   - Added `6 × 6 (Mini)` preset to `GRID_SIZE_PRESETS` alongside 10x10, 12x12, 16x16, and 20x20.
   - Fully verified edge cases in unit tests and UI:
     - 1x1 grid: validation catches `start === goal`.
     - 2x2 grid: finds shortest 2-move path.
     - Adjacent start and goal: optimal algorithms and Greedy resolve in 1 move (`pathLength: 1`).
     - Fully walled-in start: returns `found: false`, `visitedCount: 1`, leaving clear feedback.
     - Fully walled-in destination: explores all reachable cells in the connected component and displays a non-blocking alert banner.
     - 20x20 maximum grid (400 cells): memoized cell rendering maintains 60 FPS performance without UI stutter.

---

### 10.2 Final Verification Matrix

| Verification Check | Target / Command | Result | Details |
|---|---|---|---|
| **Unit Test Suite** | `npx tsx --test src/algorithms/gridSearch.test.ts` | **PASSED (29/29)** | 9 test suites passing (Engine, validation, traversal, obstacles, unreachable, determinism, metadata, edge cases, utilities). |
| **TypeScript Typecheck** | `npm run lint` (`tsc --noEmit`) | **PASSED (0 errors)** | Clean compile without any type errors, `any` casts, or broken imports. |
| **Production Build** | `npm run build` (`vite build`) | **PASSED (0 warnings)** | 1,694 modules transformed; assets cleanly generated into `dist/`. |
| **Boundary Verification** | `git diff --stat` | **PASSED** | Only 4 files modified in `src/` plus `docs/search-routing-audit.md`. Zero backend, DB, or dispatch changes. |

---

### 10.3 Boundary Confirmation

A complete repository audit via `git status` and `git diff` confirms:
1. **Planning & Dispatch (`/dispatch`)**: Completely untouched.
2. **Backend API (`backend/`)**: Completely untouched.
3. **Database Schema (`prisma/schema.prisma`)**: Completely untouched.
4. **AI Route Agent (`ai-service/app/agents/route_agent.py`)**: Completely untouched.
5. **Shared App Shell & Navigation (`src/App.tsx`)**: The `/routing` route points cleanly to `SearchRoutingPage` with zero regressions or breaking changes to navigation.
6. **No Real-World Map / GIS Leakage**: The module operates solely as a discrete 2D grid laboratory and introduces no GPS coordinates, OpenStreetMap/Google Maps tiles, or emergency dispatch routing logic.

---

### 10.4 Known Limitations & Future Enhancements

1. **Movement Model**: Currently restricted to 4-directional orthogonal movement (Up, Right, Down, Left).
   - *Future Enhancement*: Optional 8-directional diagonal movement with $\sqrt{2} \approx 1.414$ edge costs and Chebyshev/Octile distance heuristics.
2. **Terrain Cost**: Current grid is unweighted (uniform edge cost of 1.0).
   - *Future Enhancement*: Variable terrain weights (e.g., mud = 3.0, flood = 5.0, clear road = 1.0) to demonstrate Dijkstra's algorithm and weighted A*.
3. **Bidirectional Search**: Currently all searches expand forward from Start to Goal.
   - *Future Enhancement*: Bidirectional BFS / Bidirectional A* to demonstrate meeting in the middle for large graphs.
