export type GridCell = {
  row: number;
  column: number;
};

export type SearchAlgorithm = 'BFS' | 'DFS' | 'GREEDY' | 'A_STAR';

export type SearchStep =
  | { type: 'visit'; cell: GridCell; order: number; depth: number; g?: number; h?: number; f?: number }
  | { type: 'backtrack'; cell: GridCell; depth: number };

export type GridSearchResult = {
  algorithm: SearchAlgorithm;
  found: boolean;
  path: GridCell[];
  pathLength: number;
  visitedOrder: GridCell[];
  visitedCount: number;
  nodesVisited: number; // Backwards-compatible alias for visitedCount
  steps: SearchStep[];
};

export interface GridValidationResult {
  valid: boolean;
  error?: string;
  errors: string[];
}

export interface AlgorithmMetadata {
  id: SearchAlgorithm;
  name: string;
  fullName: string;
  shortExplanation: string;
  description: string;
  optimal: boolean;
  optimalityGuarantee: string;
  usesHeuristic: boolean;
  heuristicName?: string;
  dataStructure: string;
  completeness: string;
  timeComplexity: string;
  spaceComplexity: string;
}

export const ALGORITHM_METADATA: Record<SearchAlgorithm, AlgorithmMetadata> = {
  BFS: {
    id: 'BFS',
    name: 'BFS',
    fullName: 'Breadth-First Search',
    shortExplanation:
      'Explores outward in uniform distance layers using a FIFO queue. Guarantees the shortest path on unweighted grids.',
    description: 'Queue · level by level exploration',
    optimal: true,
    optimalityGuarantee: 'Yes · guarantees shortest path when move costs are equal',
    usesHeuristic: false,
    dataStructure: 'Queue (FIFO)',
    completeness: 'Complete on finite grids',
    timeComplexity: 'O(V + E)',
    spaceComplexity: 'O(V)',
  },
  DFS: {
    id: 'DFS',
    name: 'DFS',
    fullName: 'Depth-First Search',
    shortExplanation:
      'Explores deeply along each branch before backtracking using a LIFO stack. Does not guarantee the shortest path.',
    description: 'Stack · depth and backtrack',
    optimal: false,
    optimalityGuarantee: 'No · does not guarantee shortest path; often finds long, meandering routes',
    usesHeuristic: false,
    dataStructure: 'Stack (LIFO)',
    completeness: 'Complete on finite grids with visited-cell tracking',
    timeComplexity: 'O(V + E)',
    spaceComplexity: 'O(V)',
  },
  GREEDY: {
    id: 'GREEDY',
    name: 'Greedy Best-First',
    fullName: 'Greedy Best-First Search',
    shortExplanation:
      'Expands the node with lowest heuristic distance h(n) to the goal using a priority queue. Fast, but does not guarantee the shortest path.',
    description: 'Priority queue · lowest h(n)',
    optimal: false,
    optimalityGuarantee: 'No · does not guarantee shortest path; ignores path cost and can take suboptimal detours',
    usesHeuristic: true,
    heuristicName: 'Manhattan distance',
    dataStructure: 'Min-Priority Queue (ordered by h(n))',
    completeness: 'Complete on finite grids with visited-cell tracking',
    timeComplexity: 'O((V + E) log V)',
    spaceComplexity: 'O(V)',
  },
  A_STAR: {
    id: 'A_STAR',
    name: 'A*',
    fullName: 'A* Search',
    shortExplanation:
      'Balances travelled cost g(n) with estimated remaining distance h(n) via f(n) = g(n) + h(n). Guarantees the shortest path with an admissible heuristic.',
    description: 'Priority queue · lowest f(n)',
    optimal: true,
    optimalityGuarantee:
      'Yes · guarantees shortest path with an admissible, consistent heuristic (Manhattan distance on 4-connected grid)',
    usesHeuristic: true,
    heuristicName: 'Manhattan distance',
    dataStructure: 'Min-Priority Queue (ordered by f(n) = g(n) + h(n), tie-break by h(n))',
    completeness: 'Complete on finite grids',
    timeComplexity: 'O((V + E) log V)',
    spaceComplexity: 'O(V)',
  },
};

type DfsFrame = {
  cell: GridCell;
  nextNeighbor: number;
};

type HeuristicNode = {
  cell: GridCell;
  g: number;
  h: number;
};

type PriorityEntry<T> = {
  value: T;
  priority: number;
  secondary: number;
  order: number;
};

/**
 * Orthogonal exploration directions fixed in deterministic order:
 * Up, Right, Down, Left.
 */
export const DIRECTIONS = [
  { row: -1, column: 0 }, // Up
  { row: 0, column: 1 },  // Right
  { row: 1, column: 0 },  // Down
  { row: 0, column: -1 }, // Left
] as const;

/**
 * Min-Priority Queue with stable FIFO tie-breaking for equal primary and secondary priorities.
 */
class MinPriorityQueue<T> {
  private readonly heap: PriorityEntry<T>[] = [];
  private nextOrder = 0;

  get size(): number {
    return this.heap.length;
  }

  enqueue(value: T, priority: number, secondary = 0): void {
    this.heap.push({ value, priority, secondary, order: this.nextOrder++ });
    this.bubbleUp(this.heap.length - 1);
  }

  dequeue(): T | null {
    if (this.heap.length === 0) return null;
    const first = this.heap[0];
    const last = this.heap.pop();

    if (this.heap.length > 0 && last) {
      this.heap[0] = last;
      this.bubbleDown(0);
    }

    return first.value;
  }

  private comesBefore(left: PriorityEntry<T>, right: PriorityEntry<T>): boolean {
    if (left.priority !== right.priority) return left.priority < right.priority;
    if (left.secondary !== right.secondary) return left.secondary < right.secondary;
    return left.order < right.order;
  }

  private bubbleUp(startIndex: number): void {
    let index = startIndex;
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (!this.comesBefore(this.heap[index], this.heap[parentIndex])) break;
      [this.heap[index], this.heap[parentIndex]] = [this.heap[parentIndex], this.heap[index]];
      index = parentIndex;
    }
  }

  private bubbleDown(startIndex: number): void {
    let index = startIndex;
    while (true) {
      const leftIndex = index * 2 + 1;
      const rightIndex = leftIndex + 1;
      let firstIndex = index;

      if (leftIndex < this.heap.length && this.comesBefore(this.heap[leftIndex], this.heap[firstIndex])) {
        firstIndex = leftIndex;
      }
      if (rightIndex < this.heap.length && this.comesBefore(this.heap[rightIndex], this.heap[firstIndex])) {
        firstIndex = rightIndex;
      }
      if (firstIndex === index) break;

      [this.heap[index], this.heap[firstIndex]] = [this.heap[firstIndex], this.heap[index]];
      index = firstIndex;
    }
  }
}

export function cellKey(cell: GridCell): string {
  return `${cell.row},${cell.column}`;
}

export function manhattanDistance(left: GridCell, right: GridCell): number {
  return Math.abs(left.row - right.row) + Math.abs(left.column - right.column);
}

export function sameCell(left: GridCell, right: GridCell): boolean {
  return left.row === right.row && left.column === right.column;
}

export function isInsideGrid(cell: GridCell, rows: number, columns: number): boolean {
  return cell.row >= 0 && cell.row < rows && cell.column >= 0 && cell.column < columns;
}

export function validateDimensions(rows: number, columns: number): void {
  if (!Number.isInteger(rows) || rows < 1 || !Number.isInteger(columns) || columns < 1) {
    throw new RangeError('Grid dimensions must be positive integers.');
  }
}

/**
 * Pure validation function for grid configuration.
 * Returns human-readable error messages for:
 * - Empty or invalid grid dimensions
 * - Missing start
 * - Missing goal
 * - Start or goal out of bounds
 * - Start equals goal
 * - Start or goal on an obstacle
 */
export function validateGridConfig(
  rows: number,
  columns: number,
  start?: GridCell | null,
  destination?: GridCell | null,
  obstacles?: ReadonlySet<string> | null,
): GridValidationResult {
  const errors: string[] = [];

  const validDimensions =
    typeof rows === 'number' &&
    typeof columns === 'number' &&
    Number.isInteger(rows) &&
    rows >= 1 &&
    Number.isInteger(columns) &&
    columns >= 1;

  if (!validDimensions) {
    errors.push('Grid dimensions must be positive integers (rows and columns >= 1).');
  }

  const hasStart =
    Boolean(start) &&
    typeof start?.row === 'number' &&
    !Number.isNaN(start.row) &&
    typeof start?.column === 'number' &&
    !Number.isNaN(start.column);

  if (!hasStart) {
    errors.push('Start position is required.');
  } else if (validDimensions && start) {
    if (!isInsideGrid(start, rows, columns)) {
      errors.push('Start position is out of grid bounds.');
    }
  }

  const hasDestination =
    Boolean(destination) &&
    typeof destination?.row === 'number' &&
    !Number.isNaN(destination.row) &&
    typeof destination?.column === 'number' &&
    !Number.isNaN(destination.column);

  if (!hasDestination) {
    errors.push('Goal position is required.');
  } else if (validDimensions && destination) {
    if (!isInsideGrid(destination, rows, columns)) {
      errors.push('Goal position is out of grid bounds.');
    }
  }

  if (hasStart && hasDestination && start && destination) {
    if (sameCell(start, destination)) {
      errors.push('Start and goal positions cannot be the same cell.');
    }
  }

  if (obstacles && typeof obstacles.has === 'function') {
    if (hasStart && start && obstacles.has(cellKey(start))) {
      errors.push('Start position cannot be on an obstacle.');
    }
    if (hasDestination && destination && obstacles.has(cellKey(destination))) {
      errors.push('Goal position cannot be on an obstacle.');
    }
  }

  return {
    valid: errors.length === 0,
    error: errors[0],
    errors,
  };
}

function hasInvalidEndpoint(
  rows: number,
  columns: number,
  start: GridCell,
  destination: GridCell,
  obstacles: ReadonlySet<string>,
): boolean {
  return (
    !isInsideGrid(start, rows, columns) ||
    !isInsideGrid(destination, rows, columns) ||
    Boolean(obstacles?.has(cellKey(start))) ||
    Boolean(obstacles?.has(cellKey(destination)))
  );
}

function reconstructPath(
  start: GridCell,
  destination: GridCell,
  parents: Map<string, GridCell>,
): GridCell[] {
  const reversedPath = [destination];
  let current = destination;

  while (!sameCell(current, start)) {
    const parent = parents.get(cellKey(current));
    if (!parent) return [];
    reversedPath.push(parent);
    current = parent;
  }

  return reversedPath.reverse();
}

function makeResult(
  algorithm: SearchAlgorithm,
  found: boolean,
  path: GridCell[],
  steps: SearchStep[],
): GridSearchResult {
  const visitedOrder = steps
    .filter((step): step is SearchStep & { type: 'visit' } => step.type === 'visit')
    .map(step => step.cell);

  return {
    algorithm,
    found,
    path,
    pathLength: found ? Math.max(path.length - 1, 0) : 0,
    visitedOrder,
    visitedCount: visitedOrder.length,
    nodesVisited: visitedOrder.length,
    steps,
  };
}

/**
 * Breadth-First Search (BFS)
 * Uses a FIFO queue to explore cells layer-by-layer.
 * Guarantees the shortest path on unweighted grids.
 */
export function breadthFirstSearch(
  rows: number,
  columns: number,
  start: GridCell,
  destination: GridCell,
  obstacles: ReadonlySet<string> = new Set(),
): GridSearchResult {
  validateDimensions(rows, columns);
  const steps: SearchStep[] = [];
  if (hasInvalidEndpoint(rows, columns, start, destination, obstacles)) {
    return makeResult('BFS', false, [], steps);
  }

  const startKey = cellKey(start);
  const queue: GridCell[] = [{ ...start }];
  const parents = new Map<string, GridCell>();
  const depths = new Map<string, number>([[startKey, 0]]);
  const discovered = new Set<string>([startKey]);
  let queueHead = 0;
  let found = false;

  while (queueHead < queue.length) {
    const current = queue[queueHead++];
    const currentKey = cellKey(current);
    const depth = depths.get(currentKey) ?? 0;
    steps.push({ type: 'visit', cell: current, order: steps.length + 1, depth });

    if (sameCell(current, destination)) {
      found = true;
      break;
    }

    for (const direction of DIRECTIONS) {
      const neighbor = {
        row: current.row + direction.row,
        column: current.column + direction.column,
      };
      const neighborKey = cellKey(neighbor);
      if (
        !isInsideGrid(neighbor, rows, columns) ||
        obstacles.has(neighborKey) ||
        discovered.has(neighborKey)
      ) {
        continue;
      }

      discovered.add(neighborKey);
      parents.set(neighborKey, current);
      depths.set(neighborKey, depth + 1);
      queue.push(neighbor);
    }
  }

  const path = found ? reconstructPath(start, destination, parents) : [];
  return makeResult('BFS', found, path, steps);
}

/**
 * Depth-First Search (DFS)
 * Uses an explicit LIFO frame stack with backtracking.
 * Does NOT guarantee the shortest path.
 */
export function depthFirstSearch(
  rows: number,
  columns: number,
  start: GridCell,
  destination: GridCell,
  obstacles: ReadonlySet<string> = new Set(),
): GridSearchResult {
  validateDimensions(rows, columns);
  const steps: SearchStep[] = [];
  if (hasInvalidEndpoint(rows, columns, start, destination, obstacles)) {
    return makeResult('DFS', false, [], steps);
  }

  const startKey = cellKey(start);
  const visited = new Set<string>([startKey]);
  const parents = new Map<string, GridCell>();
  const stack: DfsFrame[] = [{ cell: { ...start }, nextNeighbor: 0 }];
  steps.push({ type: 'visit', cell: { ...start }, order: 1, depth: 0 });
  let found = sameCell(start, destination);

  while (stack.length > 0 && !found) {
    const frame = stack[stack.length - 1];
    let advanced = false;

    while (frame.nextNeighbor < DIRECTIONS.length) {
      const direction = DIRECTIONS[frame.nextNeighbor++];
      const neighbor = {
        row: frame.cell.row + direction.row,
        column: frame.cell.column + direction.column,
      };
      const neighborKey = cellKey(neighbor);

      if (
        !isInsideGrid(neighbor, rows, columns) ||
        obstacles.has(neighborKey) ||
        visited.has(neighborKey)
      ) {
        continue;
      }

      visited.add(neighborKey);
      parents.set(neighborKey, frame.cell);
      steps.push({
        type: 'visit',
        cell: neighbor,
        order: visited.size,
        depth: stack.length,
      });
      stack.push({ cell: neighbor, nextNeighbor: 0 });
      advanced = true;
      break;
    }

    if (advanced) {
      found = sameCell(stack[stack.length - 1].cell, destination);
      continue;
    }

    const exhausted = stack.pop();
    if (exhausted && stack.length > 0) {
      steps.push({ type: 'backtrack', cell: exhausted.cell, depth: stack.length });
    }
  }

  const path = found ? stack.map(frame => frame.cell) : [];
  return makeResult('DFS', found, path, steps);
}

/**
 * Greedy Best-First Search
 * Expands nodes prioritized purely by lowest heuristic distance h(n).
 * Fast, but does NOT guarantee the shortest path.
 */
export function greedyBestFirstSearch(
  rows: number,
  columns: number,
  start: GridCell,
  destination: GridCell,
  obstacles: ReadonlySet<string> = new Set(),
): GridSearchResult {
  validateDimensions(rows, columns);
  const steps: SearchStep[] = [];
  if (hasInvalidEndpoint(rows, columns, start, destination, obstacles)) {
    return makeResult('GREEDY', false, [], steps);
  }

  const startKey = cellKey(start);
  const startNode = { cell: { ...start }, g: 0, h: manhattanDistance(start, destination) };
  const frontier = new MinPriorityQueue<HeuristicNode>();
  const discovered = new Set<string>([startKey]);
  const parents = new Map<string, GridCell>();
  frontier.enqueue(startNode, startNode.h);
  let found = false;
  let order = 0;

  while (frontier.size > 0) {
    const current = frontier.dequeue();
    if (!current) break;

    steps.push({
      type: 'visit',
      cell: current.cell,
      order: ++order,
      depth: current.g,
      g: current.g,
      h: current.h,
    });

    if (sameCell(current.cell, destination)) {
      found = true;
      break;
    }

    for (const direction of DIRECTIONS) {
      const neighbor = {
        row: current.cell.row + direction.row,
        column: current.cell.column + direction.column,
      };
      const neighborKey = cellKey(neighbor);
      if (
        !isInsideGrid(neighbor, rows, columns) ||
        obstacles.has(neighborKey) ||
        discovered.has(neighborKey)
      ) {
        continue;
      }

      discovered.add(neighborKey);
      parents.set(neighborKey, current.cell);
      const node = {
        cell: neighbor,
        g: current.g + 1,
        h: manhattanDistance(neighbor, destination),
      };
      // Equal h scores keep insertion order, which follows DIRECTIONS (Up, Right, Down, Left).
      frontier.enqueue(node, node.h);
    }
  }

  const path = found ? reconstructPath(start, destination, parents) : [];
  return makeResult('GREEDY', found, path, steps);
}

/**
 * A* Search
 * Balances actual cost g(n) with estimated remaining cost h(n) via f(n) = g(n) + h(n).
 * Guarantees the shortest path using an admissible and consistent heuristic (Manhattan distance).
 */
export function aStarSearch(
  rows: number,
  columns: number,
  start: GridCell,
  destination: GridCell,
  obstacles: ReadonlySet<string> = new Set(),
): GridSearchResult {
  validateDimensions(rows, columns);
  const steps: SearchStep[] = [];
  if (hasInvalidEndpoint(rows, columns, start, destination, obstacles)) {
    return makeResult('A_STAR', false, [], steps);
  }

  const startKey = cellKey(start);
  const startNode = { cell: { ...start }, g: 0, h: manhattanDistance(start, destination) };
  const frontier = new MinPriorityQueue<HeuristicNode>();
  const bestCosts = new Map<string, number>([[startKey, 0]]);
  const closed = new Set<string>();
  const parents = new Map<string, GridCell>();
  // Primary priority f(n) = g(n) + h(n); secondary priority h(n) for tie-breaking.
  frontier.enqueue(startNode, startNode.g + startNode.h, startNode.h);
  let found = false;
  let order = 0;

  while (frontier.size > 0) {
    const current = frontier.dequeue();
    if (!current) break;

    const currentKey = cellKey(current.cell);
    if (closed.has(currentKey) || bestCosts.get(currentKey) !== current.g) continue;

    closed.add(currentKey);
    const totalCost = current.g + current.h;
    steps.push({
      type: 'visit',
      cell: current.cell,
      order: ++order,
      depth: current.g,
      g: current.g,
      h: current.h,
      f: totalCost,
    });

    if (sameCell(current.cell, destination)) {
      found = true;
      break;
    }

    for (const direction of DIRECTIONS) {
      const neighbor = {
        row: current.cell.row + direction.row,
        column: current.cell.column + direction.column,
      };
      const neighborKey = cellKey(neighbor);
      if (
        !isInsideGrid(neighbor, rows, columns) ||
        obstacles.has(neighborKey) ||
        closed.has(neighborKey)
      ) {
        continue;
      }

      const tentativeCost = current.g + 1;
      if (tentativeCost >= (bestCosts.get(neighborKey) ?? Number.POSITIVE_INFINITY)) continue;

      const heuristic = manhattanDistance(neighbor, destination);
      const node = { cell: neighbor, g: tentativeCost, h: heuristic };
      bestCosts.set(neighborKey, tentativeCost);
      parents.set(neighborKey, current.cell);
      // Tie-break equal f scores by lower h(n), then stable insertion order.
      frontier.enqueue(node, node.g + node.h, node.h);
    }
  }

  const path = found ? reconstructPath(start, destination, parents) : [];
  return makeResult('A_STAR', found, path, steps);
}

/**
 * Unified runner executing any of the 4 search algorithms via a single consistent signature.
 */
export function runGridSearch(
  algorithm: SearchAlgorithm,
  rows: number,
  columns: number,
  start: GridCell,
  destination: GridCell,
  obstacles: ReadonlySet<string> = new Set(),
): GridSearchResult {
  switch (algorithm) {
    case 'BFS':
      return breadthFirstSearch(rows, columns, start, destination, obstacles);
    case 'DFS':
      return depthFirstSearch(rows, columns, start, destination, obstacles);
    case 'GREEDY':
      return greedyBestFirstSearch(rows, columns, start, destination, obstacles);
    case 'A_STAR':
      return aStarSearch(rows, columns, start, destination, obstacles);
    default: {
      const exhaustiveCheck: never = algorithm;
      throw new Error(`Unsupported search algorithm: ${String(exhaustiveCheck)}`);
    }
  }
}
