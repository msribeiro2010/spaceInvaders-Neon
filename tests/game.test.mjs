import test from 'node:test';
import assert from 'node:assert/strict';
import { SnakeGame } from '../src/game.mjs';

const noopRng = () => 0.25;

function seededRng(seq) {
  let i = 0;
  return () => {
    const value = seq[i % seq.length];
    i += 1;
    return value;
  };
}

test('moves one cell in the current direction on tick', () => {
  const game = new SnakeGame({ cols: 7, rows: 7, rng: noopRng });
  const before = game.state();
  game.tick();
  const after = game.state();
  assert.equal(after.snake[0].x, before.snake[0].x + 1);
  assert.equal(after.snake[0].y, before.snake[0].y);
});

test('eating food grows the snake and increments score', () => {
  const game = new SnakeGame({ cols: 8, rows: 8, rng: noopRng });
  const start = game.state();
  const food = { x: start.snake[0].x + 1, y: start.snake[0].y };
  game.food = food;
  game.tick();
  const after = game.state();
  assert.equal(after.snake.length, start.snake.length + 1);
  assert.equal(after.score, 10);
  assert.ok(after.food, 'spawns a new food after eating');
});

test('self collision ends the game', () => {
  const game = new SnakeGame({ cols: 4, rows: 4, rng: noopRng });
  game.snake = [
    { x: 2, y: 1 }, // head
    { x: 1, y: 1 },
    { x: 1, y: 2 },
    { x: 2, y: 2 },
  ];
  game.direction = 'left';
  game.nextDirection = 'left';
  game.food = { x: 0, y: 0 };
  game.tick();
  assert.equal(game.state().alive, false);
});

test('wall collision ends the game', () => {
  const game = new SnakeGame({ cols: 3, rows: 3, rng: noopRng });
  game.snake = [
    { x: 0, y: 1 },
    { x: 1, y: 1 },
  ];
  game.direction = 'left';
  game.nextDirection = 'left';
  game.food = { x: 2, y: 2 };
  game.tick();
  assert.equal(game.state().alive, false);
});

test('food never spawns on the snake', () => {
  const game = new SnakeGame({ cols: 4, rows: 4, rng: seededRng([0.99, 0.01, 0.5]) });
  game.snake = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
  ];
  const food = game.placeFood();
  assert.ok(!game.occupies(food));
});

test('direction changes ignore direct reversal when length > 1', () => {
  const game = new SnakeGame({ cols: 6, rows: 6, rng: noopRng });
  const before = game.state().direction;
  assert.equal(before, 'right');
  game.setDirection('left'); // reversal request should be ignored
  assert.equal(game.nextDirection, 'right');
  game.tick();
  assert.equal(game.state().direction, 'right');
});
