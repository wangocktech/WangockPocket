export const initialState = () => ({ power: 'off', route: { name: 'menu', selected: 0, page: 0 }, history: [] });

// A small, deterministic navigation stack shared by keyboard and touch controls.
export function navigate(state, action) {
  if (action.type === 'power') return state.power === 'off' ? { ...initialState(), power: 'boot' } : initialState();
  if (action.type === 'ready') return state.power === 'boot' ? { ...state, power: 'on' } : state;
  if (state.power !== 'on') return state;
  if (action.type === 'open') return { ...state, history: [...state.history, { ...state.route }], route: { selected: 0, page: 0, ...action.route } };
  if (action.type === 'back') return state.history.length ? { ...state, route: state.history.at(-1), history: state.history.slice(0, -1) } : state;
  if (action.type === 'menu') return { ...state, route: state.history.find(route => route.name === 'menu') ?? { name: 'menu', selected: 0, page: 0 }, history: [] };
  if (action.type === 'select') return { ...state, route: { ...state.route, selected: action.index } };
  if (action.type === 'move' && action.count > 0) {
    const field = action.field ?? 'selected';
    return { ...state, route: { ...state.route, [field]: ((state.route[field] ?? 0) + action.delta + action.count) % action.count } };
  }
  return state;
}
