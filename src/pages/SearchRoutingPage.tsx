import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Clock3,
  Flag,
  Info,
  Layers3,
  MapPin,
  MousePointer2,
  Pause,
  Play,
  RotateCcw,
  Route as RouteIcon,
  ShieldCheck,
  Target,
  Trash2,
} from 'lucide-react';
import {
  aStarSearch,
  breadthFirstSearch,
  cellKey,
  depthFirstSearch,
  greedyBestFirstSearch,
  type GridCell,
  type GridSearchResult,
  type SearchAlgorithm,
  type SearchStep,
} from '../algorithms/gridSearch';

const GRID_ROWS = 12;
const GRID_COLUMNS = 12;
const algorithms: SearchAlgorithm[] = ['BFS', 'DFS', 'GREEDY', 'A_STAR'];

type CellMode = 'start' | 'destination' | 'obstacles';
type PlaybackStatus = 'idle' | 'running' | 'paused' | 'complete';
type AnimationFrame = SearchStep | { type: 'path'; cell: GridCell; order: number };
type SearchMetrics = GridSearchResult & { executionTimeMs: number };

const algorithmNames: Record<SearchAlgorithm, string> = {
  BFS: 'BFS',
  DFS: 'DFS',
  GREEDY: 'Greedy Best-First',
  A_STAR: 'A*',
};

const algorithmDescriptions: Record<SearchAlgorithm, string> = {
  BFS: 'Queue · level by level',
  DFS: 'Stack · depth and backtrack',
  GREEDY: 'Priority queue · lowest h(n)',
  A_STAR: 'Priority queue · lowest f(n)',
};

const searchRunners: Record<
  SearchAlgorithm,
  (rows: number, columns: number, start: GridCell, destination: GridCell, obstacles: ReadonlySet<string>) => GridSearchResult
> = {
  BFS: breadthFirstSearch,
  DFS: depthFirstSearch,
  GREEDY: greedyBestFirstSearch,
  A_STAR: aStarSearch,
};

const complexity: Record<SearchAlgorithm, { time: string; space: string; optimality: string }> = {
  BFS: { time: 'O(V + E)', space: 'O(V)', optimality: 'Yes · equal-cost moves' },
  DFS: { time: 'O(V + E)', space: 'O(V)', optimality: 'No' },
  GREEDY: { time: 'O((V + E) log V)', space: 'O(V)', optimality: 'No' },
  A_STAR: { time: 'O((V + E) log V)', space: 'O(V)', optimality: 'Yes · admissible, consistent h' },
};

function cellLabel(cell: GridCell): string {
  return `row ${cell.row + 1}, column ${cell.column + 1}`;
}

function formatExecutionTime(milliseconds: number): string {
  return milliseconds < 0.01 ? '< 0.01 ms' : `${milliseconds.toFixed(2)} ms`;
}

function createFrames(result: GridSearchResult): AnimationFrame[] {
  return [
    ...result.steps,
    ...result.path.map((cell, index) => ({ type: 'path' as const, cell, order: index + 1 })),
  ];
}

function SearchRoutingPage() {
  const [start, setStart] = useState<GridCell>({ row: 5, column: 2 });
  const [destination, setDestination] = useState<GridCell>({ row: 5, column: 9 });
  const [obstacles, setObstacles] = useState<Set<string>>(() => new Set());
  const [mode, setMode] = useState<CellMode>('obstacles');
  const [algorithm, setAlgorithm] = useState<SearchAlgorithm>('BFS');
  const [speed, setSpeed] = useState(7);
  const [playback, setPlayback] = useState<PlaybackStatus>('idle');
  const [frames, setFrames] = useState<AnimationFrame[]>([]);
  const [frameIndex, setFrameIndex] = useState(0);
  const [currentFrame, setCurrentFrame] = useState<AnimationFrame | null>(null);
  const [visited, setVisited] = useState<Set<string>>(() => new Set());
  const [visitOrder, setVisitOrder] = useState<Map<string, number>>(() => new Map());
  const [backtracked, setBacktracked] = useState<Set<string>>(() => new Set());
  const [pathCells, setPathCells] = useState<Set<string>>(() => new Set());
  const [activeCell, setActiveCell] = useState<string | null>(null);
  const [currentResult, setCurrentResult] = useState<SearchMetrics | null>(null);
  const [comparison, setComparison] = useState<Partial<Record<SearchAlgorithm, SearchMetrics>>>({});
  const [notice, setNotice] = useState<string | null>(null);

  const grid = useMemo(
    () => Array.from({ length: GRID_ROWS * GRID_COLUMNS }, (_, index) => ({
      row: Math.floor(index / GRID_COLUMNS),
      column: index % GRID_COLUMNS,
    })),
    [],
  );
  const animationDelay = Math.max(10, 110 - speed * 10);
  const progress = frames.length ? Math.round((frameIndex / frames.length) * 100) : 0;

  useEffect(() => {
    if (playback !== 'running') return undefined;
    if (frameIndex >= frames.length) {
      setPlayback('complete');
      setActiveCell(null);
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      const frame = frames[frameIndex];
      const key = cellKey(frame.cell);
      setCurrentFrame(frame);
      setActiveCell(key);

      if (frame.type === 'visit') {
        setVisited(current => new Set(current).add(key));
        setVisitOrder(current => new Map(current).set(key, frame.order));
      } else if (frame.type === 'backtrack') {
        setBacktracked(current => new Set(current).add(key));
      } else {
        setPathCells(current => new Set(current).add(key));
      }

      setFrameIndex(index => index + 1);
    }, animationDelay);

    return () => window.clearTimeout(timeout);
  }, [animationDelay, frameIndex, frames, playback]);

  function clearVisualization(clearComparison = true) {
    setPlayback('idle');
    setFrames([]);
    setFrameIndex(0);
    setCurrentFrame(null);
    setVisited(new Set());
    setVisitOrder(new Map());
    setBacktracked(new Set());
    setPathCells(new Set());
    setActiveCell(null);
    setCurrentResult(null);
    if (clearComparison) setComparison({});
  }

  function chooseAlgorithm(option: SearchAlgorithm) {
    if (option === algorithm) return;
    clearVisualization(false);
    setAlgorithm(option);
  }

  function handleCellClick(cell: GridCell) {
    const key = cellKey(cell);
    setNotice(null);

    if (mode === 'start' && key === cellKey(destination)) {
      setNotice('Start and destination must be different cells.');
      return;
    }
    if (mode === 'destination' && key === cellKey(start)) {
      setNotice('Start and destination must be different cells.');
      return;
    }
    if (mode === 'obstacles' && (key === cellKey(start) || key === cellKey(destination))) {
      setNotice('Start and destination cells cannot be obstacles.');
      return;
    }

    clearVisualization();
    if (mode === 'start') {
      setStart(cell);
      setObstacles(current => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    } else if (mode === 'destination') {
      setDestination(cell);
      setObstacles(current => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    } else {
      setObstacles(current => {
        const next = new Set(current);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
    }
  }

  function runSearch() {
    const beganAt = performance.now();
    const result = searchRunners[algorithm](GRID_ROWS, GRID_COLUMNS, start, destination, obstacles);
    const metrics: SearchMetrics = {
      ...result,
      executionTimeMs: performance.now() - beganAt,
    };

    setCurrentResult(metrics);
    setComparison(current => ({ ...current, [algorithm]: metrics }));
    setFrames(createFrames(result));
    setFrameIndex(0);
    setCurrentFrame(null);
    setVisited(new Set());
    setVisitOrder(new Map());
    setBacktracked(new Set());
    setPathCells(new Set());
    setActiveCell(null);
    setNotice(null);
    setPlayback('running');
  }

  function resetPlayback() {
    clearVisualization();
    setNotice('Visualization reset. Your endpoints and obstacle layout are unchanged.');
  }

  function clearObstacles() {
    if (obstacles.size === 0) return;
    clearVisualization();
    setObstacles(new Set());
    setNotice('All obstacles removed. Previous comparison results were cleared.');
  }

  const currentStepLabel = currentFrame
    ? currentFrame.type === 'visit'
      ? `${algorithmNames[algorithm]} explores ${cellLabel(currentFrame.cell)} at depth ${currentFrame.depth}; visit order ${currentFrame.order}${currentFrame.g !== undefined && currentFrame.h !== undefined ? ` · g=${currentFrame.g}, h=${currentFrame.h}${currentFrame.f !== undefined ? `, f=${currentFrame.f}` : ''}` : ''}.`
      : currentFrame.type === 'backtrack'
        ? `DFS backtracks from ${cellLabel(currentFrame.cell)} after exhausting its available neighbours.`
        : `Path animation: cell ${currentFrame.order} of ${currentResult?.path.length ?? 0} at ${cellLabel(currentFrame.cell)}.`
    : playback === 'complete' && currentResult
      ? currentResult.found
        ? `${algorithmNames[algorithm]} found a path using ${currentResult.nodesVisited} visited cells.`
        : `${algorithmNames[algorithm]} explored all reachable cells; the destination is unreachable.`
      : 'Choose a cell to inspect the traversal, then start a search.';

  return (
    <>
      <div className="page-heading search-page-heading">
        <div>
          <div className="eyebrow"><span /> ALGORITHM LAB · SIMULATION</div>
          <h1>Search &amp; Routing</h1>
          <p>Compare uninformed and heuristic searches on the same simulated disaster-response grid.</p>
        </div>
        <span className="search-simulation-badge"><ShieldCheck size={14} /> SIMULATION · NOT A LIVE MAP</span>
      </div>

      <section className="search-intro" aria-label="Simulation disclaimer">
        <Info size={17} />
        <p>This editable grid is a learning simulation. Its cell coordinates, start, destination, and obstacles do not represent real locations, roads, or incident data.</p>
      </section>

      <section className="search-workspace" aria-label="Grid search workspace">
        <div className="search-map-card">
          <div className="search-card-heading">
            <div>
              <span className="search-kicker">INTERACTIVE GRID</span>
              <h2>Simulated affected area</h2>
              <p>{GRID_ROWS} × {GRID_COLUMNS} cells · orthogonal movement · fixed neighbour order: up, right, down, left</p>
            </div>
            <span className="search-grid-count"><Layers3 size={14} /> {obstacles.size} obstacles</span>
          </div>

          <div className="search-map-toolbar">
            <div className="search-mode-buttons" role="group" aria-label="Grid editing mode">
              <button type="button" className={mode === 'start' ? 'is-selected' : ''} aria-pressed={mode === 'start'} onClick={() => setMode('start')}>
                <MapPin size={14} /> Set start
              </button>
              <button type="button" className={mode === 'destination' ? 'is-selected' : ''} aria-pressed={mode === 'destination'} onClick={() => setMode('destination')}>
                <Flag size={14} /> Set destination
              </button>
              <button type="button" className={mode === 'obstacles' ? 'is-selected' : ''} aria-pressed={mode === 'obstacles'} onClick={() => setMode('obstacles')}>
                <MousePointer2 size={14} /> Add / remove obstacles
              </button>
            </div>
            <button type="button" className="search-clear-button" onClick={clearObstacles} disabled={obstacles.size === 0}>
              <Trash2 size={14} /> Clear obstacles
            </button>
          </div>

          <div className="search-map-frame">
            <div className="search-grid" role="grid" aria-label="Simulated disaster area grid">
              {grid.map(cell => {
                const key = cellKey(cell);
                const isStart = key === cellKey(start);
                const isDestination = key === cellKey(destination);
                const isObstacle = obstacles.has(key);
                const isPath = pathCells.has(key);
                const isBacktracked = backtracked.has(key);
                const isVisited = visited.has(key);
                const classes = [
                  'search-cell',
                  isStart && 'cell-start',
                  isDestination && 'cell-destination',
                  isObstacle && 'cell-obstacle',
                  isVisited && 'cell-visited',
                  isBacktracked && 'cell-backtracked',
                  isPath && 'cell-path',
                  activeCell === key && 'cell-active',
                ].filter(Boolean).join(' ');
                const label = [
                  cellLabel(cell),
                  isStart ? 'start' : null,
                  isDestination ? 'destination' : null,
                  isObstacle ? 'obstacle' : null,
                  visitOrder.has(key) ? `visited order ${visitOrder.get(key)}` : null,
                  isPath ? 'final path' : null,
                  isBacktracked ? 'DFS backtracked' : null,
                ].filter(Boolean).join(', ');

                return (
                  <button
                    className={classes}
                    type="button"
                    role="gridcell"
                    key={key}
                    aria-label={label}
                    aria-pressed={isStart || isDestination || isObstacle}
                    title={label}
                    onClick={() => handleCellClick(cell)}
                  >
                    {isStart ? 'S' : isDestination ? 'D' : isObstacle ? '' : visitOrder.get(key) ?? ''}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="search-map-legend" aria-label="Map legend">
            <span><i className="legend-start">S</i> Start</span>
            <span><i className="legend-destination">D</i> Destination</span>
            <span><i className="legend-obstacle" /> Obstacle</span>
            <span><i className="legend-visited" /> Visited</span>
            <span><i className="legend-backtracked" /> Backtracked</span>
            <span><i className="legend-path" /> Final path</span>
          </div>

          <div className="search-map-coordinates">
            <span><MapPin size={13} /> Start: {cellLabel(start)}</span>
            <span><Target size={13} /> Destination: {cellLabel(destination)}</span>
          </div>
          {notice && <p className="search-notice" role="status">{notice}</p>}
        </div>

        <aside className="search-control-card" aria-labelledby="search-controls-title">
          <div className="search-card-heading">
            <div>
              <span className="search-kicker">TRAVERSAL CONTROLS</span>
              <h2 id="search-controls-title">Choose an algorithm</h2>
            </div>
          </div>

          <div className="search-algorithm-picker" role="group" aria-label="Search algorithm">
            {algorithms.map(option => (
              <button
                type="button"
                key={option}
                className={algorithm === option ? 'is-selected' : ''}
                aria-pressed={algorithm === option}
                disabled={playback === 'running' || playback === 'paused'}
                onClick={() => chooseAlgorithm(option)}
              >
                <span>{algorithmNames[option]}</span>
                <small>{algorithmDescriptions[option]}</small>
              </button>
            ))}
          </div>

          <div className="search-playback-controls">
            <button
              type="button"
              className="primary-button search-start-button"
              onClick={runSearch}
              disabled={playback === 'running' || playback === 'paused'}
            >
              <Play size={15} /> Start {algorithm}
            </button>
            {playback === 'running' ? (
              <button type="button" className="secondary-button" onClick={() => setPlayback('paused')}>
                <Pause size={15} /> Pause
              </button>
            ) : playback === 'paused' ? (
              <button type="button" className="secondary-button" onClick={() => setPlayback('running')}>
                <Play size={15} /> Resume
              </button>
            ) : (
              <button type="button" className="secondary-button" onClick={resetPlayback}>
                <RotateCcw size={15} /> Reset
              </button>
            )}
            {(playback === 'running' || playback === 'paused') && (
              <button type="button" className="search-reset-button" onClick={resetPlayback}>
                <RotateCcw size={14} /> Reset
              </button>
            )}
          </div>

          <label className="search-speed-control" htmlFor="search-speed">
            <span><Activity size={14} /> Animation speed</span>
            <strong>{speed}×</strong>
            <input
              id="search-speed"
              type="range"
              min="1"
              max="10"
              step="1"
              value={speed}
              onChange={event => setSpeed(Number(event.currentTarget.value))}
            />
            <small>Slow <span>Adjustable during playback</span> Fast</small>
          </label>

          <div className={`search-playback-status status-${playback}`}>
            <span className="search-status-dot" />
            <strong>{playback === 'running' ? 'Animating' : playback === 'paused' ? 'Paused' : playback === 'complete' ? 'Search complete' : 'Ready'}</strong>
            {playback !== 'idle' && <span>{progress}%</span>}
          </div>
          {playback !== 'idle' && (
            <div className="search-progress" aria-label={`Animation progress ${progress}%`}>
              <span style={{ width: `${progress}%` }} />
            </div>
          )}

          <div className="search-live-step" aria-live="polite">
            <span className="search-live-step-icon"><Clock3 size={15} /></span>
            <p>{currentStepLabel}</p>
          </div>
        </aside>
      </section>

      <section className="search-results-section" aria-labelledby="search-results-title">
        <div className="search-section-heading">
          <div>
            <span className="search-kicker">SAME GRID · REAL RUNS ONLY</span>
            <h2 id="search-results-title">Algorithm comparison</h2>
            <p>Run all four algorithms on this exact layout. Editing endpoints or obstacles clears prior measurements.</p>
          </div>
          {currentResult && (
            <span className={`search-result-badge ${currentResult.found ? 'result-found' : 'result-not-found'}`}>
              {currentResult.found ? <CheckCircle2 size={14} /> : <Info size={14} />}
              {currentResult.found ? 'Path found' : 'No path found'}
            </span>
          )}
        </div>

        <div className="search-table-wrap">
          <table className="search-comparison-table">
            <thead>
              <tr>
                <th scope="col">Algorithm</th>
                <th scope="col">Nodes visited</th>
                <th scope="col">Path length (moves)</th>
                <th scope="col">Execution time</th>
                <th scope="col">Path found</th>
                <th scope="col">Optimality</th>
                <th scope="col">Time complexity</th>
                <th scope="col">Space complexity</th>
              </tr>
            </thead>
            <tbody>
              {algorithms.map(option => {
                const result = comparison[option];
                return (
                  <tr key={option}>
                    <th scope="row">
                      <button
                        type="button"
                        className={`search-algorithm-link${algorithm === option ? ' is-active' : ''}`}
                        onClick={() => {
                          if (playback !== 'running' && playback !== 'paused') chooseAlgorithm(option);
                        }}
                        disabled={playback === 'running' || playback === 'paused'}
                      >
                        {algorithmNames[option]}
                      </button>
                    </th>
                    <td>{result ? result.nodesVisited : 'Not run'}</td>
                    <td>{result?.found ? result.pathLength : result ? '—' : 'Not run'}</td>
                    <td>{result ? formatExecutionTime(result.executionTimeMs) : 'Not run'}</td>
                    <td>{result ? result.found ? 'Yes' : 'No' : 'Not run'}</td>
                    <td>{complexity[option].optimality}</td>
                    <td>{complexity[option].time}</td>
                    <td>{complexity[option].space}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="search-comparison-note">
          Execution time measures the synchronous search computation, not the cell animation. V is the number of grid cells and E is the number of valid neighbour connections.
        </p>
      </section>

      <section className="search-learning-section" aria-labelledby="search-learning-title">
        <div className="search-section-heading">
          <div>
            <span className="search-kicker">LEARN BY OBSERVING</span>
            <h2 id="search-learning-title">How the searches work</h2>
            <p>Follow the highlighted cells and the step description while each algorithm explores this same grid.</p>
          </div>
        </div>

        <div className="search-learning-grid">
          <article className={`search-learning-card${algorithm === 'BFS' ? ' is-selected' : ''}`}>
            <span className="search-learning-icon"><Layers3 size={17} /></span>
            <h3>Breadth-first search</h3>
            <p>BFS uses a FIFO queue. It explores all reachable cells at the current distance before moving to the next distance layer.</p>
            <dl>
              <div><dt>Data structure</dt><dd>Queue · first in, first out</dd></div>
              <div><dt>Completeness</dt><dd>Complete on a finite grid</dd></div>
              <div><dt>Optimality</dt><dd>Finds a shortest path when each move has equal cost</dd></div>
              <div><dt>Complexity</dt><dd>Time O(V + E) · Space O(V)</dd></div>
            </dl>
          </article>

          <article className={`search-learning-card${algorithm === 'DFS' ? ' is-selected' : ''}`}>
            <span className="search-learning-icon"><RouteIcon size={17} /></span>
            <h3>Depth-first search</h3>
            <p>DFS uses an explicit stack of traversal frames. It follows one branch deeply, then backtracks when no unvisited neighbour remains.</p>
            <dl>
              <div><dt>Data structure</dt><dd>Stack · last in, first out</dd></div>
              <div><dt>Completeness</dt><dd>Complete on a finite grid with visited-cell tracking</dd></div>
              <div><dt>Optimality</dt><dd>Does not guarantee the shortest path</dd></div>
              <div><dt>Complexity</dt><dd>Time O(V + E) · Space O(V)</dd></div>
            </dl>
          </article>

          <article className={`search-learning-card${algorithm === 'GREEDY' ? ' is-selected' : ''}`}>
            <span className="search-learning-icon"><Target size={17} /></span>
            <h3>Greedy best-first search</h3>
            <p>Greedy orders the frontier by h(n), Manhattan distance to the destination. It follows what looks closest, without accounting for the path already travelled.</p>
            <dl>
              <div><dt>Data structure</dt><dd>Priority queue · lowest h(n)</dd></div>
              <div><dt>Completeness</dt><dd>Complete on this finite grid with visited-cell tracking</dd></div>
              <div><dt>Optimality</dt><dd>Not guaranteed; a detour may be returned</dd></div>
              <div><dt>Complexity</dt><dd>Time O((V + E) log V) · Space O(V)</dd></div>
            </dl>
          </article>

          <article className={`search-learning-card${algorithm === 'A_STAR' ? ' is-selected' : ''}`}>
            <span className="search-learning-icon"><Activity size={17} /></span>
            <h3>A* search</h3>
            <p>A* orders the frontier by f(n) = g(n) + h(n), balancing travelled cost with estimated remaining cost.</p>
            <dl>
              <div><dt>Data structure</dt><dd>Priority queue · lowest f(n)</dd></div>
              <div><dt>Completeness</dt><dd>Complete on this finite grid</dd></div>
              <div><dt>Optimality</dt><dd>Optimal with the admissible, consistent Manhattan heuristic and unit move costs</dd></div>
              <div><dt>Complexity</dt><dd>Time O((V + E) log V) · Space O(V) on this grid</dd></div>
            </dl>
          </article>
        </div>

        <article className="search-heuristic-panel">
          <div className="search-heuristic-heading">
            <span className="search-learning-icon"><Target size={17} /></span>
            <div>
              <h3>Heuristics: an estimate that guides exploration</h3>
              <p>On this four-direction grid, Manhattan distance ignores obstacles and counts row and column steps.</p>
            </div>
          </div>
          <div className="search-heuristic-equations">
            <div><strong>g(n)</strong><span>Actual moves from the start to node n</span></div>
            <div><strong>h(n)</strong><span>|rowₙ − rowgoal| + |columnₙ − columngoal|</span></div>
            <div><strong>f(n)</strong><span>g(n) + h(n) · A* priority score</span></div>
          </div>
          <p>
            Greedy ranks by h(n) alone, so it can choose a promising-looking detour. A* also counts the cost already paid.
            Manhattan distance never overestimates the remaining unit-cost path and is consistent across each grid edge;
            therefore, when A* removes the destination from its priority queue, its route is shortest. A heuristic
            focuses exploration toward plausible routes, but does not guarantee fewer expansions on every grid.
          </p>
          <div className="search-tie-note">
            Deterministic ties: neighbours are considered up, right, down, left; equal queue priorities preserve insertion order. A* then breaks equal f(n) ties by lower h(n).
          </div>
        </article>

        <div className="search-step-panel">
          <span className="search-step-mark"><Clock3 size={15} /> STEP-BY-STEP</span>
          <p>{currentStepLabel}</p>
          {currentResult && (
            <span className="search-step-summary">
              {currentResult.algorithm} · {currentResult.nodesVisited} nodes visited
              {currentResult.found ? ` · ${currentResult.pathLength} moves` : ' · destination unreachable'}
            </span>
          )}
        </div>
      </section>

      <div className="search-safety-note">
        <ShieldCheck size={16} />
        <span>Educational demonstration only. This module does not query live roads, incidents, emergency services, or the backend routing API.</span>
      </div>
    </>
  );
}

export default SearchRoutingPage;
