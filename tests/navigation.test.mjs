import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, navigate } from '../navigation.js';

const turnOn = () => navigate(navigate(initialState(), { type: 'power' }), { type: 'ready' });

test('Controls cannot navigate a switched-off or booting console', () => {
  for (const state of [initialState(), navigate(initialState(), { type: 'power' })]) {
    assert.equal(navigate(state, { type: 'open', route: { name: 'contacts' } }), state);
    assert.equal(navigate(state, { type: 'move', delta: 1, count: 4 }), state);
  }
});
test('B restores the selected project through two nested pages', () => {
  let state = turnOn();
  state = navigate(state, { type: 'select', index: 1 });
  state = navigate(state, { type: 'open', route: { name: 'projects' } });
  state = navigate(state, { type: 'move', delta: 1, count: 3 });
  state = navigate(state, { type: 'open', route: { name: 'project', index: 1 } });
  state = navigate(state, { type: 'open', route: { name: 'project-preview', index: 1 } });
  state = navigate(state, { type: 'back' });
  assert.equal(state.route.name, 'project'); assert.equal(state.route.index, 1);
  state = navigate(state, { type: 'back' });
  assert.equal(state.route.name, 'projects'); assert.equal(state.route.selected, 1);
  state = navigate(state, { type: 'back' });
  assert.equal(state.route.name, 'menu'); assert.equal(state.route.selected, 1);
  assert.equal(navigate(state, { type: 'back' }), state);
});
test('All directions wrap through the five-item menu without invalid selections', () => {
  let state = turnOn();
  state = navigate(state, { type: 'move', delta: -1, count: 5 }); assert.equal(state.route.selected, 4);
  state = navigate(state, { type: 'move', delta: 1, count: 5 }); assert.equal(state.route.selected, 0);
  assert.equal(navigate(state, { type: 'move', delta: 1, count: 0 }), state);
});
test('Power interruption cancels a stale boot completion and clears history', () => {
  let state = navigate(initialState(), { type: 'power' });
  state = navigate(state, { type: 'power' });
  state = navigate(state, { type: 'ready' }); assert.equal(state.power, 'off');
  state = turnOn();
  state = navigate(state, { type: 'open', route: { name: 'pricing' } });
  state = navigate(state, { type: 'power' }); assert.deepEqual(state, initialState());
});
test('SELECT returns to the menu; a service inquiry returns to that service with B', () => {
  let state = turnOn();
  state = navigate(state, { type: 'select', index: 2 });
  state = navigate(state, { type: 'open', route: { name: 'pricing' } });
  state = navigate(state, { type: 'open', route: { name: 'service', index: 2 } });
  state = navigate(state, { type: 'open', route: { name: 'contacts' } });
  state = navigate(state, { type: 'back' }); assert.equal(state.route.name, 'service'); assert.equal(state.route.index, 2);
  state = navigate(state, { type: 'menu' }); assert.equal(state.route.name, 'menu'); assert.equal(state.route.selected, 2); assert.equal(state.history.length, 0);
});
test('About pages wrap independently from the menu selection', () => {
  let state = navigate(turnOn(), { type: 'open', route: { name: 'about' } });
  state = navigate(state, { type: 'move', field: 'page', delta: -1, count: 2 });
  assert.equal(state.route.page, 1); assert.equal(state.route.selected, 0);
  state = navigate(state, { type: 'move', field: 'page', delta: 1, count: 2 }); assert.equal(state.route.page, 0);
});
test('Arcade preserves its menu selection when SELECT exits a running game', () => {
  let state = turnOn();
  state = navigate(state, { type: 'select', index: 4 });
  state = navigate(state, { type: 'open', route: { name: 'arcade' } });
  state = navigate(state, { type: 'move', delta: 1, count: 2 });
  state = navigate(state, { type: 'open', route: { name: 'tetris' } });
  state = navigate(state, { type: 'menu' });
  assert.equal(state.route.name, 'menu');
  assert.equal(state.route.selected, 4);
  assert.equal(state.history.length, 0);
});
