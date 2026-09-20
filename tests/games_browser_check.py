"""Focused browser checks for the two arcade games in Chromium and WebKit.

Use PORTFOLIO_URL and PORTFOLIO_RESULTS in the same way as browser_check.py.
"""
import json
import os
from pathlib import Path
from playwright.sync_api import expect, sync_playwright

URL = os.environ.get('PORTFOLIO_URL', 'https://wangock.tech')
OUT = Path(os.environ.get('PORTFOLIO_RESULTS', '/tmp/wangock-games-results'))
OUT.mkdir(parents=True, exist_ok=True)
results = []


def record(engine, mode, name):
    results.append({'browser': engine, 'input': mode, 'check': name})
    print(f'PASS {engine} {mode}: {name}', flush=True)


def boot_keyboard(page):
    page.goto(URL, wait_until='networkidle')
    page.keyboard.press('Enter')
    expect(page.locator('.menu-item')).to_have_count(5)
    page.keyboard.press('ArrowLeft')
    expect(page.locator('.menu-item.is-selected')).to_contain_text('АРКАДА')
    page.keyboard.press('Enter')


def boot_touch(page):
    page.goto(URL, wait_until='networkidle')
    page.get_by_role('button', name='START — включить или открыть').tap()
    expect(page.locator('.menu-item')).to_have_count(5)
    page.get_by_role('button', name='Влево', exact=True).tap()
    expect(page.locator('.menu-item.is-selected')).to_contain_text('АРКАДА')
    page.get_by_role('button', name='A — открыть', exact=True).tap()


with sync_playwright() as playwright:
    for engine in os.environ.get('PORTFOLIO_BROWSERS', 'chromium,webkit').split(','):
        browser = getattr(playwright, engine).launch(headless=True, args=['--no-sandbox'] if engine == 'chromium' else [])
        errors = []

        desktop = browser.new_context(viewport={'width': 1440, 'height': 1000}, locale='ru-RU', reduced_motion='reduce')
        keyboard = desktop.new_page()
        keyboard.on('pageerror', lambda error: errors.append(str(error)))
        boot_keyboard(keyboard)
        expect(keyboard.locator('.game-row')).to_have_count(2)
        expect(keyboard.locator('.game-row.is-selected')).to_contain_text('ЗМЕЙКА')
        assert keyboard.locator('.game-row.is-selected').evaluate("el => getComputedStyle(el).backgroundColor") != 'rgba(0, 0, 0, 0)'
        keyboard.screenshot(path=str(OUT / f'{engine}-arcade-desktop.png'), full_page=True, animations='disabled')
        keyboard.keyboard.press('Enter')
        expect(keyboard.locator('.snake-board .game-cell')).to_have_count(144)
        keyboard.keyboard.press('Enter')
        keyboard.keyboard.press('ArrowDown')
        keyboard.keyboard.press('Escape')
        expect(keyboard.locator('.game-message')).to_contain_text('A ПРОДОЛЖИТЬ')
        keyboard.keyboard.press('Enter')
        expect(keyboard.locator('.game-message')).to_contain_text('B ПАУЗА')
        keyboard.get_by_role('button', name='SELECT — главное меню').click()
        expect(keyboard.locator('.menu-item.is-selected')).to_contain_text('АРКАДА')
        keyboard.keyboard.press('Enter')
        keyboard.keyboard.press('ArrowDown')
        keyboard.keyboard.press('Enter')
        expect(keyboard.locator('.tetris-board .game-cell')).to_have_count(160)
        keyboard.keyboard.press('Enter')
        initial_y = int(keyboard.locator('.tetris-board').get_attribute('data-piece-y'))
        for key in ['ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'ArrowLeft']:
            keyboard.keyboard.press(key)
            keyboard.wait_for_timeout(150)
        assert int(keyboard.locator('.tetris-board').get_attribute('data-piece-y')) > initial_y, 'Tetris must fall while receiving movement input'
        rotation = keyboard.locator('.tetris-board').get_attribute('data-rotation')
        keyboard.keyboard.press('ArrowUp')
        expect(keyboard.locator('.tetris-board')).not_to_have_attribute('data-rotation', rotation)
        keyboard.keyboard.press('Escape')
        expect(keyboard.locator('.next-piece')).to_contain_text('ПАУЗА')
        keyboard.screenshot(path=str(OUT / f'{engine}-tetris-desktop.png'), full_page=True, animations='disabled')
        record(engine, 'keyboard', 'Snake and Tetris start, accept input, pause and retain the Arcade selection')
        desktop.close()

        mobile = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True,
                                     has_touch=True, locale='ru-RU', reduced_motion='reduce')
        touch = mobile.new_page()
        touch.on('pageerror', lambda error: errors.append(str(error)))
        boot_touch(touch)
        expect(touch.locator('.game-row')).to_have_count(2)
        expect(touch.locator('.game-row.is-selected')).to_contain_text('ЗМЕЙКА')
        assert touch.locator('.game-row.is-selected').evaluate("el => getComputedStyle(el).backgroundColor") != 'rgba(0, 0, 0, 0)'
        touch.get_by_role('button', name='A — открыть', exact=True).tap()
        expect(touch.locator('.snake-board .game-cell')).to_have_count(144)
        touch.get_by_role('button', name='A — открыть', exact=True).tap()
        touch.get_by_role('button', name='Вниз', exact=True).tap()
        touch.get_by_role('button', name='B — назад', exact=True).tap()
        expect(touch.locator('.game-message')).to_contain_text('A ПРОДОЛЖИТЬ')
        touch.get_by_role('button', name='A — открыть', exact=True).tap()
        touch.get_by_role('button', name='SELECT — главное меню').tap()
        touch.get_by_role('button', name='A — открыть', exact=True).tap()
        touch.get_by_role('button', name='Вниз', exact=True).tap()
        touch.get_by_role('button', name='A — открыть', exact=True).tap()
        expect(touch.locator('.tetris-board .game-cell')).to_have_count(160)
        touch.get_by_role('button', name='A — открыть', exact=True).tap()
        touch.get_by_role('button', name='Вверх', exact=True).tap()
        touch.get_by_role('button', name='B — назад', exact=True).tap()
        expect(touch.locator('.next-piece')).to_contain_text('ПАУЗА')
        touch.screenshot(path=str(OUT / f'{engine}-tetris-mobile.png'), full_page=True, animations='disabled')
        record(engine, 'touch', 'Snake and Tetris respond through physical controls on a phone viewport')
        mobile.close()

        assert errors == [], errors
        browser.close()

(OUT / 'results.json').write_text(json.dumps({'url': URL, 'passed': results}, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'passed': len(results), 'artifacts': str(OUT)}, ensure_ascii=False), flush=True)
