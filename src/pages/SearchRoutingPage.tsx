import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Dices,
  Flag,
  Info,
  Layers3,
  MapPin,
  MousePointer2,
  Paintbrush,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Route as RouteIcon,
  ShieldCheck,
  Target,
  Trash2,
} from 'lucide-react';
import {
  ALGORITHM_METADATA,
  cellKey,
  runGridSearch,
  sameCell,
  validateGridConfig,
  type GridCell,
  type GridSearchResult,
  type SearchAlgorithm,
  type SearchStep,
} from '../algorithms/gridSearch';

const ALGORITHMS: SearchAlgorithm[] = ['BFS', 'DFS', 'GREEDY', 'A_STAR'];

const GRID_SIZE_PRESETS = [
  { label: '6 × 6 (Mini)', rows: 6, cols: 6 },
  { label: '10 × 10', rows: 10, cols: 10 },
  { label: '12 × 12 (Default)', rows: 12, cols: 12 },
  { label: '16 × 16', rows: 16, cols: 16 },
  { label: '20 × 20 (Max)', rows: 20, cols: 20 },
] as const;

type InteractionMode = 'start' | 'destination' | 'draw' | 'erase';
type PlaybackStatus = 'idle' | 'running' | 'paused' | 'complete';
type AnimationFrame = SearchStep | { type: 'path'; cell: GridCell; order: number };
type SearchMetrics = GridSearchResult & { executionTimeMs: number };

interface NoticeState {
  type: 'info' | 'warn' | 'error' | 'success';
  text: string;
}

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

// Memoized individual cell button for 60fps performance on large grids
interface GridCellButtonProps {
  cell: GridCell;
  isStart: boolean;
  isDestination: boolean;
  isObstacle: boolean;
  isVisited: boolean;
  isBacktracked: boolean;
  isPath: boolean;
  isActive: boolean;
  order?: number;
  onPointerDown: (cell: GridCell, e: ReactPointerEvent) => void;
  onPointerEnter: (cell: GridCell) => void;
  onKeyDown: (cell: GridCell, e: KeyboardEvent) => void;
}

const GridCellButton = memo(function GridCellButton({
  cell,
  isStart,
  isDestination,
  isObstacle,
  isVisited,
  isBacktracked,
  isPath,
  isActive,
  order,
  onPointerDown,
  onPointerEnter,
  onKeyDown,
}: GridCellButtonProps) {
  const classes = [
    'search-cell',
    isStart && 'cell-start',
    isDestination && 'cell-destination',
    isObstacle && 'cell-obstacle',
    isVisited && 'cell-visited',
    isBacktracked && 'cell-backtracked',
    isPath && 'cell-path',
    isActive && 'cell-active',
  ]
    .filter(Boolean)
    .join(' ');

  const labelParts = [cellLabel(cell)];
  if (isStart) labelParts.push('start position');
  if (isDestination) labelParts.push('destination position');
  if (isObstacle) labelParts.push('obstacle wall');
  if (isPath) labelParts.push('optimal route cell');
  else if (isBacktracked) labelParts.push('DFS backtracked dead-end');
  else if (order !== undefined) labelParts.push(`visited order ${order}`);

  const ariaLabel = labelParts.join(', ');

  let cellDisplayContent = '';
  if (isStart) cellDisplayContent = 'S';
  else if (isDestination) cellDisplayContent = 'D';
  else if (isObstacle) cellDisplayContent = '';
  else if (isPath) cellDisplayContent = order !== undefined ? String(order) : '●';
  else if (order !== undefined) cellDisplayContent = String(order);

  return (
    <button
      className={classes}
      type="button"
      role="gridcell"
      aria-label={ariaLabel}
      title={ariaLabel}
      onPointerDown={e => onPointerDown(cell, e)}
      onPointerEnter={() => onPointerEnter(cell)}
      onKeyDown={e => onKeyDown(cell, e)}
    >
      {cellDisplayContent}
    </button>
  );
});

function SearchRoutingPage() {
  // Grid dimension configuration
  const [rows, setRows] = useState<number>(12);
  const [columns, setColumns] = useState<number>(12);

  // Endpoints and obstacles
  const [start, setStart] = useState<GridCell>({ row: 5, column: 2 });
  const [destination, setDestination] = useState<GridCell>({ row: 5, column: 9 });
  const [obstacles, setObstacles] = useState<Set<string>>(() => new Set());

  // Interaction mode
  const [mode, setMode] = useState<InteractionMode>('draw');

  // Algorithm selection and animation speed
  const [algorithm, setAlgorithm] = useState<SearchAlgorithm>('BFS');
  const [speed, setSpeed] = useState<number>(7);
  const [instantMode, setInstantMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  });

  // Playback & Animation states
  const [playback, setPlayback] = useState<PlaybackStatus>('idle');
  const [frames, setFrames] = useState<AnimationFrame[]>([]);
  const [frameIndex, setFrameIndex] = useState<number>(0);
  const [currentFrame, setCurrentFrame] = useState<AnimationFrame | null>(null);

  // Traversal visualization sets
  const [visited, setVisited] = useState<Set<string>>(() => new Set());
  const [visitOrder, setVisitOrder] = useState<Map<string, number>>(() => new Map());
  const [backtracked, setBacktracked] = useState<Set<string>>(() => new Set());
  const [pathCells, setPathCells] = useState<Set<string>>(() => new Set());
  const [activeCell, setActiveCell] = useState<string | null>(null);

  // Metrics & comparison records
  const [currentResult, setCurrentResult] = useState<SearchMetrics | null>(null);
  const [comparison, setComparison] = useState<Partial<Record<SearchAlgorithm, SearchMetrics>>>({});
  const [isComparisonStale, setIsComparisonStale] = useState<boolean>(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [statusAnnouncement, setStatusAnnouncement] = useState<string>('Search routing laboratory ready.');

  // Refs for pointer dragging and animation timer
  const isPointerDownRef = useRef<boolean>(false);
  const activeDragModeRef = useRef<InteractionMode | null>(null);
  const timerRef = useRef<number | null>(null);

  // Validation using Step 1 pure validation function
  const validation = useMemo(() => {
    return validateGridConfig(rows, columns, start, destination, obstacles);
  }, [rows, columns, start, destination, obstacles]);

  // Cells array for grid rendering
  const gridCells = useMemo(() => {
    return Array.from({ length: rows * columns }, (_, index) => ({
      row: Math.floor(index / columns),
      column: index % columns,
    }));
  }, [rows, columns]);

  const animationDelay = Math.max(8, 120 - speed * 11);
  const progress = frames.length ? Math.round((frameIndex / frames.length) * 100) : 0;

  // Clear visualization artifacts
  const clearVisualization = useCallback((keepNotice = false) => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
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
    if (!keepNotice) setNotice(null);
  }, []);

  // Run comparison for all four algorithms on the current grid
  const runAllComparison = useCallback(() => {
    if (!validation.valid) return;
    const nextComparison: Partial<Record<SearchAlgorithm, SearchMetrics>> = {};
    for (const algo of ALGORITHMS) {
      const beganAt = performance.now();
      const res = runGridSearch(algo, rows, columns, start, destination, obstacles);
      const executionTimeMs = performance.now() - beganAt;
      nextComparison[algo] = {
        ...res,
        executionTimeMs,
      };
    }
    setComparison(nextComparison);
    setIsComparisonStale(false);
    setStatusAnnouncement('Comparison updated for all four algorithms on the current grid layout.');
  }, [validation.valid, rows, columns, start, destination, obstacles]);

  // Initial mount: populate comparison table with real engine results
  useEffect(() => {
    if (validation.valid && Object.keys(comparison).length === 0) {
      runAllComparison();
    }
  }, [validation.valid, comparison, runAllComparison]);

  // Animation step execution with clean timer management
  useEffect(() => {
    if (playback !== 'running') {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    if (frameIndex >= frames.length) {
      setPlayback('complete');
      setActiveCell(null);
      return;
    }

    timerRef.current = window.setTimeout(() => {
      const frame = frames[frameIndex];
      const key = cellKey(frame.cell);
      setCurrentFrame(frame);
      setActiveCell(key);

      if (frame.type === 'visit') {
        setVisited(curr => (curr.has(key) ? curr : new Set(curr).add(key)));
        setVisitOrder(curr => (curr.has(key) ? curr : new Map(curr).set(key, frame.order)));
      } else if (frame.type === 'backtrack') {
        setBacktracked(curr => (curr.has(key) ? curr : new Set(curr).add(key)));
      } else if (frame.type === 'path') {
        setPathCells(curr => (curr.has(key) ? curr : new Set(curr).add(key)));
      }

      setFrameIndex(idx => idx + 1);
    }, animationDelay);

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [playback, frameIndex, frames, animationDelay]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  // Window pointerup listener to end dragging reliably even if pointer leaves grid
  useEffect(() => {
    const handleGlobalPointerUp = () => {
      isPointerDownRef.current = false;
      activeDragModeRef.current = null;
    };
    window.addEventListener('pointerup', handleGlobalPointerUp);
    return () => window.removeEventListener('pointerup', handleGlobalPointerUp);
  }, []);

  // Apply cell modifications (supports click and drag)
  const applyCellAction = useCallback(
    (cell: GridCell, targetMode: InteractionMode) => {
      if (playback === 'running' || playback === 'paused') {
        clearVisualization(true);
        setNotice({
          type: 'info',
          text: 'Simulation paused due to grid modification.',
        });
      }

      const key = cellKey(cell);

      if (targetMode === 'start') {
        if (sameCell(cell, destination)) {
          setNotice({ type: 'error', text: 'Start and destination cannot occupy the same cell.' });
          return;
        }
        if (obstacles.has(key)) {
          setNotice({ type: 'error', text: 'Cannot place start on an obstacle. Erase the wall first.' });
          return;
        }
        setStart(cell);
        setIsComparisonStale(true);
        setNotice(null);
        clearVisualization(true);
      } else if (targetMode === 'destination') {
        if (sameCell(cell, start)) {
          setNotice({ type: 'error', text: 'Start and destination cannot occupy the same cell.' });
          return;
        }
        if (obstacles.has(key)) {
          setNotice({ type: 'error', text: 'Cannot place destination on an obstacle. Erase the wall first.' });
          return;
        }
        setDestination(cell);
        setIsComparisonStale(true);
        setNotice(null);
        clearVisualization(true);
      } else if (targetMode === 'draw') {
        if (sameCell(cell, start)) {
          setNotice({ type: 'warn', text: 'Start cell cannot be converted to an obstacle.' });
          return;
        }
        if (sameCell(cell, destination)) {
          setNotice({ type: 'warn', text: 'Destination cell cannot be converted to an obstacle.' });
          return;
        }
        if (!obstacles.has(key)) {
          setObstacles(prev => new Set(prev).add(key));
          setIsComparisonStale(true);
          setNotice(null);
          clearVisualization(true);
        }
      } else if (targetMode === 'erase') {
        if (obstacles.has(key)) {
          setObstacles(prev => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
          setIsComparisonStale(true);
          setNotice(null);
          clearVisualization(true);
        }
      }
    },
    [destination, obstacles, playback, start, clearVisualization]
  );

  // Pointer interaction handlers
  const handleCellPointerDown = useCallback(
    (cell: GridCell, _e: ReactPointerEvent) => {
      isPointerDownRef.current = true;

      // Direct drag-to-move for start / destination regardless of active mode
      if (sameCell(cell, start)) {
        activeDragModeRef.current = 'start';
      } else if (sameCell(cell, destination)) {
        activeDragModeRef.current = 'destination';
      } else {
        activeDragModeRef.current = mode;
      }

      applyCellAction(cell, activeDragModeRef.current);
    },
    [destination, mode, start, applyCellAction]
  );

  const handleCellPointerEnter = useCallback(
    (cell: GridCell) => {
      if (!isPointerDownRef.current) return;
      applyCellAction(cell, activeDragModeRef.current || mode);
    },
    [mode, applyCellAction]
  );

  const handleCellKeyDown = useCallback(
    (cell: GridCell, e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        applyCellAction(cell, mode);
      }
    },
    [mode, applyCellAction]
  );

  // Switch algorithm
  const chooseAlgorithm = (option: SearchAlgorithm) => {
    if (option === algorithm) return;
    clearVisualization(false);
    setAlgorithm(option);
  };

  // Run or start the search
  const runSearch = useCallback(() => {
    if (playback === 'running') return;

    if (!validation.valid) {
      setNotice({ type: 'error', text: validation.error || 'Invalid grid configuration.' });
      return;
    }

    const currentMeta = ALGORITHM_METADATA[algorithm];
    const beganAt = performance.now();
    const result = runGridSearch(algorithm, rows, columns, start, destination, obstacles);
    const executionTimeMs = performance.now() - beganAt;
    const metrics: SearchMetrics = {
      ...result,
      executionTimeMs,
    };

    setCurrentResult(metrics);
    setComparison(current => ({ ...current, [algorithm]: metrics }));
    setNotice(null);

    const announcement = result.found
      ? `${currentMeta.name} found a path of ${result.pathLength} moves (${result.path.length} cells), visiting ${result.nodesVisited} nodes.`
      : `${currentMeta.name} visited ${result.nodesVisited} nodes; destination is unreachable.`;
    setStatusAnnouncement(announcement);

    // Instant / Reduced-Motion mode: commit all frames immediately without timer loop
    if (instantMode) {
      const visitedSet = new Set<string>();
      const orderMap = new Map<string, number>();
      const backtrackedSet = new Set<string>();
      const pathSet = new Set<string>();

      for (const step of result.steps) {
        const k = cellKey(step.cell);
        if (step.type === 'visit') {
          visitedSet.add(k);
          if (!orderMap.has(k)) orderMap.set(k, step.order);
        } else if (step.type === 'backtrack') {
          backtrackedSet.add(k);
        }
      }
      for (const cell of result.path) {
        pathSet.add(cellKey(cell));
      }

      setVisited(visitedSet);
      setVisitOrder(orderMap);
      setBacktracked(backtrackedSet);
      setPathCells(pathSet);
      setActiveCell(null);
      setFrames(createFrames(result));
      setFrameIndex(result.steps.length + result.path.length);
      setCurrentFrame(null);
      setPlayback('complete');
      return;
    }

    // Step-by-step playback mode
    setFrames(createFrames(result));
    setFrameIndex(0);
    setCurrentFrame(null);
    setVisited(new Set());
    setVisitOrder(new Map());
    setBacktracked(new Set());
    setPathCells(new Set());
    setActiveCell(null);
    setPlayback('running');
  }, [algorithm, destination, instantMode, obstacles, rows, columns, start, validation]);

  // Run and animate a specific algorithm directly from the comparison table
  const animateAlgorithm = useCallback(
    (targetAlgo: SearchAlgorithm) => {
      if (playback === 'running') return;
      if (!validation.valid) {
        setNotice({ type: 'error', text: validation.error || 'Invalid grid configuration.' });
        return;
      }

      setAlgorithm(targetAlgo);
      const targetMeta = ALGORITHM_METADATA[targetAlgo];
      const beganAt = performance.now();
      const result = runGridSearch(targetAlgo, rows, columns, start, destination, obstacles);
      const executionTimeMs = performance.now() - beganAt;
      const metrics: SearchMetrics = {
        ...result,
        executionTimeMs,
      };

      setCurrentResult(metrics);
      setComparison(current => ({ ...current, [targetAlgo]: metrics }));
      setNotice(null);

      const announcement = result.found
        ? `${targetMeta.name} found a path of ${result.pathLength} moves, visiting ${result.nodesVisited} nodes.`
        : `${targetMeta.name} visited ${result.nodesVisited} nodes; destination is unreachable.`;
      setStatusAnnouncement(announcement);

      if (instantMode) {
        const visitedSet = new Set<string>();
        const orderMap = new Map<string, number>();
        const backtrackedSet = new Set<string>();
        const pathSet = new Set<string>();

        for (const step of result.steps) {
          const k = cellKey(step.cell);
          if (step.type === 'visit') {
            visitedSet.add(k);
            if (!orderMap.has(k)) orderMap.set(k, step.order);
          } else if (step.type === 'backtrack') {
            backtrackedSet.add(k);
          }
        }
        for (const cell of result.path) {
          pathSet.add(cellKey(cell));
        }

        setVisited(visitedSet);
        setVisitOrder(orderMap);
        setBacktracked(backtrackedSet);
        setPathCells(pathSet);
        setActiveCell(null);
        setFrames(createFrames(result));
        setFrameIndex(result.steps.length + result.path.length);
        setCurrentFrame(null);
        setPlayback('complete');
        return;
      }

      setFrames(createFrames(result));
      setFrameIndex(0);
      setCurrentFrame(null);
      setVisited(new Set());
      setVisitOrder(new Map());
      setBacktracked(new Set());
      setPathCells(new Set());
      setActiveCell(null);
      setPlayback('running');
    },
    [destination, instantMode, obstacles, playback, rows, columns, start, validation]
  );

  // Pause simulation
  const pauseSearch = () => {
    if (playback === 'running') {
      setPlayback('paused');
    }
  };

  // Resume simulation
  const resumeSearch = () => {
    if (playback === 'paused') {
      setPlayback('running');
    }
  };

  // Reset exploration (preserves walls and start/goal)
  const resetExploration = () => {
    clearVisualization(true);
    setNotice({
      type: 'info',
      text: 'Exploration cleared. Walls and endpoints are preserved.',
    });
  };

  // Replay last completed run identically
  const replaySearch = () => {
    if (playback !== 'complete' || frames.length === 0) return;
    setVisited(new Set());
    setVisitOrder(new Map());
    setBacktracked(new Set());
    setPathCells(new Set());
    setActiveCell(null);
    setFrameIndex(0);
    setCurrentFrame(null);
    setPlayback('running');
  };

  // Clear all walls
  const clearObstacles = () => {
    if (obstacles.size === 0) return;
    clearVisualization(true);
    setObstacles(new Set());
    setIsComparisonStale(true);
    setNotice({
      type: 'info',
      text: 'All obstacles cleared. Click "Re-run comparison" to update benchmark.',
    });
  };

  // Reset entire grid to defaults
  const resetEntireGrid = () => {
    clearVisualization(true);
    setStart({ row: 1, column: 1 });
    setDestination({ row: rows - 2, column: columns - 2 });
    setObstacles(new Set());
    setIsComparisonStale(true);
    setNotice({
      type: 'info',
      text: 'Grid reset to default endpoints and clear terrain.',
    });
  };

  // Random obstacles generator (guarantees start and goal remain unblocked)
  const generateRandomObstacles = () => {
    clearVisualization(true);
    const next = new Set<string>();
    const totalCells = rows * columns;
    const targetCount = Math.floor(totalCells * 0.25); // ~25% density

    while (next.size < targetCount) {
      const r = Math.floor(Math.random() * rows);
      const c = Math.floor(Math.random() * columns);
      const candidate = { row: r, column: c };

      // GUARANTEE: Never place obstacle on start or destination
      if (sameCell(candidate, start) || sameCell(candidate, destination)) {
        continue;
      }
      next.add(cellKey(candidate));
    }

    setObstacles(next);
    setIsComparisonStale(true);
    setNotice({
      type: 'success',
      text: `Generated random obstacle layout (${next.size} walls). Start and destination remain unblocked.`,
    });
  };

  // Grid dimensions preset switch
  const handleDimensionChange = (newRows: number, newCols: number) => {
    clearVisualization(true);
    setRows(newRows);
    setColumns(newCols);

    // Clamp start and destination inside new bounds if needed
    setStart(curr => ({
      row: Math.min(curr.row, newRows - 1),
      column: Math.min(curr.column, newCols - 1),
    }));

    setDestination(curr => {
      const clampedRow = Math.min(curr.row, newRows - 1);
      const clampedCol = Math.min(curr.column, newCols - 1);
      if (clampedRow === Math.min(start.row, newRows - 1) && clampedCol === Math.min(start.column, newCols - 1)) {
        return { row: Math.max(0, clampedRow - 1), column: clampedCol };
      }
      return { row: clampedRow, column: clampedCol };
    });

    // Remove any obstacles outside the new boundary
    setObstacles(prev => {
      const next = new Set<string>();
      for (const k of prev) {
        const [r, c] = k.split(',').map(Number);
        if (r < newRows && c < newCols) {
          next.add(k);
        }
      }
      return next;
    });

    setIsComparisonStale(true);
    setNotice({
      type: 'info',
      text: `Grid resized to ${newRows} × ${newCols} cells.`,
    });
  };

  const meta = ALGORITHM_METADATA[algorithm];

  // Dynamic live step label
  const currentStepLabel = currentFrame
    ? currentFrame.type === 'visit'
      ? `${meta.name} explores ${cellLabel(currentFrame.cell)} at depth ${currentFrame.depth}; visit order ${currentFrame.order}${
          currentFrame.g !== undefined && currentFrame.h !== undefined
            ? ` · g=${currentFrame.g}, h=${currentFrame.h}${currentFrame.f !== undefined ? `, f=${currentFrame.f}` : ''}`
            : ''
        }.`
      : currentFrame.type === 'backtrack'
      ? `DFS backtracks from ${cellLabel(currentFrame.cell)} after exhausting available neighbours.`
      : `Path reconstruction: cell ${currentFrame.order} of ${currentResult?.path.length ?? 0} at ${cellLabel(currentFrame.cell)}.`
    : playback === 'complete' && currentResult
    ? currentResult.found
      ? `${meta.name} found a path of ${currentResult.pathLength} moves (${currentResult.path.length} cells), visiting ${currentResult.nodesVisited} nodes.`
      : `${meta.name} explored all ${currentResult.nodesVisited} reachable nodes; destination is unreachable.`
    : !validation.valid
    ? validation.error || 'Please correct the grid configuration before starting.'
    : 'Select an algorithm, position endpoints, and click Run to begin traversal.';

  // Column best calculations among executed algorithms in comparison table
  const completedComparisonList = useMemo(() => {
    return Object.values(comparison).filter((r): r is SearchMetrics => Boolean(r));
  }, [comparison]);

  const bestVisitedCount = useMemo(() => {
    if (completedComparisonList.length <= 1) return null;
    return Math.min(...completedComparisonList.map(r => r.visitedCount));
  }, [completedComparisonList]);

  const bestPathLength = useMemo(() => {
    const foundRuns = completedComparisonList.filter(r => r.found);
    if (foundRuns.length <= 1) return null;
    return Math.min(...foundRuns.map(r => r.pathLength));
  }, [completedComparisonList]);

  const bestExecutionTime = useMemo(() => {
    if (completedComparisonList.length <= 1) return null;
    return Math.min(...completedComparisonList.map(r => r.executionTimeMs));
  }, [completedComparisonList]);

  // One-line dynamic comparative takeaway banner
  const comparativeTakeaway = useMemo(() => {
    const bfs = comparison['BFS'];
    const dfs = comparison['DFS'];
    const greedy = comparison['GREEDY'];
    const aStar = comparison['A_STAR'];

    if (!bfs && !dfs && !greedy && !aStar) {
      return 'Click "Run comparison (all 4)" to benchmark BFS, DFS, Greedy Best-First, and A* on this exact grid layout.';
    }

    if (bfs && aStar && !bfs.found && !aStar.found) {
      return 'Destination unreachable: all algorithms exhausted all reachable grid cells and verified that no path exists.';
    }

    const sentences: string[] = [];

    if (bfs && aStar && bfs.found && aStar.found) {
      if (bfs.pathLength === aStar.pathLength) {
        if (aStar.visitedCount < bfs.visitedCount) {
          sentences.push(
            `BFS and A* both find the optimal ${bfs.pathLength}-move path, but A* visits fewer nodes (${aStar.visitedCount} vs ${bfs.visitedCount}) by focusing exploration with the Manhattan distance heuristic.`
          );
        } else if (aStar.visitedCount === bfs.visitedCount) {
          sentences.push(
            `BFS and A* both find the optimal ${bfs.pathLength}-move path with identical node visits (${bfs.visitedCount}), as obstacle constraints left no alternative branches to prune.`
          );
        } else {
          sentences.push(
            `BFS and A* both guarantee the optimal ${bfs.pathLength}-move path (${bfs.visitedCount} BFS visits vs ${aStar.visitedCount} A* visits).`
          );
        }
      }
    }

    if (greedy && greedy.found && bfs && bfs.found) {
      if (greedy.pathLength > bfs.pathLength) {
        sentences.push(
          `Greedy Best-First reached the destination visiting ${greedy.visitedCount} nodes, but took a suboptimal ${greedy.pathLength}-move detour (+${greedy.pathLength - bfs.pathLength} moves) because it ignores accumulated path cost g(n).`
        );
      } else {
        sentences.push(
          `Greedy Best-First quickly reached the goal in ${greedy.pathLength} moves by aggressively following the heuristic.`
        );
      }
    }

    if (dfs && dfs.found && bfs && bfs.found && dfs.pathLength > bfs.pathLength) {
      sentences.push(
        `DFS plunged deep along its first unvisited branch without an optimality guarantee, producing a circuitous ${dfs.pathLength}-move route (${dfs.visitedCount} nodes visited).`
      );
    }

    return sentences.join(' ') || 'All algorithms completed traversal on the current layout.';
  }, [comparison]);

  return (
    <>
      {/* Screen reader live announcement region */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {statusAnnouncement}
      </div>

      <div className="page-heading search-page-heading">
        <div>
          <div className="eyebrow"><span /> ALGORITHM LAB · SIMULATION</div>
          <h1>Search &amp; Routing</h1>
          <p>Compare uninformed and heuristic search algorithms on an interactive disaster-response grid.</p>
        </div>
        <span className="search-simulation-badge"><ShieldCheck size={14} /> SIMULATION · NOT A LIVE MAP</span>
      </div>

      {/* Usage hint banner */}
      <div className="search-usage-hint" role="note" aria-label="Quick instructions">
        <MousePointer2 size={15} style={{ flexShrink: 0, color: '#0284c7' }} />
        <span>
          <strong>Quick start:</strong> Click or drag across the grid to draw walls or reposition Start and Destination. Pick an algorithm, then click <strong>Run</strong> to watch step-by-step traversal or compare all four algorithms below.
        </span>
      </div>

      <section className="search-intro" aria-label="Simulation disclaimer">
        <Info size={17} />
        <p>This interactive grid is an educational simulation. Endpoints, walls, and paths do not represent real-world locations, roads, or emergency dispatch routing.</p>
      </section>

      <section className="search-workspace" aria-label="Grid search workspace">
        {/* Left Column: Grid, Tools, Canvas, Coordinates, Legend */}
        <div className="search-map-card">
          <div className="search-card-heading">
            <div>
              <span className="search-kicker">INTERACTIVE GRID</span>
              <h2>Simulated affected area</h2>
              <p>
                {rows} × {columns} cells · Orthogonal moves (Up, Right, Down, Left) · Unit move cost
              </p>
            </div>
            <span className="search-grid-count"><Layers3 size={14} /> {obstacles.size} obstacles</span>
          </div>

          {/* Grid Editing & Mode Toolbar */}
          <div className="search-map-toolbar">
            <div className="search-mode-buttons" role="group" aria-label="Grid editing mode">
              <button
                type="button"
                className={mode === 'start' ? 'is-selected' : ''}
                aria-pressed={mode === 'start'}
                onClick={() => setMode('start')}
                title="Click or drag to place Start position"
              >
                <MapPin size={14} /> Place start
              </button>
              <button
                type="button"
                className={mode === 'destination' ? 'is-selected' : ''}
                aria-pressed={mode === 'destination'}
                onClick={() => setMode('destination')}
                title="Click or drag to place Destination position"
              >
                <Flag size={14} /> Place destination
              </button>
              <button
                type="button"
                className={mode === 'draw' ? 'is-selected' : ''}
                aria-pressed={mode === 'draw'}
                onClick={() => setMode('draw')}
                title="Click or drag across cells to draw walls"
              >
                <Paintbrush size={14} /> Draw walls
              </button>
              <button
                type="button"
                className={mode === 'erase' ? 'is-selected' : ''}
                aria-pressed={mode === 'erase'}
                onClick={() => setMode('erase')}
                title="Click or drag across walls to erase them"
              >
                <Trash2 size={14} /> Erase walls
              </button>
            </div>

            {/* Utility actions */}
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="search-clear-button"
                onClick={generateRandomObstacles}
                disabled={playback === 'running'}
                title="Generate random obstacles (guarantees start and goal stay unblocked)"
              >
                <Dices size={14} /> Random walls
              </button>
              <button
                type="button"
                className="search-clear-button"
                onClick={clearObstacles}
                disabled={obstacles.size === 0 || playback === 'running'}
                title="Remove all obstacle walls"
              >
                <Trash2 size={14} /> Clear walls
              </button>
              <button
                type="button"
                className="search-clear-button"
                onClick={resetEntireGrid}
                disabled={playback === 'running'}
                title="Reset grid to default endpoints and clear obstacles"
              >
                <RotateCcw size={14} /> Reset grid
              </button>
            </div>
          </div>

          {/* Grid Size Preset Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '9px', fontWeight: 700, color: '#7c8e9b' }}>GRID SIZE:</span>
            {GRID_SIZE_PRESETS.map(preset => (
              <button
                key={preset.label}
                type="button"
                className={`search-algorithm-link${rows === preset.rows && columns === preset.cols ? ' is-active' : ''}`}
                onClick={() => handleDimensionChange(preset.rows, preset.cols)}
                disabled={playback === 'running' || playback === 'paused'}
                style={{ minHeight: 24, fontSize: '8.5px' }}
                aria-label={`Set grid dimensions to ${preset.label}`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Grid Canvas Frame with Pointer Support */}
          <div className="search-map-frame">
            <div
              className="search-grid"
              role="grid"
              aria-label="Simulated disaster area grid"
              style={{
                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
              }}
            >
              {gridCells.map(cell => {
                const key = cellKey(cell);
                return (
                  <GridCellButton
                    key={key}
                    cell={cell}
                    isStart={sameCell(cell, start)}
                    isDestination={sameCell(cell, destination)}
                    isObstacle={obstacles.has(key)}
                    isVisited={visited.has(key)}
                    isBacktracked={backtracked.has(key)}
                    isPath={pathCells.has(key)}
                    isActive={activeCell === key}
                    order={visitOrder.get(key)}
                    onPointerDown={handleCellPointerDown}
                    onPointerEnter={handleCellPointerEnter}
                    onKeyDown={handleCellKeyDown}
                  />
                );
              })}
            </div>
          </div>

          {/* Accessible Legend with Shapes, Colors, and Patterns */}
          <div className="search-map-legend" aria-label="Map legend">
            <span><i className="legend-start">S</i> Start</span>
            <span><i className="legend-destination">D</i> Destination</span>
            <span><i className="legend-obstacle" /> Wall (Obstacle)</span>
            <span><i className="legend-visited" /> Visited</span>
            <span><i className="legend-backtracked" /> Backtracked (DFS)</span>
            <span><i className="legend-path">●</i> Final path</span>
          </div>

          {/* Coordinates Bar */}
          <div className="search-map-coordinates">
            <span><MapPin size={13} /> Start: {cellLabel(start)}</span>
            <span><Target size={13} /> Destination: {cellLabel(destination)}</span>
            <span><Layers3 size={13} /> Grid: {rows} × {columns}</span>
          </div>

          {/* Inline Notice / Error Banner */}
          {notice && (
            <div className={`search-notice notice-${notice.type}`} role="status">
              {notice.type === 'error' ? (
                <AlertTriangle size={14} />
              ) : notice.type === 'success' ? (
                <CheckCircle2 size={14} />
              ) : (
                <Info size={14} />
              )}
              <span>{notice.text}</span>
            </div>
          )}

          {/* Validation Error Banner (Step 1 pure validation) */}
          {!validation.valid && (
            <div className="search-notice notice-error" role="alert">
              <AlertTriangle size={14} />
              <span><strong>Invalid configuration:</strong> {validation.errors.join(' ')}</span>
            </div>
          )}

          {/* Unreachable Goal Alert Banner */}
          {playback === 'complete' && currentResult && !currentResult.found && (
            <div className="search-unreachable-banner" role="alert">
              <AlertTriangle size={17} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <strong>No path exists between start and destination</strong>
                <p>
                  The algorithm explored all reachable cells ({currentResult.visitedCount} nodes), but the destination is completely blocked or enclosed by obstacle walls. The explored area remains highlighted above.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Controls, Algorithm Picker, Metrics, Info Panel */}
        <aside className="search-control-card" aria-labelledby="search-controls-title">
          <div className="search-card-heading">
            <div>
              <span className="search-kicker">TRAVERSAL CONTROLS</span>
              <h2 id="search-controls-title">Algorithm selection</h2>
            </div>
          </div>

          {/* Algorithm Picker */}
          <div className="search-algorithm-picker" role="group" aria-label="Search algorithm selection">
            {ALGORITHMS.map(option => (
              <button
                type="button"
                key={option}
                className={algorithm === option ? 'is-selected' : ''}
                aria-pressed={algorithm === option}
                disabled={playback === 'running'}
                onClick={() => chooseAlgorithm(option)}
              >
                <span>{ALGORITHM_METADATA[option].name}</span>
                <small>{ALGORITHM_METADATA[option].description}</small>
              </button>
            ))}
          </div>

          {/* Playback Action Buttons */}
          <div className="search-playback-controls">
            {/* Start / Run button */}
            <button
              type="button"
              className="primary-button search-start-button"
              onClick={runSearch}
              disabled={!validation.valid || playback === 'running'}
              title={!validation.valid ? validation.error : `Run ${meta.name} on the current grid`}
            >
              <Play size={15} /> Run {meta.name}
            </button>

            {/* Pause button (running only) */}
            {playback === 'running' && (
              <button type="button" className="secondary-button" onClick={pauseSearch} aria-label="Pause animation">
                <Pause size={15} /> Pause
              </button>
            )}

            {/* Resume button (paused only) */}
            {playback === 'paused' && (
              <button type="button" className="secondary-button" onClick={resumeSearch} aria-label="Resume animation">
                <Play size={15} /> Resume
              </button>
            )}

            {/* Replay button (completed run only) */}
            {playback === 'complete' && (
              <button type="button" className="secondary-button" onClick={replaySearch} aria-label="Replay animation identically">
                <RotateCcw size={15} /> Replay
              </button>
            )}

            {/* Reset button (available anytime) */}
            <button
              type="button"
              className="secondary-button"
              onClick={resetExploration}
              disabled={playback === 'idle' && visited.size === 0}
              title="Clear exploration and reset search without removing walls"
              aria-label="Clear exploration without removing walls"
            >
              <RotateCcw size={15} /> Reset
            </button>
          </div>

          {/* Animation Speed Slider & Instant Simulation Toggle */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
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
                disabled={instantMode}
                onChange={event => setSpeed(Number(event.currentTarget.value))}
              />
              <small>Slow <span>Live adjustable</span> Fast</small>
            </label>

            {/* Reduced motion / Instant mode toggle */}
            <label className="search-instant-toggle" htmlFor="search-instant-mode">
              <input
                id="search-instant-mode"
                type="checkbox"
                checked={instantMode}
                onChange={e => setInstantMode(e.target.checked)}
              />
              <span>Instant simulation (skip animation / reduced-motion)</span>
            </label>
          </div>

          {/* Live Playback Status & Progress */}
          <div className={`search-playback-status status-${playback}`}>
            <span className="search-status-dot" />
            <strong>
              {playback === 'running'
                ? 'Exploring grid…'
                : playback === 'paused'
                ? 'Paused'
                : playback === 'complete'
                ? currentResult?.found
                  ? 'Path found'
                  : 'Destination unreachable'
                : 'Ready'}
            </strong>
            {playback !== 'idle' && <span>{progress}%</span>}
          </div>

          {playback !== 'idle' && (
            <div className="search-progress" aria-label={`Animation progress ${progress}%`}>
              <span style={{ width: `${progress}%` }} />
            </div>
          )}

          {/* Live Metric Row: Visited, Path Length, Execution Time */}
          <div className="search-live-metric-row">
            <div className="search-live-metric">
              <span>Nodes visited</span>
              <strong>{visited.size}</strong>
            </div>
            <div className="search-live-metric">
              <span>Path length</span>
              <strong title="Number of orthogonal moves from start to destination">
                {pathCells.size > 0
                  ? `${pathCells.size - 1} moves (${pathCells.size} cells)`
                  : currentResult?.found && playback === 'complete'
                  ? `${currentResult.pathLength} moves (${currentResult.path.length} cells)`
                  : '—'}
              </strong>
            </div>
            <div className="search-live-metric">
              <span>Execution</span>
              <strong>
                {currentResult ? formatExecutionTime(currentResult.executionTimeMs) : '—'}
              </strong>
            </div>
          </div>

          {/* Info Panel: Algorithm Explanation & Optimality Guarantee */}
          <div style={{ marginTop: 12, padding: '10px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #edf1f4' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
              <strong style={{ fontSize: '10px', color: '#334960' }}>{meta.fullName}</strong>
              <span className={`search-optimality-badge ${meta.optimal ? 'is-optimal' : 'is-not-optimal'}`}>
                {meta.optimal ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
                {meta.optimal ? 'Shortest path guaranteed' : 'NOT guaranteed shortest'}
              </span>
            </div>
            <p style={{ margin: '6px 0 0', fontSize: '8.5px', color: '#688094', lineHeight: 1.5 }}>
              {meta.shortExplanation}
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 7, fontSize: '8px', color: '#7a8e9e' }}>
              <span>Data structure: <strong>{meta.dataStructure}</strong></span>
              {meta.usesHeuristic && (
                <span>Heuristic: <strong>{meta.heuristicName}</strong></span>
              )}
            </div>
          </div>

          {/* Step-by-Step Ticker */}
          <div className="search-live-step" aria-live="polite">
            <span className="search-live-step-icon"><Clock3 size={15} /></span>
            <p>{currentStepLabel}</p>
          </div>
        </aside>
      </section>

      {/* Comparison Section: Side-by-side summary table for all four algorithms */}
      <section className="search-results-section" aria-labelledby="search-results-title">
        <div className="search-section-heading">
          <div>
            <span className="search-kicker">SAME GRID · REAL MEASUREMENTS</span>
            <h2 id="search-results-title">Algorithm comparison</h2>
            <p>
              Compare real algorithm measurements on this exact grid layout. Results update dynamically or mark stale when walls are modified.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {isComparisonStale && (
              <span className="search-stale-badge" title="Obstacles or endpoints changed since last run">
                <AlertTriangle size={12} /> Grid modified · Benchmark stale
              </span>
            )}
            <button
              type="button"
              className="primary-button"
              onClick={runAllComparison}
              disabled={playback === 'running' || !validation.valid}
              title="Execute all four search algorithms synchronously on the current grid"
              style={{ minHeight: 28, fontSize: '8.5px' }}
            >
              <RefreshCw size={13} /> {isComparisonStale ? 'Re-run comparison' : 'Run comparison (all 4)'}
            </button>
          </div>
        </div>

        {/* Dynamic Comparative Takeaway Banner */}
        <div className="comparison-takeaway-card" role="region" aria-label="Comparative Takeaway">
          <Info size={17} style={{ flexShrink: 0, marginTop: 1, color: '#0f766e' }} />
          <div>
            <strong>Comparative takeaway</strong>
            <p>{comparativeTakeaway}</p>
          </div>
        </div>

        <div className="search-table-wrap" style={{ marginTop: 12 }}>
          <table className="search-comparison-table">
            <thead>
              <tr>
                <th scope="col">Algorithm</th>
                <th scope="col">Nodes visited</th>
                <th scope="col">Path length (moves)</th>
                <th scope="col">Path found</th>
                <th scope="col">Execution time</th>
                <th scope="col">Optimality guarantee</th>
                <th scope="col">Time complexity</th>
                <th scope="col">Space complexity</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {ALGORITHMS.map(option => {
                const result = comparison[option];
                const optionMeta = ALGORITHM_METADATA[option];
                const isBestVisited = result && bestVisitedCount !== null && result.visitedCount === bestVisitedCount;
                const isBestPath = result?.found && bestPathLength !== null && result.pathLength === bestPathLength;
                const isBestTime = result && bestExecutionTime !== null && result.executionTimeMs === bestExecutionTime;

                return (
                  <tr key={option}>
                    <th scope="row">
                      <button
                        type="button"
                        className={`search-algorithm-link${algorithm === option ? ' is-active' : ''}`}
                        onClick={() => {
                          if (playback !== 'running') chooseAlgorithm(option);
                        }}
                        disabled={playback === 'running'}
                        title={`Select ${optionMeta.name}`}
                      >
                        {optionMeta.name}
                      </button>
                    </th>
                    <td>
                      {result ? (
                        <span className={isBestVisited ? 'comparison-best' : ''}>
                          {result.visitedCount}
                          {isBestVisited && <span className="best-pill">Fewest</span>}
                        </span>
                      ) : (
                        'Not run'
                      )}
                    </td>
                    <td>
                      {result?.found ? (
                        <span className={isBestPath ? 'comparison-best' : ''}>
                          {result.pathLength} moves ({result.path.length} cells)
                          {isBestPath && <span className="best-pill">Shortest</span>}
                        </span>
                      ) : result ? (
                        '—'
                      ) : (
                        'Not run'
                      )}
                    </td>
                    <td>
                      {result ? (
                        <span style={{ color: result.found ? '#047857' : '#b45309', fontWeight: 600 }}>
                          {result.found ? 'Yes' : 'No'}
                        </span>
                      ) : (
                        'Not run'
                      )}
                    </td>
                    <td>
                      {result ? (
                        <span className={isBestTime ? 'comparison-best' : ''}>
                          {formatExecutionTime(result.executionTimeMs)}
                          {isBestTime && <span className="best-pill">Fastest</span>}
                        </span>
                      ) : (
                        'Not run'
                      )}
                    </td>
                    <td>
                      <span className={`search-optimality-badge ${optionMeta.optimal ? 'is-optimal' : 'is-not-optimal'}`}>
                        {optionMeta.optimal ? <CheckCircle2 size={10} /> : <AlertTriangle size={10} />}
                        {optionMeta.optimalityGuarantee}
                      </span>
                    </td>
                    <td>{optionMeta.timeComplexity}</td>
                    <td>{optionMeta.spaceComplexity}</td>
                    <td>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => animateAlgorithm(option)}
                        disabled={playback === 'running' || !validation.valid}
                        title={`Animate ${optionMeta.name} step-by-step on this grid`}
                        style={{ minHeight: 24, fontSize: '8px', padding: '0 8px' }}
                      >
                        <Play size={11} /> Animate
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="search-comparison-note">
          Path length is measured in orthogonal moves (steps) required to travel from start to destination; total cells traversed along the route equals moves + 1. Execution time measures pure synchronous search computation without animation delays. V is the total number of grid cells and E is the number of valid orthogonal edges.
        </p>
      </section>

      {/* Learning Section: Algorithm deep-dive cards */}
      <section className="search-learning-section" aria-labelledby="search-learning-title">
        <div className="search-section-heading">
          <div>
            <span className="search-kicker">LEARN BY OBSERVING</span>
            <h2 id="search-learning-title">How the searches work</h2>
            <p>Follow the highlighted cells and step description as each algorithm explores this grid.</p>
          </div>
        </div>

        <div className="search-learning-grid">
          {ALGORITHMS.map(algoKey => {
            const m = ALGORITHM_METADATA[algoKey];
            const isSelected = algorithm === algoKey;
            return (
              <article key={algoKey} className={`search-learning-card${isSelected ? ' is-selected' : ''}`}>
                <span className="search-learning-icon">
                  {algoKey === 'BFS' ? (
                    <Layers3 size={17} />
                  ) : algoKey === 'DFS' ? (
                    <RouteIcon size={17} />
                  ) : algoKey === 'GREEDY' ? (
                    <Target size={17} />
                  ) : (
                    <Activity size={17} />
                  )}
                </span>
                <h3>{m.fullName}</h3>
                <p>{m.shortExplanation}</p>
                <dl>
                  <div><dt>Data structure</dt><dd>{m.dataStructure}</dd></div>
                  <div><dt>Completeness</dt><dd>{m.completeness}</dd></div>
                  <div><dt>Optimality</dt><dd>{m.optimalityGuarantee}</dd></div>
                  <div><dt>Complexity</dt><dd>Time {m.timeComplexity} · Space {m.spaceComplexity}</dd></div>
                </dl>
              </article>
            );
          })}
        </div>

        {/* Heuristics Explanatory Panel */}
        <article className="search-heuristic-panel" style={{ marginTop: 15 }}>
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
            Greedy ranks by h(n) alone, so it can choose a promising-looking detour. A* also counts the cost already paid g(n).
            Manhattan distance never overestimates the remaining unit-cost path and is consistent across each grid edge;
            therefore, when A* removes the destination from its priority queue, its route is guaranteed shortest. A heuristic
            focuses exploration toward plausible routes, but does not guarantee fewer expansions on every grid.
          </p>
          <div className="search-tie-note">
            Deterministic ties: neighbours are considered Up, Right, Down, Left; equal queue priorities preserve insertion order. A* then breaks equal f(n) ties by lower h(n).
          </div>
        </article>
      </section>

      <div className="search-safety-note">
        <ShieldCheck size={16} />
        <span>Educational demonstration only. This module does not query live roads, incidents, emergency services, or the backend routing API.</span>
      </div>
    </>
  );
}

export default SearchRoutingPage;
