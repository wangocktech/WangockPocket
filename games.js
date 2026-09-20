export const SNAKE_SIZE = 12;
export const TETRIS_WIDTH = 10;
export const TETRIS_HEIGHT = 16;

const directions = {
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};
const opposite = { up: 'down', down: 'up', left: 'right', right: 'left' };
const tetrominoes = {
  I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
  O: [[0, 1, 1, 0], [0, 1, 1, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
  T: [[0, 1, 0, 0], [1, 1, 1, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
  S: [[0, 1, 1, 0], [1, 1, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
  Z: [[1, 1, 0, 0], [0, 1, 1, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
  J: [[1, 0, 0, 0], [1, 1, 1, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
  L: [[0, 0, 1, 0], [1, 1, 1, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
};
const tetrominoNames = Object.keys(tetrominoes);

const copyShape = shape => shape.map(row => [...row]);
const randomPiece = random => tetrominoNames[Math.floor(random() * tetrominoNames.length)] ?? 'T';
const makePiece = name => ({ name, shape: copyShape(tetrominoes[name] ?? tetrominoes.T), x: 3, y: 0, rotation: 0 });
const coordinate = ({ x, y }) => `${x}:${y}`;

function nextFood(body, random) {
  const occupied = new Set(body.map(coordinate));
  const available = [];
  for (let y = 0; y < SNAKE_SIZE; y++) {
    for (let x = 0; x < SNAKE_SIZE; x++) {
      if (!occupied.has(`${x}:${y}`)) available.push({ x, y });
    }
  }
  return available[Math.floor(random() * available.length)] ?? null;
}

export function createSnake(random = Math.random) {
  const body = [{ x: 6, y: 6 }, { x: 5, y: 6 }, { x: 4, y: 6 }];
  return { kind: 'snake', body, direction: 'right', queuedDirection: 'right', food: nextFood(body, random), score: 0, status: 'ready' };
}

function tickSnake(game, random) {
  if (game.status !== 'playing') return game;
  const direction = game.queuedDirection;
  const vector = directions[direction];
  const head = game.body[0];
  const nextHead = { x: head.x + vector.x, y: head.y + vector.y };
  const hitsWall = nextHead.x < 0 || nextHead.x >= SNAKE_SIZE || nextHead.y < 0 || nextHead.y >= SNAKE_SIZE;
  const hitsBody = game.body.slice(0, -1).some(part => part.x === nextHead.x && part.y === nextHead.y);
  if (hitsWall || hitsBody) return { ...game, direction, status: 'gameover' };
  const ate = game.food && nextHead.x === game.food.x && nextHead.y === game.food.y;
  const body = [nextHead, ...game.body];
  if (!ate) body.pop();
  const food = ate ? nextFood(body, random) : game.food;
  return {
    ...game,
    body,
    direction,
    food,
    score: ate ? game.score + 10 : game.score,
    status: ate && !food ? 'won' : 'playing',
  };
}

function occupiedCells(piece) {
  const cells = [];
  piece.shape.forEach((row, y) => row.forEach((filled, x) => {
    if (filled) cells.push({ x: piece.x + x, y: piece.y + y, name: piece.name });
  }));
  return cells;
}

export function getTetrisCells(piece) {
  return occupiedCells(piece);
}

export function getTetrominoCells(name) {
  return occupiedCells({ name, shape: copyShape(tetrominoes[name] ?? tetrominoes.T), x: 0, y: 0 });
}

function canPlace(board, piece) {
  return occupiedCells(piece).every(({ x, y }) => x >= 0 && x < TETRIS_WIDTH && y < TETRIS_HEIGHT && (y < 0 || !board[y * TETRIS_WIDTH + x]));
}

function rotate(shape) {
  return shape[0].map((_, column) => shape.map(row => row[column]).reverse());
}

function lockTetrisPiece(game, random) {
  const board = [...game.board];
  for (const { x, y, name } of occupiedCells(game.piece)) {
    if (y >= 0 && y < TETRIS_HEIGHT) board[y * TETRIS_WIDTH + x] = name;
  }
  const rows = [];
  let cleared = 0;
  for (let y = 0; y < TETRIS_HEIGHT; y++) {
    const row = board.slice(y * TETRIS_WIDTH, (y + 1) * TETRIS_WIDTH);
    if (row.every(Boolean)) cleared++;
    else rows.push(row);
  }
  while (rows.length < TETRIS_HEIGHT) rows.unshift(Array(TETRIS_WIDTH).fill(''));
  const piece = makePiece(game.next);
  const next = randomPiece(random);
  const lines = game.lines + cleared;
  const score = game.score + [0, 100, 300, 500, 800][cleared] * (Math.floor(lines / 10) + 1);
  const updated = { ...game, board: rows.flat(), piece, next, lines, score };
  return canPlace(updated.board, piece) ? updated : { ...updated, status: 'gameover' };
}

export function createTetris(random = Math.random) {
  const first = randomPiece(random);
  return {
    kind: 'tetris',
    board: Array(TETRIS_WIDTH * TETRIS_HEIGHT).fill(''),
    piece: makePiece(first),
    next: randomPiece(random),
    score: 0,
    lines: 0,
    status: 'ready',
  };
}

function tickTetris(game, random) {
  if (game.status !== 'playing') return game;
  const piece = { ...game.piece, y: game.piece.y + 1 };
  return canPlace(game.board, piece) ? { ...game, piece } : lockTetrisPiece(game, random);
}

function moveTetris(game, delta) {
  const piece = { ...game.piece, x: game.piece.x + delta };
  return canPlace(game.board, piece) ? { ...game, piece } : game;
}

function rotateTetris(game) {
  const shape = game.piece.name === 'O' ? game.piece.shape : rotate(game.piece.shape);
  for (const offset of [0, -1, 1, -2, 2]) {
    const piece = { ...game.piece, shape, x: game.piece.x + offset, rotation: (game.piece.rotation + 1) % 4 };
    if (canPlace(game.board, piece)) return { ...game, piece };
  }
  return game;
}

function togglePause(game) {
  if (game.status === 'playing') return { ...game, status: 'paused' };
  if (game.status === 'paused') return { ...game, status: 'playing' };
  return game;
}

export function tickGame(game, random = Math.random) {
  if (game?.kind === 'snake') return tickSnake(game, random);
  if (game?.kind === 'tetris') return tickTetris(game, random);
  return game;
}

export function applyGameAction(game, action, random = Math.random) {
  if (!game) return { game, changed: false, effect: null };
  if (game.status === 'gameover' || game.status === 'won') {
    if (action === 'confirm' || action === 'start') {
      const fresh = game.kind === 'snake' ? createSnake(random) : createTetris(random);
      return { game: { ...fresh, status: 'playing' }, changed: true, effect: 'confirm' };
    }
    return { game, changed: false, effect: null };
  }
  if (game.status === 'ready' && (action === 'confirm' || action === 'start')) return { game: { ...game, status: 'playing' }, changed: true, effect: 'confirm' };
  if (action === 'back') {
    const next = togglePause(game);
    return { game: next, changed: next !== game, effect: next !== game ? 'back' : null };
  }
  if (game.status === 'paused' && (action === 'confirm' || action === 'start')) return { game: togglePause(game), changed: true, effect: 'confirm' };
  if (game.status !== 'playing') return { game, changed: false, effect: null };

  if (game.kind === 'snake' && directions[action] && opposite[action] !== game.direction) {
    // A physical D-pad should feel immediate: apply the turn and one step in
    // this very input handler instead of waiting for the next timer tick.
    const next = tickSnake({ ...game, queuedDirection: action }, random);
    return { game: next, changed: next !== game, effect: 'move' };
  }
  if (game.kind === 'tetris') {
    if (action === 'left' || action === 'right') {
      const next = moveTetris(game, action === 'left' ? -1 : 1);
      return { game: next, changed: next !== game, effect: next !== game ? 'move' : null };
    }
    if (action === 'down') {
      const next = tickTetris(game, random);
      return { game: next, changed: next !== game, effect: next !== game ? 'move' : null };
    }
    if (action === 'up' || action === 'confirm' || action === 'start') {
      const next = rotateTetris(game);
      return { game: next, changed: next !== game, effect: next !== game ? 'confirm' : null };
    }
  }
  return { game, changed: false, effect: null };
}
