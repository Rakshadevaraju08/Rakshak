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
  nodesVisited: number;
  steps: SearchStep[];
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

const DIRECTIONS = [
  { row: -1, column: 0 },
  { row: 0, column: 1 },
  { row: 1, column: 0 },
  { row: 0, column: -1 },
] as const;

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

function sameCell(left: GridCell, right: GridCell): boolean {
  return left.row === right.row && left.column === right.column;
}

function isInsideGrid(cell: GridCell, rows: number, columns: number): boolean {
  return cell.row >= 0 && cell.row < rows && cell.column >= 0 && cell.column < columns;
}

function validateDimensions(rows: number, columns: number): void {
  if (!Number.isInteger(rows) || rows < 1 || !Number.isInteger(columns) || columns < 1) {
    throw new RangeError('Grid dimensions must be positive integers.');
  }
}

function hasInvalidEndpoint(
  rows: number,
  columns: number,
  start: GridCell,
  destination: GridCell,
  obstacles: ReadonlySet<string>,
): boolean {
  return !isInsideGrid(start, rows, columns)
    || !isInsideGrid(destination, rows, columns)
    || obstacles.has(cellKey(start))
    || obstacles.has(cellKey(destination));
}

function reconstructPath(start: GridCell, destination: GridCell, parents: Map<string, GridCell>): GridCell[] {
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
  return {
    algorithm,
    found,
    path,
    pathLength: found ? Math.max(path.length - 1, 0) : 0,
    nodesVisited: steps.filter(step => step.type === 'visit').length,
    steps,
  };
}

export function breadthFirstSearch(
  rows: number,
  columns: number,
  start: GridCell,
  destination: GridCell,
  obstacles: ReadonlySet<string>,
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
        !isInsideGrid(neighbor, rows, columns)
        || obstacles.has(neighborKey)
        || discovered.has(neighborKey)
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

export function depthFirstSearch(
  rows: number,
  columns: number,
  start: GridCell,
  destination: GridCell,
  obstacles: ReadonlySet<string>,
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
        !isInsideGrid(neighbor, rows, columns)
        || obstacles.has(neighborKey)
        || visited.has(neighborKey)
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

export function greedyBestFirstSearch(
  rows: number,
  columns: number,
  start: GridCell,
  destination: GridCell,
  obstacles: ReadonlySet<string>,
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
        !isInsideGrid(neighbor, rows, columns)
        || obstacles.has(neighborKey)
        || discovered.has(neighborKey)
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
      // Equal h scores keep insertion order, which follows DIRECTIONS above.
      frontier.enqueue(node, node.h);
    }
  }

  const path = found ? reconstructPath(start, destination, parents) : [];
  return makeResult('GREEDY', found, path, steps);
}

export function aStarSearch(
  rows: number,
  columns: number,
  start: GridCell,
  destination: GridCell,
  obstacles: ReadonlySet<string>,
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
        !isInsideGrid(neighbor, rows, columns)
        || obstacles.has(neighborKey)
        || closed.has(neighborKey)
      ) {
        continue;
      }

      const tentativeCost = current.g + 1;
      if (tentativeCost >= (bestCosts.get(neighborKey) ?? Number.POSITIVE_INFINITY)) continue;

      const heuristic = manhattanDistance(neighbor, destination);
      const node = { cell: neighbor, g: tentativeCost, h: heuristic };
      bestCosts.set(neighborKey, tentativeCost);
      parents.set(neighborKey, current.cell);
      // Tie-break equal f scores by h, then stable insertion order.
      frontier.enqueue(node, node.g + node.h, node.h);
    }
  }

  const path = found ? reconstructPath(start, destination, parents) : [];
  return makeResult('A_STAR', found, path, steps);
}
