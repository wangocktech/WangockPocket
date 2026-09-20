import { portfolio } from './content.js';
import { initialState, navigate } from './navigation.js';
import { ButtonSounds } from './sound.js';
import { SNAKE_SIZE, TETRIS_HEIGHT, TETRIS_WIDTH, applyGameAction, createSnake, createTetris, getTetrisCells, getTetrominoCells, tickGame } from './games.js';

const $ = selector => document.querySelector(selector);
const screen = $('#screen-content');
const consoleBody = $('#console');
const powerSwitch = $('#power-toggle');
const soundButton = $('#sound-toggle');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const menu = [
  { label: 'ОБО МНЕ', route: 'about' },
  { label: 'ПРОЕКТЫ', route: 'projects' },
  { label: 'ПРАЙС', route: 'pricing' },
  { label: 'КОНТАКТЫ', route: 'contacts' },
  { label: 'АРКАДА', route: 'arcade' },
];
let state = initialState();
let bootTimer;
let toastTimer;
let gameTimer;
let activeGame = null;
let soundEnabled = false;
let tabNavigation = false;
try { soundEnabled = localStorage.getItem('wangock-sound') === 'on'; } catch { /* Storage is optional. */ }
const sounds = new ButtonSounds(consoleBody, () => {
  soundEnabled = false;
  sounds.setEnabled(false);
  try { localStorage.setItem('wangock-sound', 'off'); } catch { /* Optional preference. */ }
  syncSoundButton();
  showToast('НЕ УДАЛОСЬ ВКЛЮЧИТЬ ЗВУК. НАЖМИ SOUND ЕЩЁ РАЗ.');
});
sounds.setEnabled(soundEnabled);

const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const safeUrl = value => {
  if (!value) return null;
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : null; } catch { return null; }
};
const telegramUrl = safeUrl(portfolio.telegram);
const avatar = `<svg class="pixel-avatar" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 1h10v2h3v3h2v13h-3v3H5v-3H2V6h2V3h3z"/><path fill="var(--lcd)" d="M5 6h14v12H5zM7 18h10v2H7z"/><path d="M7 9h3v3H7zm7 0h3v3h-3zm-6 6h8v2H8zM1 9h2v6H1zm20 0h2v6h-2z"/></svg>`;
const deviceArt = `<svg class="pixel-device" viewBox="0 0 32 38" aria-hidden="true"><path d="M4 0h24v2h2v30h-2v4h-4v2H4v-2H2V2h2zm2 4v16h20V4zm3 21v3H6v3h3v3h3v-3h3v-3h-3v-3zm14 0v4h4v-4zm-5 5v4h4v-4z"/><path d="M11 9h3v3h-3zm8 0h3v3h-3zm-8 6h3v2h5v-2h3v4H11z"/></svg>`;
const battery = '<span class="pixel-battery" aria-label="Батарея заряжена"><i></i><i></i><i></i></span>';
const tags = items => `<div class="tag-list">${items.map(item => `<span class="pixel-tag">${escapeHTML(item)}</span>`).join('')}</div>`;
const selected = index => state.route.selected === index ? ' is-selected' : '';
const cursorIcon = '<svg class="screen-icon" viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="m3 1 8 5-8 5Z"/></svg>';
const outboundIcon = '<svg class="screen-icon outbound" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="m3 13 10-10M4 3h9v9"/></svg>';
const option = (label, index, action) => `<div class="screen-option${selected(index)}" data-index="${index}" data-screen-action="${action}" aria-current="${state.route.selected === index ? 'true' : 'false'}"><span>${escapeHTML(label)}</span>${outboundIcon}</div>`;
const linkOption = (label, index, url) => `<div class="screen-option${selected(index)}" data-index="${index}" data-screen-action="external" data-url="${escapeHTML(url)}" aria-current="${state.route.selected === index ? 'true' : 'false'}"><span>${escapeHTML(label)}</span>${outboundIcon}</div>`;
const gameRoute = name => name === 'snake' || name === 'tetris';

function frame(title, body, hints = '↑↓ ВЫБОР', extraClass = '') {
  return `<div class="screen-top"><span>${escapeHTML(title)}</span>${battery}</div><div class="screen-main ${extraClass}">${body}</div><div class="screen-footer"><span>${hints}</span><span>A OK&nbsp; B НАЗАД</span></div>`;
}

function projectArt(project) {
  const shapes = {
    orbit: '<ellipse cx="45" cy="26" rx="35" ry="13" transform="rotate(-25 45 26)"/><ellipse cx="45" cy="26" rx="19" ry="22" transform="rotate(30 45 26)"/><circle cx="45" cy="26" r="6" fill="currentColor"/><rect x="12" y="34" width="5" height="5" fill="currentColor"/><rect x="71" y="10" width="4" height="4" fill="currentColor"/>',
    forma: '<path d="M12 44V8h26v10H22v6h13v9H22v11z" fill="currentColor"/><path d="m45 44 15-36h10l15 36H74l-3-9H57l-3 9z"/><path d="m60 27 4-11 4 11z" fill="currentColor"/>',
    pixel: '<path d="M25 16h42v31H25zM34 16V9h24v7"/><path d="M20 16h52v8H20z" fill="currentColor"/><path d="M35 30h6v6h-6zm17 0h6v6h-6zm-14 11h18"/>',
  };
  return `<div class="project-art"><svg viewBox="0 0 90 52" aria-hidden="true">${shapes[project.art] ?? shapes.orbit}</svg><span>${escapeHTML(project.category)}</span></div>`;
}

function gameStateLabel(game) {
  if (game.status === 'ready') return 'ГОТОВ';
  if (game.status === 'paused') return 'ПАУЗА';
  if (game.status === 'gameover') return 'ИГРА ОКОНЧЕНА';
  if (game.status === 'won') return 'ПОЛЕ ПРОЙДЕНО';
  return 'ИГРА';
}

function gameMessage(game) {
  if (game.status === 'ready') return 'A / START — НАЧАТЬ';
  if (game.status === 'paused') return 'A ПРОДОЛЖИТЬ';
  if (game.status === 'gameover' || game.status === 'won') return 'A ИГРАТЬ СНОВА';
  return 'B ПАУЗА · SELECT МЕНЮ';
}

function snakeScreen(game) {
  const snake = new Map(game.body.map((part, index) => [`${part.x}:${part.y}`, index]));
  const cells = Array.from({ length: SNAKE_SIZE * SNAKE_SIZE }, (_, index) => {
    const x = index % SNAKE_SIZE;
    const y = Math.floor(index / SNAKE_SIZE);
    const part = snake.get(`${x}:${y}`);
    const type = part === 0 ? ' is-head' : part !== undefined ? ' is-snake' : game.food?.x === x && game.food?.y === y ? ' is-food' : '';
    return `<i class="game-cell${type}" aria-hidden="true"></i>`;
  }).join('');
  return frame('05 / ЗМЕЙКА', `<div class="game-hud"><strong>СЧЁТ ${String(game.score).padStart(4, '0')}</strong><span>${gameStateLabel(game)}</span></div><div class="game-board snake-board" role="img" aria-label="Змейка. Счёт ${game.score}. ${gameStateLabel(game)}">${cells}</div><p class="game-message">${gameMessage(game)}</p>`, '←↑↓→ ХОД', 'game-screen');
}

function tetrisScreen(game) {
  const falling = new Map(getTetrisCells(game.piece).filter(cell => cell.y >= 0 && cell.y < TETRIS_HEIGHT).map(cell => [`${cell.x}:${cell.y}`, cell.name]));
  const cells = Array.from({ length: TETRIS_WIDTH * TETRIS_HEIGHT }, (_, index) => {
    const x = index % TETRIS_WIDTH;
    const y = Math.floor(index / TETRIS_WIDTH);
    const key = `${x}:${y}`;
    const name = falling.get(key) ?? game.board[index];
    return `<i class="game-cell${name ? ' is-filled block-' + name.toLowerCase() : ''}${falling.has(key) ? ' is-active' : ''}" aria-hidden="true"></i>`;
  }).join('');
  const nextCells = new Set(getTetrominoCells(game.next).map(cell => `${cell.x}:${cell.y}`));
  const mini = Array.from({ length: 16 }, (_, index) => `<i class="game-cell${nextCells.has(`${index % 4}:${Math.floor(index / 4)}`) ? ' is-filled block-' + game.next.toLowerCase() : ''}" aria-hidden="true"></i>`).join('');
  return frame('06 / ТЕТРИС', `<div class="game-hud"><strong>СЧЁТ ${String(game.score).padStart(4, '0')}</strong><span>ЛИНИИ ${String(game.lines).padStart(2, '0')}</span></div><div class="tetris-layout"><div class="game-board tetris-board" role="img" aria-label="Тетрис. Счёт ${game.score}. Линии ${game.lines}. ${gameStateLabel(game)}" data-piece-y="${game.piece.y}" data-rotation="${game.piece.rotation}">${cells}</div><aside class="next-piece" aria-label="Следующая фигура"><span>NEXT</span><div class="next-grid">${mini}</div><b>${gameStateLabel(game)}</b></aside></div><p class="game-message">${gameMessage(game)}</p>`, '←→ ДВИГ · ↑ A ВРАЩ', 'game-screen');
}

function syncGameTimer() {
  if (gameTimer !== undefined) clearInterval(gameTimer);
  gameTimer = undefined;
  if (!activeGame || activeGame.status !== 'playing') return;
  const delay = activeGame.kind === 'snake' ? 480 : 620;
  gameTimer = setInterval(() => {
    if (!activeGame || state.power !== 'on' || state.route.name !== activeGame.kind) return stopGame();
    const next = tickGame(activeGame);
    if (next === activeGame) return;
    activeGame = next;
    if (next.status !== 'playing') syncGameTimer();
    render();
    if (next.status === 'gameover') announce('Игра окончена. Нажми A, чтобы начать снова.');
    if (next.status === 'won') announce('Поле пройдено. Нажми A, чтобы начать снова.');
  }, delay);
}

function stopGame() {
  if (gameTimer !== undefined) clearInterval(gameTimer);
  gameTimer = undefined;
  activeGame = null;
}

function startGame(kind) {
  stopGame();
  activeGame = kind === 'snake' ? createSnake() : createTetris();
  syncGameTimer();
  render(true);
  announce(kind === 'snake' ? 'Змейка готова. Нажми A, чтобы начать.' : 'Тетрис готов. Нажми A, чтобы начать.');
}

function controlGame(action) {
  if (!activeGame || activeGame.kind !== state.route.name) return;
  const previousGame = activeGame;
  const result = applyGameAction(activeGame, action);
  if (!result.changed) return;
  activeGame = result.game;
  // Snake takes a step on every direction press, so its next automatic step
  // begins from that press. Tetris must keep falling while the player moves
  // or rotates a piece, and only needs timer changes when its state changes.
  if (activeGame.kind === 'snake' || activeGame.status !== previousGame.status) syncGameTimer();
  if (result.effect) playSound(result.effect);
  render();
  if (activeGame.status === 'playing' && (action === 'confirm' || action === 'start')) announce('Игра началась.');
  if (activeGame.status === 'paused') announce('Игра на паузе. Нажми A, чтобы продолжить.');
  if (activeGame.status === 'playing' && action === 'back') announce('Игра продолжается.');
}

function pauseGameForBackground() {
  if (!activeGame || activeGame.status !== 'playing') return;
  activeGame = { ...activeGame, status: 'paused' };
  syncGameTimer();
  render();
}

function render(animate = false) {
  consoleBody.dataset.power = state.power;
  powerSwitch.setAttribute('aria-checked', String(state.power !== 'off'));
  $('#lcd').setAttribute('aria-busy', String(state.power === 'boot'));
  screen.className = `screen-content${state.power === 'boot' ? ' booting' : animate ? ' entering' : ''}`;

  if (state.power === 'off') {
    screen.innerHTML = `<div class="screen-off">${deviceArt}<h2>HELLO, PLAYER.</h2><p class="screen-start-label">${cursorIcon} PRESS START</p><p>Нажми START на консоли</p></div>`;
  } else if (state.power === 'boot') {
    screen.innerHTML = `<div class="boot-screen">${avatar}<h2>${escapeHTML(portfolio.name.toUpperCase())}</h2><p>LOADING GOOD IDEAS...</p><div class="boot-progress"><span></span></div></div>`;
  } else {
    const { route } = state;
    if (route.name === 'menu') {
      screen.innerHTML = frame('PORTFOLIO OS · 2.0', `<div class="menu-identity">${avatar}<div><h2>${escapeHTML(portfolio.name.toUpperCase())}</h2><p>DEVELOPER · PLAYER 01</p></div></div><div class="menu-list" role="list" aria-label="Разделы портфолио">${menu.map((item, index) => `<div class="menu-item${selected(index)}" role="listitem" data-index="${index}" data-screen-action="open-menu" aria-current="${route.selected === index ? 'true' : 'false'}"><span class="cursor" aria-hidden="true">${cursorIcon}</span>${item.label}<span class="menu-num">0${index + 1}</span></div>`).join('')}</div>`, '↑↓ ВЫБОР');
    } else if (route.name === 'about') {
      const page = portfolio.about[route.page];
      screen.innerHTML = frame('01 / ОБО МНЕ', `<div class="profile-heading">${avatar}<div><h2 class="screen-title">${escapeHTML(page.title)}</h2><p>${escapeHTML(portfolio.role)}</p></div></div><p class="screen-copy">${escapeHTML(page.text)}</p><p class="screen-note">${escapeHTML(page.note)}</p>${tags(page.tags)}`, `← → СТР. ${route.page + 1}/${portfolio.about.length}`);
    } else if (route.name === 'projects') {
      screen.innerHTML = frame('02 / ПРОЕКТЫ', `${portfolio.projects.length ? `<div class="project-demo-label"><span>ИЗБРАННЫЕ РАБОТЫ</span><span>${String(portfolio.projects.length).padStart(2, '0')} ITEMS</span></div>${portfolio.projects.map((project, index) => `<div class="project-row${selected(index)}" data-index="${index}" data-screen-action="open-project" aria-current="${route.selected === index ? 'true' : 'false'}"><span class="project-index">${String(index + 1).padStart(2, '0')}</span><span><strong>${escapeHTML(project.name)}</strong><small>${escapeHTML(project.type)}${project.isDemo ? ' · ДЕМО' : ''}</small></span>${outboundIcon}</div>`).join('')}` : '<p class="screen-copy">Новые проекты скоро появятся здесь.</p>'}`);
    } else if (route.name === 'project') {
      const project = portfolio.projects[route.index];
      const demoUrl = safeUrl(project.demoUrl);
      const sourceUrl = safeUrl(project.sourceUrl);
      screen.innerHTML = frame(`ПРОЕКТ / ${project.name}`, `<div class="project-demo-label"><span>${project.isDemo ? 'ДЕМОНСТРАЦИОННЫЙ КОНЦЕПТ' : 'ИЗБРАННЫЙ ПРОЕКТ'}</span><span>${escapeHTML(project.year)}</span></div>${projectArt(project)}<p class="screen-copy">${escapeHTML(project.description)}</p>${tags(project.stack)}<div class="screen-options">${demoUrl ? linkOption('Открыть сайт', 0, demoUrl) : option('Смотреть обзор', 0, 'project-preview')}${sourceUrl ? linkOption('Исходный код', 1, sourceUrl) : ''}</div>`, '↑↓ ВЫБОР / ПРОКРУТКА', 'project-detail');
    } else if (route.name === 'project-preview') {
      const project = portfolio.projects[route.index];
      screen.innerHTML = frame(`ОБЗОР / ${project.name}`, `<h2 class="screen-title">ЧТО ВНУТРИ</h2><ul class="feature-list">${project.features.map(feature => `<li>${escapeHTML(feature)}</li>`).join('')}</ul><p class="screen-note">${project.isDemo ? 'Это пример проекта для портфолио. Реальный сайт пока не подключён.' : 'Подробности проекта. Ссылка на сайт пока не добавлена.'}</p>${option('Хочу похожий проект', 0, 'contacts')}`, 'A ОБСУДИТЬ');
    } else if (route.name === 'pricing') {
      screen.innerHTML = frame('03 / ПРАЙС', `${portfolio.services.map((service, index) => `<div class="price-row${selected(index)}" data-index="${index}" data-screen-action="open-service" aria-current="${route.selected === index ? 'true' : 'false'}"><span>${escapeHTML(service.name)}</span><strong>${escapeHTML(service.price)}</strong></div>`).join('')}<p class="price-disclaimer">${escapeHTML(portfolio.pricingNote)}</p>`, '↑↓ ВЫБОР');
    } else if (route.name === 'service') {
      const service = portfolio.services[route.index];
      screen.innerHTML = frame('ПРАЙС / ПОДРОБНОСТИ', `<h2 class="screen-title">${escapeHTML(service.name)}</h2><p class="service-price">${escapeHTML(service.price)}</p><p class="service-time">${escapeHTML(service.timing)} · ПРИМЕР ОЦЕНКИ</p><p class="screen-note">${escapeHTML(service.description)}</p><ul class="feature-list">${service.includes.map(item => `<li>${escapeHTML(item)}</li>`).join('')}</ul>${option('Обсудить задачу', 0, 'contacts')}`, '↑↓ ПРОКРУТКА');
    } else if (route.name === 'arcade') {
      screen.innerHTML = frame('05 / АРКАДА', `<div class="arcade-intro"><span>INSERT COIN · 01</span><strong>ВЫБЕРИ ИГРУ</strong></div><div class="game-list"><div class="game-row${selected(0)}" data-index="0" data-screen-action="open-game" data-game="snake" aria-current="${route.selected === 0 ? 'true' : 'false'}"><svg class="game-glyph snake-glyph" viewBox="0 0 20 20" aria-hidden="true"><path d="M2 2h14v4H7v4h11v8H2v-4h11v-4H2z"/></svg><span><strong>ЗМЕЙКА</strong><small>КЛАССИКА · РОСТ И СЧЁТ</small></span>${outboundIcon}</div><div class="game-row${selected(1)}" data-index="1" data-screen-action="open-game" data-game="tetris" aria-current="${route.selected === 1 ? 'true' : 'false'}"><span class="game-glyph tetris-glyph" aria-hidden="true"></span><span><strong>ТЕТРИС</strong><small>ФИГУРЫ · ЛИНИИ · СЧЁТ</small></span>${outboundIcon}</div></div><p class="arcade-note">B — ПАУЗА · SELECT — МЕНЮ</p>`, '↑↓ ВЫБОР');
    } else if (route.name === 'snake') {
      screen.innerHTML = snakeScreen(activeGame?.kind === 'snake' ? activeGame : createSnake(() => 0));
    } else if (route.name === 'tetris') {
      screen.innerHTML = tetrisScreen(activeGame?.kind === 'tetris' ? activeGame : createTetris(() => .3));
    } else if (route.name === 'contacts') {
      screen.innerHTML = frame('04 / КОНТАКТЫ', `<div class="contact-hero">${avatar}<h2>ЕСТЬ ИДЕЯ?<br>ДАВАЙ СОЗДАДИМ ЕЁ.</h2><p>Обсудим твою идею в Telegram.</p><span class="contact-handle">${escapeHTML(portfolio.handle)}</span></div><div class="screen-options">${telegramUrl ? linkOption('Написать в Telegram', 0, telegramUrl) : ''}${option('Скопировать ' + portfolio.handle, telegramUrl ? 1 : 0, 'copy-contact')}</div>`, '↑↓ ВЫБОР');
    }
  }
}

function announce(text) { $('#announcer').textContent = text; }

function transition(action, animate = false) {
  const previous = state;
  state = navigate(state, action);
  if (state === previous) return;
  if (gameRoute(previous.route.name) && state.route.name !== previous.route.name) stopGame();
  clearTimeout(toastTimer);
  render(animate);
  if (action.type === 'open' || action.type === 'back' || action.type === 'menu') {
    announce(screen.querySelector('.screen-top')?.textContent ?? 'Главное меню');
  } else if (action.type === 'move' || action.type === 'select') {
    const current = screen.querySelector('[aria-current="true"]');
    current?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    announce(current?.textContent ?? screen.querySelector('.screen-title')?.textContent ?? '');
  }
}

function playSound(kind = 'move') {
  sounds.play(kind);
}

function syncSoundButton() {
  soundButton.setAttribute('aria-pressed', String(soundEnabled));
  soundButton.setAttribute('aria-label', soundEnabled ? 'Выключить звук' : 'Включить звук');
  soundButton.title = (soundEnabled ? 'Звук включён' : 'Звук выключен') + ' · M';
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  sounds.setEnabled(soundEnabled);
  try { localStorage.setItem('wangock-sound', soundEnabled ? 'on' : 'off'); } catch { /* Optional preference. */ }
  syncSoundButton();
  if (soundEnabled) playSound('confirm');
  announce(soundEnabled ? 'Звук включён' : 'Звук выключен');
}

function togglePower(destination = null) {
  clearTimeout(bootTimer);
  clearTimeout(toastTimer);
  transition({ type: 'power' });
  if (state.power === 'boot') {
    playSound('boot');
    announce('Консоль включается');
    bootTimer = setTimeout(() => {
      transition({ type: 'ready' }, true);
      if (destination) transition({ type: 'open', route: { name: destination } }, true);
      announce(destination === 'contacts' ? 'Контакты Wangock' : 'Главное меню. Обо мне. Используй стрелки и Enter.');
    }, reducedMotion.matches ? 80 : 950);
  } else { playSound('off'); announce('Консоль выключена'); }
}

function pressFeedback(control) {
  const element = document.querySelector(`[data-control="${control}"]`);
  element?.classList.add('is-pressed');
  setTimeout(() => element?.classList.remove('is-pressed'), 110);
}

function control(action) {
  pressFeedback(action);
  if (action === 'start' && state.power === 'off') return togglePower();
  if (state.power !== 'on') return;
  if (gameRoute(state.route.name) && action !== 'select') return controlGame(action);
  if (action === 'back') { playSound('back'); transition({ type: 'back' }, true); return; }
  if (action === 'select') { playSound('back'); transition({ type: 'menu' }, true); return; }
  if (action === 'confirm' || action === 'start') return confirm();
  if (['up', 'down', 'left', 'right'].includes(action)) {
    const delta = ['up', 'left'].includes(action) ? -1 : 1;
    playSound('move');
    if (state.route.name === 'about') {
      transition({ type: 'move', field: 'page', delta, count: portfolio.about.length });
    } else {
      const count = screen.querySelectorAll('[data-index]').length;
      if (count > 1) transition({ type: 'move', delta, count });
      else screen.querySelector('.screen-main')?.scrollBy({ top: delta * 75, behavior: reducedMotion.matches ? 'instant' : 'smooth' });
    }
  }
}

function confirm() {
  if (state.route.name === 'about') {
    playSound('move');
    transition({ type: 'move', field: 'page', delta: 1, count: portfolio.about.length });
    return;
  }
  const target = screen.querySelector(`[data-index="${state.route.selected}"]`);
  if (target) activate(target);
}

function activate(target) {
  const action = target.dataset.screenAction;
  playSound('confirm');
  if (action === 'open-menu') transition({ type: 'open', route: { name: menu[state.route.selected].route } }, true);
  if (action === 'open-project') transition({ type: 'open', route: { name: 'project', index: state.route.selected } }, true);
  if (action === 'project-preview') transition({ type: 'open', route: { name: 'project-preview', index: state.route.index } }, true);
  if (action === 'open-service') transition({ type: 'open', route: { name: 'service', index: state.route.selected } }, true);
  if (action === 'contacts') transition({ type: 'open', route: { name: 'contacts' } }, true);
  if (action === 'open-game') {
    const kind = target.dataset.game;
    if (gameRoute(kind)) {
      transition({ type: 'open', route: { name: kind } }, true);
      startGame(kind);
    }
  }
  if (action === 'copy-contact') void copyContact();
  if (action === 'external') {
    const url = safeUrl(target.dataset.url);
    if (url) { window.open(url, '_blank', 'noopener,noreferrer'); showToast('ОТКРЫВАЮ В НОВОЙ ВКЛАДКЕ'); }
  }
}

async function copyContact() {
  let copied = false;
  if (navigator.clipboard && window.isSecureContext) {
    try { await navigator.clipboard.writeText(portfolio.handle); copied = true; } catch { /* Try the HTTP-compatible fallback. */ }
  }
  if (!copied) {
    const oldFocus = document.activeElement;
    const textarea = document.createElement('textarea');
    textarea.value = portfolio.handle;
    textarea.setAttribute('readonly', '');
    textarea.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;font-size:16px';
    document.body.append(textarea);
    textarea.select(); textarea.setSelectionRange(0, textarea.value.length);
    try { copied = document.execCommand('copy'); } catch { /* Show the handle for manual copying. */ }
    textarea.remove(); oldFocus?.focus({ preventScroll: true });
  }
  showToast(copied ? 'СКОПИРОВАНО: ' + portfolio.handle : 'ТВОЙ КОНТАКТ: ' + portfolio.handle);
}

function showToast(message) {
  clearTimeout(toastTimer);
  screen.querySelector('.screen-toast')?.remove();
  const toast = document.createElement('div'); toast.className = 'screen-toast'; toast.textContent = message;
  screen.append(toast); announce(message);
  toastTimer = setTimeout(() => toast.remove(), 2500);
}

document.querySelectorAll('[data-control]').forEach(button => {
  button.addEventListener('click', () => control(button.dataset.control));
  button.addEventListener('contextmenu', event => event.preventDefault());
});
powerSwitch.addEventListener('click', () => togglePower());
soundButton.addEventListener('click', toggleSound);
document.addEventListener('visibilitychange', () => { if (document.hidden) { sounds.stop(); pauseGameForBackground(); } });
window.addEventListener('pagehide', () => { sounds.stop(); pauseGameForBackground(); });

const keyActions = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', KeyA: 'confirm', KeyB: 'back', Escape: 'back', Backspace: 'back' };
document.addEventListener('pointerdown', () => { tabNavigation = false; });
document.addEventListener('keydown', event => {
  if (event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
  if (event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
  const code = event.code;
  if (code === 'Tab') { tabNavigation = true; return; }
  if (code === 'KeyM') { event.preventDefault(); if (!event.repeat) toggleSound(); return; }
  if (code === 'KeyP') { event.preventDefault(); if (!event.repeat) togglePower(); return; }
  const nativeTarget = event.target.closest('button, a');
  if (code === 'Enter' || code === 'Space') {
    // Explicit Tab navigation activates the focused control. After a click or
    // a direction key, Enter belongs to the console, not the last clicked button.
    if (nativeTarget && tabNavigation) return;
    event.preventDefault(); if (!event.repeat) control(state.power === 'off' ? 'start' : 'confirm'); return;
  }
  const action = keyActions[code];
  if (!action) return;
  if (state.power === 'off' && !['back'].includes(action)) return;
  event.preventDefault();
  tabNavigation = false;
  if (event.repeat && ['confirm', 'back'].includes(action)) return;
  control(action);
});

syncSoundButton();
render();
