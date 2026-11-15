import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ALGORITHM_METADATA,
  aStarSearch,
  breadthFirstSearch,
  cellKey,
  depthFirstSearch,
  DIRECTIONS,
  greedyBestFirstSearch,
  isInsideGrid,
  manhattanDistance,
  runGridSearch,
  sameCell,
  validateGridConfig,
  type GridCell,
  type SearchAlgorithm,
} from './gridSearch';

const cell = (row: number, column: number): GridCell => ({ row, column });

describe('gridSearch Engine & Validation', () => {
  describe('pure validation function (validateGridConfig)', () => {
    it('catches empty or invalid grid dimensions', () => {
      const invalidRows = validateGridConfig(0, 5, cell(0, 0), cell(4, 4));
      assert.equal(invalidRows.valid, false);
      assert.ok(invalidRows.errors.some(err => err.includes('Grid dimensions must be positive integers')));

      const negativeCols = validateGridConfig(5, -1, cell(0, 0), cell(4, 4));
      assert.equal(negativeCols.valid, false);
      assert.ok(negativeCols.errors.some(err => err.includes('Grid dimensions must be positive integers')));

      const floatDims = validateGridConfig(3.5, 4, cell(0, 0), cell(2, 2));
      assert.equal(floatDims.valid, false);
      assert.ok(floatDims.errors.some(err => err.includes('Grid dimensions must be positive integers')));
    });

    it('catches missing start position', () => {
      const result = validateGridConfig(5, 5, null, cell(2, 2));
      assert.equal(result.valid, false);
      assert.ok(result.errors.includes('Start position is required.'));

      const resultUndefined = validateGridConfig(5, 5, undefined, cell(2, 2));
      assert.equal(resultUndefined.valid, false);
      assert.ok(resultUndefined.errors.includes('Start position is required.'));
    });

    it('catches missing goal position', () => {
      const result = validateGridConfig(5, 5, cell(0, 0), null);
      assert.equal(result.valid, false);
      assert.ok(result.errors.includes('Goal position is required.'));

      const resultUndefined = validateGridConfig(5, 5, cell(0, 0), undefined);
      assert.equal(resultUndefined.valid, false);
      assert.ok(resultUndefined.errors.includes('Goal position is required.'));
    });

    it('catches out-of-bounds start and goal coordinates', () => {
      const oobStartNegative = validateGridConfig(5, 5, cell(-1, 2), cell(3, 3));
      assert.equal(oobStartNegative.valid, false);
      assert.ok(oobStartNegative.errors.includes('Start position is out of grid bounds.'));

      const oobStartHigh = validateGridConfig(5, 5, cell(5, 0), cell(3, 3));
      assert.equal(oobStartHigh.valid, false);
      assert.ok(oobStartHigh.errors.includes('Start position is out of grid bounds.'));

      const oobGoalNegative = validateGridConfig(5, 5, cell(0, 0), cell(2, -1));
      assert.equal(oobGoalNegative.valid, false);
      assert.ok(oobGoalNegative.errors.includes('Goal position is out of grid bounds.'));

      const oobGoalHigh = validateGridConfig(5, 5, cell(0, 0), cell(2, 5));
      assert.equal(oobGoalHigh.valid, false);
      assert.ok(oobGoalHigh.errors.includes('Goal position is out of grid bounds.'));
    });

    it('catches start equals goal condition', () => {
      const result = validateGridConfig(5, 5, cell(2, 2), cell(2, 2));
      assert.equal(result.valid, false);
      assert.ok(result.errors.includes('Start and goal positions cannot be the same cell.'));
    });

    it('catches start or goal positioned on an obstacle', () => {
      const obstacles = new Set(['1,1', '3,3']);

      const startOnObstacle = validateGridConfig(5, 5, cell(1, 1), cell(4, 4), obstacles);
      assert.equal(startOnObstacle.valid, false);
      assert.ok(startOnObstacle.errors.includes('Start position cannot be on an obstacle.'));

      const goalOnObstacle = validateGridConfig(5, 5, cell(0, 0), cell(3, 3), obstacles);
      assert.equal(goalOnObstacle.valid, false);
      assert.ok(goalOnObstacle.errors.includes('Goal position cannot be on an obstacle.'));

      const bothOnObstacles = validateGridConfig(5, 5, cell(1, 1), cell(3, 3), obstacles);
      assert.equal(bothOnObstacles.valid, false);
      assert.ok(bothOnObstacles.errors.includes('Start position cannot be on an obstacle.'));
      assert.ok(bothOnObstacles.errors.includes('Goal position cannot be on an obstacle.'));
    });

    it('returns valid: true for legal grid configurations', () => {
      const result = validateGridConfig(12, 12, cell(0, 0), cell(11, 11), new Set(['1,1', '2,2']));
      assert.equal(result.valid, true);
      assert.equal(result.errors.length, 0);
      assert.equal(result.error, undefined);
    });

    it('collects multiple errors simultaneously', () => {
      const multiError = validateGridConfig(
        0,
        5,
        cell(10, 10),
        cell(10, 10),
        new Set(['10,10']),
      );
      assert.equal(multiError.valid, false);
      assert.ok(multiError.errors.length >= 2);
    });
  });

  describe('open grid traversal (all 4 algorithms)', () => {
    const algorithms: SearchAlgorithm[] = ['BFS', 'DFS', 'GREEDY', 'A_STAR'];

    it('all algorithms find a valid path on an open grid', () => {
      const start = cell(0, 0);
      const goal = cell(4, 4);

      for (const algo of algorithms) {
        const result = runGridSearch(algo, 5, 5, start, goal, new Set());

        assert.equal(result.algorithm, algo);
        assert.equal(result.found, true);
        assert.ok(result.path.length > 0);
        assert.deepEqual(result.path[0], start);
        assert.deepEqual(result.path[result.path.length - 1], goal);
        assert.equal(result.pathLength, result.path.length - 1);

        // Verify contiguous orthogonal steps along path
        for (let i = 0; i < result.path.length - 1; i++) {
          assert.equal(manhattanDistance(result.path[i], result.path[i + 1]), 1);
        }

        // Verify visitedOrder and visitedCount match steps
        assert.equal(result.visitedCount, result.visitedOrder.length);
        assert.equal(result.nodesVisited, result.visitedCount);
        assert.ok(result.visitedCount > 0);
      }
    });

    it('BFS and A* yield identical optimal path length on open grid', () => {
      const start = cell(0, 0);
      const goal = cell(5, 5);

      const bfs = breadthFirstSearch(6, 6, start, goal);
      const aStar = aStarSearch(6, 6, start, goal);

      assert.equal(bfs.found, true);
      assert.equal(aStar.found, true);
      assert.equal(bfs.pathLength, 10);
      assert.equal(aStar.pathLength, 10);
      assert.equal(bfs.pathLength, aStar.pathLength);
    });
  });

  describe('obstacle navigation (all 4 algorithms)', () => {
    it('all algorithms route around a wall without crossing obstacles', () => {
      // 5x5 grid with a vertical wall at col 2 from row 0 to 3
      const obstacles = new Set(['0,2', '1,2', '2,2', '3,2']);
      const start = cell(1, 0);
      const goal = cell(1, 4);

      const algorithms: SearchAlgorithm[] = ['BFS', 'DFS', 'GREEDY', 'A_STAR'];

      for (const algo of algorithms) {
        const result = runGridSearch(algo, 5, 5, start, goal, obstacles);

        assert.equal(result.found, true);
        assert.ok(result.path.length > 0);
        assert.deepEqual(result.path[0], start);
        assert.deepEqual(result.path[result.path.length - 1], goal);

        // No path cell intersects obstacles
        for (const p of result.path) {
          assert.equal(obstacles.has(cellKey(p)), false);
        }
      }
    });

    it('BFS and A* paths have equal length on unweighted obstacle layouts', () => {
      const layouts = [
        {
          rows: 5,
          columns: 5,
          start: cell(0, 0),
          destination: cell(4, 4),
          obstacles: new Set(['1,0', '1,1', '1,3', '2,3', '3,1']),
        },
        {
          rows: 6,
          columns: 6,
          start: cell(5, 0),
          destination: cell(0, 5),
          obstacles: new Set(['0,3', '0,4', '1,3', '1,4', '4,1', '4,3', '5,2', '5,4']),
        },
        {
          rows: 8,
          columns: 8,
          start: cell(0, 0),
          destination: cell(7, 7),
          obstacles: new Set(['2,0', '2,1', '2,2', '2,3', '2,4', '5,3', '5,4', '5,5', '5,6', '5,7']),
        },
      ];

      for (const layout of layouts) {
        const bfs = breadthFirstSearch(layout.rows, layout.columns, layout.start, layout.destination, layout.obstacles);
        const aStar = aStarSearch(layout.rows, layout.columns, layout.start, layout.destination, layout.obstacles);
        const greedy = greedyBestFirstSearch(layout.rows, layout.columns, layout.start, layout.destination, layout.obstacles);

        assert.equal(bfs.found, true);
        assert.equal(aStar.found, true);
        assert.equal(aStar.pathLength, bfs.pathLength, `A* (${aStar.pathLength}) must match BFS (${bfs.pathLength})`);

        // Greedy is also found, but may be suboptimal (pathLength >= optimal)
        assert.equal(greedy.found, true);
        assert.ok(greedy.pathLength >= aStar.pathLength);
      }
    });

    it('Greedy can return a longer path than A* / BFS due to ignoring path cost', () => {
      const obstacles = new Set([
        '0,3',
        '0,4',
        '1,3',
        '1,4',
        '4,1',
        '4,3',
        '5,2',
        '5,4',
      ]);
      const start = cell(5, 0);
      const destination = cell(0, 5);

      const greedy = greedyBestFirstSearch(6, 6, start, destination, obstacles);
      const aStar = aStarSearch(6, 6, start, destination, obstacles);

      assert.equal(greedy.found, true);
      assert.equal(aStar.found, true);
      assert.equal(aStar.pathLength, 10);
      assert.equal(greedy.pathLength, 14);
      assert.ok(greedy.pathLength > aStar.pathLength);
    });
  });

  describe('unreachable and blocked goals (all 4 algorithms)', () => {
    it('returns found: false with the full explored set when goal is isolated', () => {
      // 4x4 grid, goal at (1,3) completely walled off by column 2
      const obstacles = new Set(['0,2', '1,2', '2,2', '3,2']);
      const start = cell(1, 0);
      const goal = cell(1, 3);

      const algorithms: SearchAlgorithm[] = ['BFS', 'DFS', 'GREEDY', 'A_STAR'];

      for (const algo of algorithms) {
        const result = runGridSearch(algo, 4, 4, start, goal, obstacles);

        assert.equal(result.found, false);
        assert.equal(result.path.length, 0);
        assert.equal(result.pathLength, 0);

        // Explored the reachable 4x2 component (8 cells: cols 0 and 1)
        assert.equal(result.visitedCount, 8);
        assert.equal(result.visitedOrder.length, 8);
        assert.ok(result.visitedOrder.every(c => c.column < 2));
      }
    });

    it('handles destination directly surrounded by obstacles', () => {
      // (2,2) surrounded by (1,2), (3,2), (2,1), (2,3)
      const obstacles = new Set(['1,2', '3,2', '2,1', '2,3']);
      const start = cell(0, 0);
      const goal = cell(2, 2);

      const algorithms: SearchAlgorithm[] = ['BFS', 'DFS', 'GREEDY', 'A_STAR'];

      for (const algo of algorithms) {
        const result = runGridSearch(algo, 5, 5, start, goal, obstacles);

        assert.equal(result.found, false);
        assert.equal(result.path.length, 0);
        assert.equal(result.pathLength, 0);
        assert.ok(result.visitedCount > 0);
      }
    });

    it('returns found: false when start or destination is an obstacle without throwing', () => {
      const obstacles = new Set(['0,0', '4,4']);

      const bfsStartObs = breadthFirstSearch(5, 5, cell(0, 0), cell(2, 2), obstacles);
      assert.equal(bfsStartObs.found, false);
      assert.equal(bfsStartObs.path.length, 0);

      const bfsGoalObs = breadthFirstSearch(5, 5, cell(1, 1), cell(4, 4), obstacles);
      assert.equal(bfsGoalObs.found, false);
      assert.equal(bfsGoalObs.path.length, 0);
    });
  });

  describe('determinism and tie-breaking', () => {
    it('DIRECTIONS is fixed in Up, Right, Down, Left order', () => {
      assert.deepEqual(DIRECTIONS, [
        { row: -1, column: 0 },
        { row: 0, column: 1 },
        { row: 1, column: 0 },
        { row: 0, column: -1 },
      ]);
    });

    it('produces identical results across repeated runs on identical layouts', () => {
      const obstacles = new Set(['1,2', '2,2', '3,2', '4,2']);
      const start = cell(0, 0);
      const goal = cell(5, 5);

      const algorithms: SearchAlgorithm[] = ['BFS', 'DFS', 'GREEDY', 'A_STAR'];

      for (const algo of algorithms) {
        const run1 = runGridSearch(algo, 6, 6, start, goal, obstacles);
        const run2 = runGridSearch(algo, 6, 6, start, goal, obstacles);

        assert.deepEqual(run1, run2);
      }
    });

    it('does not mutate the supplied obstacles set', () => {
      const obstacles = new Set(['1,1', '2,2']);
      breadthFirstSearch(4, 4, cell(0, 0), cell(3, 3), obstacles);
      assert.equal(obstacles.size, 2);
      assert.ok(obstacles.has('1,1'));
      assert.ok(obstacles.has('2,2'));
    });
  });

  describe('algorithm metadata map (ALGORITHM_METADATA)', () => {
    it('contains accurate metadata for BFS, DFS, GREEDY, and A_STAR', () => {
      const bfsMeta = ALGORITHM_METADATA.BFS;
      assert.equal(bfsMeta.optimal, true);
      assert.equal(bfsMeta.usesHeuristic, false);
      assert.ok(bfsMeta.shortExplanation.includes('unweighted'));
      assert.ok(bfsMeta.dataStructure.includes('Queue'));

      const dfsMeta = ALGORITHM_METADATA.DFS;
      assert.equal(dfsMeta.optimal, false);
      assert.equal(dfsMeta.usesHeuristic, false);
      assert.ok(dfsMeta.shortExplanation.includes('Does not guarantee'));
      assert.ok(dfsMeta.dataStructure.includes('Stack'));

      const greedyMeta = ALGORITHM_METADATA.GREEDY;
      assert.equal(greedyMeta.optimal, false);
      assert.equal(greedyMeta.usesHeuristic, true);
      assert.ok(greedyMeta.shortExplanation.includes('h(n)'));
      assert.ok(greedyMeta.dataStructure.includes('Priority Queue'));

      const aStarMeta = ALGORITHM_METADATA.A_STAR;
      assert.equal(aStarMeta.optimal, true);
      assert.equal(aStarMeta.usesHeuristic, true);
      assert.ok(aStarMeta.shortExplanation.includes('admissible'));
      assert.ok(aStarMeta.dataStructure.includes('Priority Queue'));
    });
  });

  describe('edge cases and extreme configurations', () => {
    it('handles 1x1 grid: validation catches start equals goal', () => {
      const res = validateGridConfig(1, 1, cell(0, 0), cell(0, 0));
      assert.equal(res.valid, false);
      assert.ok(res.errors.includes('Start and goal positions cannot be the same cell.'));
    });

    it('handles tiny 2x2 grid: finds shortest path of length 2', () => {
      const algorithms: SearchAlgorithm[] = ['BFS', 'DFS', 'GREEDY', 'A_STAR'];
      for (const algo of algorithms) {
        const res = runGridSearch(algo, 2, 2, cell(0, 0), cell(1, 1));
        assert.equal(res.found, true);
        assert.equal(res.pathLength, 2);
        assert.equal(res.path.length, 3);
      }
    });

    it('handles start immediately adjacent to destination (1 move)', () => {
      // Optimal algorithms (BFS, A*) and Greedy (heuristic = 0 at destination neighbor) find the 1-move path
      for (const algo of ['BFS', 'GREEDY', 'A_STAR'] as const) {
        const res = runGridSearch(algo, 5, 5, cell(2, 2), cell(2, 3));
        assert.equal(res.found, true);
        assert.equal(res.pathLength, 1);
        assert.equal(res.path.length, 2);
        assert.deepEqual(res.path, [cell(2, 2), cell(2, 3)]);
      }

      // DFS explores depth-first along its search tree, wandering down branches
      // before finding destination, demonstrating non-optimality even when adjacent
      const dfsRes = runGridSearch('DFS', 5, 5, cell(2, 2), cell(2, 3));
      assert.equal(dfsRes.found, true);
      assert.ok(dfsRes.pathLength >= 1);
      assert.equal(dfsRes.path[0].row, 2);
      assert.equal(dfsRes.path[0].column, 2);
      assert.equal(dfsRes.path[dfsRes.path.length - 1].row, 2);
      assert.equal(dfsRes.path[dfsRes.path.length - 1].column, 3);
    });

    it('handles fully walled-in start: returns found: false and visitedCount: 1', () => {
      // Start at (1,1) surrounded by (0,1), (2,1), (1,0), (1,2)
      const obstacles = new Set(['0,1', '2,1', '1,0', '1,2']);
      const algorithms: SearchAlgorithm[] = ['BFS', 'DFS', 'GREEDY', 'A_STAR'];
      for (const algo of algorithms) {
        const res = runGridSearch(algo, 5, 5, cell(1, 1), cell(4, 4), obstacles);
        assert.equal(res.found, false);
        assert.equal(res.path.length, 0);
        assert.equal(res.visitedCount, 1);
        assert.deepEqual(res.visitedOrder, [cell(1, 1)]);
      }
    });

    it('handles fully walled-in destination: explores all reachable cells without error', () => {
      // Destination at (4,4) surrounded by (3,4) and (4,3)
      const obstacles = new Set(['3,4', '4,3']);
      const algorithms: SearchAlgorithm[] = ['BFS', 'DFS', 'GREEDY', 'A_STAR'];
      for (const algo of algorithms) {
        const res = runGridSearch(algo, 5, 5, cell(0, 0), cell(4, 4), obstacles);
        assert.equal(res.found, false);
        assert.equal(res.path.length, 0);
        // Total 25 cells - 2 obstacles - 1 goal = 22 reachable cells
        assert.equal(res.visitedCount, 22);
      }
    });

    it('executes efficiently on maximum 20x20 grid (400 cells)', () => {
      const algorithms: SearchAlgorithm[] = ['BFS', 'DFS', 'GREEDY', 'A_STAR'];
      const start = cell(0, 0);
      const goal = cell(19, 19);

      for (const algo of algorithms) {
        const t0 = performance.now();
        const res = runGridSearch(algo, 20, 20, start, goal);
        const duration = performance.now() - t0;

        assert.equal(res.found, true);
        assert.ok(duration < 50, `${algo} took ${duration}ms, should be < 50ms`);
      }
    });
  });

  describe('grid utilities', () => {
    it('manhattanDistance computes L1 distance correctly', () => {
      assert.equal(manhattanDistance(cell(1, 2), cell(4, 6)), 7);
      assert.equal(manhattanDistance(cell(0, 0), cell(0, 0)), 0);
      assert.equal(manhattanDistance(cell(5, 5), cell(2, 1)), 7);
    });

    it('sameCell and cellKey work accurately', () => {
      assert.equal(sameCell(cell(2, 3), cell(2, 3)), true);
      assert.equal(sameCell(cell(2, 3), cell(3, 2)), false);
      assert.equal(cellKey(cell(4, 7)), '4,7');
    });

    it('isInsideGrid handles boundary edges accurately', () => {
      assert.equal(isInsideGrid(cell(0, 0), 5, 5), true);
      assert.equal(isInsideGrid(cell(4, 4), 5, 5), true);
      assert.equal(isInsideGrid(cell(-1, 0), 5, 5), false);
      assert.equal(isInsideGrid(cell(0, -1), 5, 5), false);
      assert.equal(isInsideGrid(cell(5, 0), 5, 5), false);
      assert.equal(isInsideGrid(cell(0, 5), 5, 5), false);
    });
  });
});
