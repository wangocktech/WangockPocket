import test from 'node:test';
import assert from 'node:assert/strict';
import { applyGameAction, createSnake, createTetris, getTetrisCells, tickGame } from '../games.js';

test('Snake grows after eating and never accepts an immediate reverse turn', () => {
  let game = createSnake(() => 0);
  game = { ...game, body: [{ x: 4, y: 4 }, { x: 3, y: 4 }, { x: 2, y: 4 }], direction: 'right', queuedDirection: 'right', food: { x: 5, y: 4 }, status: 'playing' };
  assert.equal(applyGameAction(game, 'left').changed, false);
  game = tickGame(game, () => .5);
  assert.deepEqual(game.body[0], { x: 5, y: 4 });
  assert.equal(game.body.length, 4);
  assert.equal(game.score, 10);
});

test('Snake direction input moves immediately instead of waiting for its timer', () => {
  let game = createSnake(() => 0);
  game = { ...game, body: [{ x: 4, y: 4 }, { x: 3, y: 4 }, { x: 2, y: 4 }], direction: 'right', queuedDirection: 'right', status: 'playing' };
  const turn = applyGameAction(game, 'down', () => .5);
  assert.equal(turn.changed, true);
  assert.deepEqual(turn.game.body[0], { x: 4, y: 5 });
  assert.equal(turn.game.direction, 'down');
});

test('Snake ends a run on a wall and can be restarted with A', () => {
  let game = createSnake(() => 0);
  game = { ...game, body: [{ x: 11, y: 0 }, { x: 10, y: 0 }, { x: 9, y: 0 }], direction: 'right', queuedDirection: 'right', status: 'playing' };
  game = tickGame(game);
  assert.equal(game.status, 'gameover');
  const restart = applyGameAction(game, 'confirm', () => .5);
  assert.equal(restart.game.status, 'playing');
  assert.equal(restart.game.score, 0);
});

test('Tetris falls, pauses and resumes without advancing while paused', () => {
  let game = createTetris(() => .3);
  assert.equal(getTetrisCells(game.piece).length, 4);
  game = { ...game, status: 'playing' };
  const startY = game.piece.y;
  game = tickGame(game);
  assert.equal(game.piece.y, startY + 1);
  game = applyGameAction(game, 'back').game;
  assert.equal(game.status, 'paused');
  assert.equal(tickGame(game), game);
  game = applyGameAction(game, 'confirm').game;
  assert.equal(game.status, 'playing');
});

test('Tetris clears a completed line and awards score', () => {
  let game = createTetris(() => .15);
  const board = Array(160).fill('');
  for (let x = 0; x < 10; x++) if (x !== 4 && x !== 5) board[150 + x] = 'I';
  game = { ...game, board, piece: { ...game.piece, x: 3, y: 13 }, status: 'playing' };
  game = tickGame(game, () => .15);
  game = tickGame(game, () => .15);
  assert.equal(game.lines, 1);
  assert.equal(game.score, 100);
  assert.equal(game.status, 'playing');
});
