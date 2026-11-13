import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  aStarSearch,
  breadthFirstSearch,
  cellKey,
  depthFirstSearch,
  greedyBestFirstSearch,
  manhattanDistance,
  type GridCell,
} from './gridSearch';

const cell = (row: number, column: number): GridCell => ({ row, column });

describe('grid search algorithms', () => {
  it('BFS finds a shortest path in an unweighted grid', () => {
    const result = breadthFirstSearch(
      3,
      3,
      cell(0, 0),
      cell(2, 2),
      new Set(['1,0', '1,1']),
    );

    assert.equal(result.found, true);
    assert.equal(result.pathLength, 4);
    assert.deepEqual(result.path, [
      cell(0, 0),
      cell(0, 1),
      cell(0, 2),
      cell(1, 2),
      cell(2, 2),
    ]);
  });

  it('DFS records depth-first visits and backtracks before finding a route', () => {
    const result = depthFirstSearch(
      3,
      3,
      cell(0, 0),
      cell(2, 0),
      new Set(['1,1', '1,2']),
    );

    assert.equal(result.found, true);
    assert.ok(result.steps.some(step => step.type === 'backtrack'));
    assert.deepEqual(
      result.steps.filter(step => step.type === 'visit').map(step => cellKey(step.cell)),
      ['0,0', '0,1', '0,2', '1,0', '2,0'],
    );
    assert.equal(result.pathLength, 2);
  });

  it('returns no path when a destination is blocked or isolated', () => {
    const blockedDestination = breadthFirstSearch(
      3,
      3,
      cell(0, 0),
      cell(2, 2),
      new Set(['2,2']),
    );
    const isolatedDestination = depthFirstSearch(
      3,
      3,
      cell(1, 0),
      cell(1, 2),
      new Set(['0,1', '1,1', '2,1']),
    );

    assert.equal(blockedDestination.found, false);
    assert.equal(blockedDestination.nodesVisited, 0);
    assert.equal(isolatedDestination.found, false);
    assert.equal(isolatedDestination.path.length, 0);
    assert.ok(isolatedDestination.steps.some(step => step.type === 'backtrack'));
  });

  it('does not mutate the supplied obstacle set and returns deterministic traversal', () => {
    const obstacles = new Set(['1,1']);
    const first = breadthFirstSearch(3, 3, cell(0, 0), cell(2, 2), obstacles);
    const second = breadthFirstSearch(3, 3, cell(0, 0), cell(2, 2), obstacles);

    assert.deepEqual(first, second);
    assert.deepEqual([...obstacles], ['1,1']);
  });

  it('Greedy and A* both navigate obstacles, but Greedy can return a longer path', () => {
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
    assert.equal(greedy.pathLength, 14);
    assert.equal(aStar.pathLength, 10);
    assert.ok(greedy.path.every(position => !obstacles.has(cellKey(position))));
    assert.ok(aStar.path.every(position => !obstacles.has(cellKey(position))));
    assert.ok(aStar.pathLength < greedy.pathLength);
  });

  it('A* matches BFS shortest-path lengths across deterministic obstacle layouts', () => {
    const layouts = [
      { rows: 4, columns: 5, start: cell(0, 0), destination: cell(3, 4), obstacles: new Set<string>() },
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
        rows: 4,
        columns: 4,
        start: cell(1, 0),
        destination: cell(1, 3),
        obstacles: new Set(['0,1', '1,1', '2,1', '3,1']),
      },
    ];

    for (const layout of layouts) {
      const bfs = breadthFirstSearch(
        layout.rows,
        layout.columns,
        layout.start,
        layout.destination,
        layout.obstacles,
      );
      const aStar = aStarSearch(
        layout.rows,
        layout.columns,
        layout.start,
        layout.destination,
        layout.obstacles,
      );

      assert.equal(aStar.found, bfs.found);
      assert.equal(aStar.pathLength, bfs.pathLength);
      assert.ok(aStar.steps.every(step => step.type !== 'visit' || step.f === step.g! + step.h!));
    }
  });

  it('Greedy and A* report unreachable destinations and keep deterministic tie-breaking', () => {
    const obstacles = new Set(['0,1', '1,1', '2,1', '3,1']);
    const greedy = greedyBestFirstSearch(4, 4, cell(1, 0), cell(1, 3), obstacles);
    const aStar = aStarSearch(4, 4, cell(1, 0), cell(1, 3), obstacles);

    assert.equal(greedy.found, false);
    assert.equal(aStar.found, false);
    assert.equal(greedy.path.length, 0);
    assert.equal(aStar.path.length, 0);
    assert.deepEqual(
      greedyBestFirstSearch(4, 4, cell(0, 0), cell(3, 3), new Set()),
      greedyBestFirstSearch(4, 4, cell(0, 0), cell(3, 3), new Set()),
    );
    assert.deepEqual(
      aStarSearch(4, 4, cell(0, 0), cell(3, 3), new Set()),
      aStarSearch(4, 4, cell(0, 0), cell(3, 3), new Set()),
    );
  });

  it('uses Manhattan distance for the heuristic', () => {
    assert.equal(manhattanDistance(cell(1, 2), cell(4, 6)), 7);
  });
});
