"""Browser acceptance checks. Run on the VPS with the isolated Playwright venv.

    /opt/wangock-checks/bin/python tests/browser_check.py

Artifacts are kept outside the public website, in /tmp/wangock-browser-results.
"""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

URL = os.environ.get('PORTFOLIO_URL', 'https://wangock.tech')
BROWSER = os.environ.get('PORTFOLIO_BROWSER', 'chromium')
OUT = Path(os.environ.get('PORTFOLIO_RESULTS', '/tmp/wangock-browser-results'))
OUT.mkdir(parents=True, exist_ok=True)
results = []
errors = []


def record(name):
    results.append(name)
    print('PASS ' + name, flush=True)


def attach(page):
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('console', lambda message: errors.append(message.text) if message.type == 'error' else None)


def assert_layout(page, label):
    layout = page.evaluate('''() => {
        const root = document.documentElement;
        const console = document.querySelector('.console');
        const lcd = document.querySelector('.lcd').getBoundingClientRect();
        const body = console.getBoundingClientRect();
        return {width: innerWidth, scrollWidth: root.scrollWidth, transform: getComputedStyle(console).transform,
          consoleLeft: body.left, consoleRight: body.right,
          lcdContained: lcd.left >= body.left && lcd.right <= body.right && lcd.top >= body.top && lcd.bottom <= body.bottom};
    }''')
    assert layout['scrollWidth'] <= layout['width'], f'{label}: horizontal overflow: {layout}'
    assert layout['lcdContained'], f'{label}: LCD outside console'
    assert layout['transform'] == 'none', f'{label}: console must be upright'
    assert page.locator('header, footer').count() == 0, 'Only the console may be on the page'
    assert page.locator('.lcd button, .lcd a, .lcd input, .lcd [tabindex]').count() == 0, 'LCD must not contain interactive elements'
    assert layout['consoleLeft'] >= -1 and layout['consoleRight'] <= layout['width'] + 1, f'{label}: clipped console {layout}'
    record(label + ' layout: no horizontal overflow, console and LCD contained')


with sync_playwright() as playwright:
    browser = getattr(playwright, BROWSER).launch(headless=True, args=['--no-sandbox'] if BROWSER == 'chromium' else [])
    context = browser.new_context(viewport={'width': 1440, 'height': 1000}, locale='ru-RU', reduced_motion='reduce')
    page = context.new_page()
    attach(page)
    page.goto(URL, wait_until='networkidle')
    expect(page.locator('.screen-start-label')).to_be_visible()
    assert_layout(page, 'Desktop 1440')
    page.screenshot(path=str(OUT / 'desktop-off.png'), full_page=True, animations='disabled')

    page.keyboard.press('Enter')
    expect(page.locator('.screen-top')).to_contain_text('PORTFOLIO OS')
    expect(page.locator('.menu-item')).to_have_count(5)
    expect(page.locator('.menu-item.is-selected')).to_contain_text('ОБО МНЕ')
    page.screenshot(path=str(OUT / 'desktop-menu.png'), full_page=True, animations='disabled')
    record('Keyboard: Enter boots the console into the main menu')

    page.keyboard.press('ArrowLeft')
    expect(page.locator('.menu-item.is-selected')).to_contain_text('АРКАДА')
    page.keyboard.press('ArrowLeft')
    expect(page.locator('.menu-item.is-selected')).to_contain_text('КОНТАКТЫ')
    page.keyboard.press('ArrowRight')
    expect(page.locator('.menu-item.is-selected')).to_contain_text('АРКАДА')
    page.keyboard.press('ArrowRight')
    page.keyboard.press('Enter')
    expect(page.locator('.screen-title')).to_contain_text('ПРИВЕТ, Я WANGOCK')
    page.keyboard.press('ArrowRight')
    expect(page.locator('.screen-title')).to_contain_text('МОЙ ПОДХОД')
    page.keyboard.press('ArrowLeft')
    expect(page.locator('.screen-title')).to_contain_text('ПРИВЕТ, Я WANGOCK')
    page.keyboard.press('Escape')
    expect(page.locator('.menu-item.is-selected')).to_contain_text('ОБО МНЕ')
    record('Keyboard: About, both pages, left/right wrapping, Escape restores selection')

    page.keyboard.press('ArrowDown')
    page.keyboard.press('a')
    for name in ['ORBIT', 'FORMA', 'PIXEL SHOP']:
        expect(page.locator('.project-row.is-selected')).to_contain_text(name)
        page.keyboard.press('Enter')
        expect(page.locator('.screen-top')).to_contain_text('ПРОЕКТ / ' + name)
        if name == 'ORBIT':
            page.screenshot(path=str(OUT / 'desktop-project.png'), full_page=True, animations='disabled')
        page.keyboard.press('a')
        expect(page.locator('.screen-top')).to_contain_text('ОБЗОР / ' + name)
        expect(page.locator('.feature-list li')).to_have_count(3)
        page.keyboard.press('b')
        expect(page.locator('.screen-top')).to_contain_text('ПРОЕКТ / ' + name)
        page.keyboard.press('Escape')
        expect(page.locator('.project-row.is-selected')).to_contain_text(name)
        page.keyboard.press('ArrowDown')
        record('Keyboard: ' + name + ' project, overview, B/Escape nested return')
    page.keyboard.press('Escape')
    expect(page.locator('.menu-item.is-selected')).to_contain_text('ПРОЕКТЫ')

    page.keyboard.press('ArrowDown')
    page.keyboard.press('Enter')
    for name in ['Лендинг', 'Многостраничный сайт', 'Веб-приложение']:
        expect(page.locator('.price-row.is-selected')).to_contain_text(name)
        page.keyboard.press('Enter')
        expect(page.locator('.screen-title')).to_have_text(name)
        page.keyboard.press('ArrowDown')
        page.keyboard.press('a')
        expect(page.locator('.screen-top')).to_contain_text('КОНТАКТЫ')
        expect(page.locator('[data-screen-action="external"]')).to_have_attribute('data-url', 'https://t.me/wangock')
        page.keyboard.press('b')
        expect(page.locator('.screen-title')).to_have_text(name)
        page.keyboard.press('b')
        expect(page.locator('.price-row.is-selected')).to_contain_text(name)
        page.keyboard.press('ArrowDown')
        record('Keyboard: pricing ' + name + ', inquiry contacts and return')
    page.keyboard.press('Escape')
    page.keyboard.press('ArrowDown')
    page.keyboard.press('Enter')
    expect(page.locator('.screen-top')).to_contain_text('КОНТАКТЫ')
    page.keyboard.press('ArrowDown')
    page.keyboard.press('a')
    expect(page.locator('.screen-toast')).to_contain_text('СКОПИРОВАНО: @wangock')
    record('Keyboard: contacts and HTTP-compatible copy button')

    page.keyboard.press('Escape')
    expect(page.locator('.menu-item.is-selected')).to_contain_text('КОНТАКТЫ')
    page.keyboard.press('ArrowDown')
    page.keyboard.press('Enter')
    expect(page.locator('.game-row')).to_have_count(2)
    expect(page.locator('.game-row.is-selected')).to_contain_text('ЗМЕЙКА')
    page.keyboard.press('Enter')
    expect(page.locator('.snake-board .game-cell')).to_have_count(144)
    page.keyboard.press('Enter')
    page.screenshot(path=str(OUT / 'desktop-snake.png'), full_page=True, animations='disabled')
    page.keyboard.press('ArrowDown')
    page.keyboard.press('Escape')
    expect(page.locator('.game-message')).to_contain_text('A ПРОДОЛЖИТЬ')
    page.keyboard.press('Enter')
    expect(page.locator('.game-message')).to_contain_text('B ПАУЗА')
    page.get_by_role('button', name='SELECT — главное меню').click()
    expect(page.locator('.menu-item.is-selected')).to_contain_text('АРКАДА')
    page.keyboard.press('Enter')
    page.keyboard.press('ArrowDown')
    page.keyboard.press('Enter')
    expect(page.locator('.tetris-board .game-cell')).to_have_count(160)
    page.keyboard.press('Enter')
    page.screenshot(path=str(OUT / 'desktop-tetris.png'), full_page=True, animations='disabled')
    rotation = page.locator('.tetris-board').get_attribute('data-rotation')
    page.keyboard.press('ArrowUp')
    expect(page.locator('.tetris-board')).not_to_have_attribute('data-rotation', rotation)
    page.keyboard.press('ArrowDown')
    page.keyboard.press('Escape')
    expect(page.locator('.next-piece')).to_contain_text('ПАУЗА')
    page.keyboard.press('Enter')
    expect(page.locator('.next-piece')).to_contain_text('ИГРА')
    page.get_by_role('button', name='SELECT — главное меню').click()
    expect(page.locator('.menu-item.is-selected')).to_contain_text('АРКАДА')
    record('Keyboard: Snake and Tetris start, respond to controls, pause and return through SELECT')

    page.keyboard.press('p')
    expect(page.get_by_role('switch', name='Питание консоли')).not_to_be_checked()
    page.keyboard.press('p')
    page.keyboard.press('p')
    page.wait_for_timeout(1100)  # Specifically checks a cancelled 950 ms boot timer.
    expect(page.locator('.screen-start-label')).to_be_visible()
    page.keyboard.press('m')
    expect(page.get_by_role('button', name='Выключить звук')).to_have_attribute('aria-pressed', 'true')
    page.reload(wait_until='networkidle')
    expect(page.get_by_role('button', name='Выключить звук')).to_have_attribute('aria-pressed', 'true')
    page.keyboard.press('m')
    expect(page.get_by_role('button', name='Включить звук')).to_have_attribute('aria-pressed', 'false')
    record('Power: interrupted boot stays off. Sound: M toggle and saved preference')

    page.get_by_role('button', name='START — включить или открыть').click()
    expect(page.locator('.screen-top')).to_contain_text('PORTFOLIO OS')
    page.keyboard.press('ArrowDown')
    page.keyboard.press('Enter')
    expect(page.locator('.screen-top')).to_contain_text('ПРОЕКТЫ')
    page.get_by_role('button', name='B — назад', exact=True).click()
    page.keyboard.press('Enter')
    expect(page.locator('.screen-top')).to_contain_text('ПРОЕКТЫ')
    record('Mixed controls: mouse start and B, then arrows/Enter open the selected item')

    page.reload(wait_until='networkidle')
    page.keyboard.press('Tab')
    expect(page.get_by_role('switch', name='Питание консоли')).to_be_focused()
    page.keyboard.press('Tab')
    expect(page.get_by_role('button', name='Включить звук')).to_be_focused()
    page.keyboard.press('Enter')
    expect(page.get_by_role('button', name='Выключить звук')).to_have_attribute('aria-pressed', 'true')
    page.keyboard.press('Enter')
    expect(page.get_by_role('button', name='Включить звук')).to_have_attribute('aria-pressed', 'false')
    record('Accessibility: Tab focuses native links and buttons; Enter activates the focused sound control')

    # A real touch-enabled browser context generates touch/pointer events through tap().
    mobile = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                                 is_mobile=True, has_touch=True, locale='ru-RU', reduced_motion='reduce')
    touch = mobile.new_page()
    attach(touch)
    touch.goto(URL, wait_until='networkidle')
    assert_layout(touch, 'Mobile 390')
    touch.get_by_role('button', name='START — включить или открыть').tap()
    expect(touch.locator('.screen-top')).to_contain_text('PORTFOLIO OS')
    touch.screenshot(path=str(OUT / 'mobile-menu.png'), full_page=True, animations='disabled')
    touch.get_by_role('button', name='A — открыть', exact=True).tap()
    expect(touch.locator('.screen-title')).to_contain_text('ПРИВЕТ, Я WANGOCK')
    touch.get_by_role('button', name='Вправо', exact=True).tap()
    expect(touch.locator('.screen-title')).to_contain_text('МОЙ ПОДХОД')
    touch.get_by_role('button', name='Влево', exact=True).tap()
    expect(touch.locator('.screen-title')).to_contain_text('ПРИВЕТ, Я WANGOCK')
    touch.screenshot(path=str(OUT / 'mobile-about.png'), full_page=True, animations='disabled')
    touch.get_by_role('button', name='B — назад', exact=True).tap()
    touch.get_by_role('button', name='Вниз', exact=True).tap()
    touch.get_by_role('button', name='A — открыть', exact=True).tap()
    record('Touch: START, About, both horizontal directions, B, down and A')

    for name in ['ORBIT', 'FORMA', 'PIXEL SHOP']:
        expect(touch.locator('.project-row.is-selected')).to_contain_text(name)
        touch.get_by_role('button', name='A — открыть', exact=True).tap()
        expect(touch.locator('.screen-top')).to_contain_text('ПРОЕКТ / ' + name)
        touch.get_by_role('button', name='A — открыть', exact=True).tap()
        expect(touch.locator('.screen-top')).to_contain_text('ОБЗОР / ' + name)
        touch.get_by_role('button', name='B — назад', exact=True).tap()
        touch.get_by_role('button', name='B — назад', exact=True).tap()
        expect(touch.locator('.project-row.is-selected')).to_contain_text(name)
        touch.get_by_role('button', name='Вниз', exact=True).tap()
        record('Touch: ' + name + ' and its overview, nested B return')
    touch.get_by_role('button', name='B — назад', exact=True).tap()
    touch.get_by_role('button', name='Вниз', exact=True).tap()
    touch.get_by_role('button', name='A — открыть', exact=True).tap()
    touch.screenshot(path=str(OUT / 'mobile-pricing.png'), full_page=True, animations='disabled')
    for name in ['Лендинг', 'Многостраничный сайт', 'Веб-приложение']:
        expect(touch.locator('.price-row.is-selected')).to_contain_text(name)
        touch.get_by_role('button', name='A — открыть', exact=True).tap()
        expect(touch.locator('.screen-title')).to_have_text(name)
        touch.get_by_role('button', name='Вниз', exact=True).tap()
        touch.get_by_role('button', name='A — открыть', exact=True).tap()
        expect(touch.locator('.screen-top')).to_contain_text('КОНТАКТЫ')
        touch.get_by_role('button', name='B — назад', exact=True).tap()
        expect(touch.locator('.screen-title')).to_have_text(name)
        touch.get_by_role('button', name='B — назад', exact=True).tap()
        touch.get_by_role('button', name='Вниз', exact=True).tap()
        record('Touch: service ' + name + ', contacts and back')
    touch.get_by_role('button', name='SELECT — главное меню').tap()
    expect(touch.locator('.menu-item.is-selected')).to_contain_text('ПРАЙС')
    touch.get_by_role('button', name='Вниз', exact=True).tap()
    touch.get_by_role('button', name='A — открыть', exact=True).tap()
    touch.screenshot(path=str(OUT / 'mobile-contacts.png'), full_page=True, animations='disabled')
    touch.get_by_role('button', name='Вниз', exact=True).tap()
    touch.get_by_role('button', name='A — открыть', exact=True).tap()
    expect(touch.locator('.screen-toast')).to_contain_text('СКОПИРОВАНО: @wangock')
    touch.get_by_role('button', name='Вверх', exact=True).tap()
    expect(touch.locator('.screen-option.is-selected')).to_have_attribute('data-url', 'https://t.me/wangock')
    record('Touch: SELECT, contacts, copy and up direction')

    touch.get_by_role('button', name='B — назад', exact=True).tap()
    expect(touch.locator('.menu-item.is-selected')).to_contain_text('КОНТАКТЫ')
    touch.get_by_role('button', name='Вниз', exact=True).tap()
    touch.get_by_role('button', name='A — открыть', exact=True).tap()
    expect(touch.locator('.game-row')).to_have_count(2)
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
    touch.screenshot(path=str(OUT / 'mobile-tetris.png'), full_page=True, animations='disabled')
    touch.get_by_role('button', name='Вверх', exact=True).tap()
    touch.get_by_role('button', name='B — назад', exact=True).tap()
    expect(touch.locator('.next-piece')).to_contain_text('ПАУЗА')
    touch.get_by_role('button', name='SELECT — главное меню').tap()
    expect(touch.locator('.menu-item.is-selected')).to_contain_text('АРКАДА')
    record('Touch: Snake and Tetris respond through the physical controls')

    touch.get_by_role('switch', name='Питание консоли').tap()
    expect(touch.locator('.screen-start-label')).to_be_visible()
    lcd_box = touch.locator('.lcd').bounding_box()
    touch.touchscreen.tap(lcd_box['x'] + lcd_box['width'] / 2, lcd_box['y'] + lcd_box['height'] / 2)
    expect(touch.locator('.screen-start-label')).to_be_visible()
    touch.get_by_role('button', name='START — включить или открыть').tap()
    expect(touch.locator('.screen-top')).to_contain_text('PORTFOLIO OS')
    row_box = touch.locator('.menu-item').filter(has_text='КОНТАКТЫ').bounding_box()
    touch.touchscreen.tap(row_box['x'] + row_box['width'] / 2, row_box['y'] + row_box['height'] / 2)
    expect(touch.locator('.screen-top')).to_contain_text('PORTFOLIO OS')
    expect(touch.locator('.menu-item.is-selected')).to_contain_text('ОБО МНЕ')
    assert touch.locator('.lcd button, .lcd a, .lcd [tabindex]').count() == 0
    record('LCD is output only: tapping the off screen or menu does nothing; no focusable screen elements')
    touch.get_by_role('button', name='Вверх', exact=True).tap()
    touch.get_by_role('button', name='Вверх', exact=True).tap()
    touch.get_by_role('button', name='A — открыть', exact=True).tap()
    expect(touch.locator('.screen-top')).to_contain_text('КОНТАКТЫ')
    assert touch.locator('.screen-main').evaluate('(el) => el.scrollHeight <= el.clientHeight'), 'Contacts should show both actions without scrolling'
    mobile.route('https://t.me/wangock', lambda route: route.fulfill(status=200, content_type='text/html', body='<p>Telegram navigation test</p>'))
    with touch.expect_popup() as opened:
        touch.get_by_role('button', name='A — открыть', exact=True).tap()
    popup = opened.value
    expect(popup).to_have_url('https://t.me/wangock')
    popup.close()
    record('Touch: A opens the selected Telegram URL in a new tab')
    touch.get_by_role('button', name='B — назад', exact=True).tap()
    expect(touch.locator('.menu-item.is-selected')).to_contain_text('КОНТАКТЫ')
    touch.get_by_role('button', name='Включить звук').tap()
    expect(touch.get_by_role('button', name='Выключить звук')).to_have_attribute('aria-pressed', 'true')
    touch.get_by_role('button', name='Выключить звук').tap()
    record('Touch: physical power, START, B and SOUND controls')

    for width, height in [(320, 740), (360, 800), (768, 1024), (1024, 768)]:
        responsive = browser.new_context(viewport={'width': width, 'height': height}, has_touch=width < 800,
                                         is_mobile=width < 800, locale='ru-RU', reduced_motion='reduce')
        check = responsive.new_page()
        attach(check)
        check.goto(URL, wait_until='networkidle')
        check.get_by_role('button', name='START — включить или открыть').click()
        expect(check.locator('.screen-top')).to_contain_text('PORTFOLIO OS')
        assert_layout(check, f'Responsive {width}x{height}')
        assert check.locator('.screen-main').evaluate('(el) => el.scrollHeight <= el.clientHeight'), 'All five menu choices must fit'
        check.get_by_role('button', name='A — открыть', exact=True).click()
        expect(check.locator('.screen-title')).to_contain_text('ПРИВЕТ')
        assert check.locator('.screen-main').evaluate('(el) => el.scrollHeight <= el.clientHeight'), 'About page must be fully readable'
        check.get_by_role('button', name='Вправо', exact=True).click()
        expect(check.locator('.screen-title')).to_contain_text('МОЙ ПОДХОД')
        assert check.locator('.screen-main').evaluate('(el) => el.scrollHeight <= el.clientHeight'), 'Second About page must be fully readable'
        check.get_by_role('button', name='B — назад', exact=True).click()
        if width in [320, 768]:
            check.screenshot(path=str(OUT / f'responsive-{width}.png'), full_page=True, animations='disabled')
        responsive.close()

    assert errors == [], 'Browser errors: ' + json.dumps(errors, ensure_ascii=False)
    record('No JavaScript exceptions or console resource errors across all browsers')
    (OUT / 'results.json').write_text(json.dumps({'url': URL, 'passed': results, 'errors': errors}, ensure_ascii=False, indent=2))
    print(json.dumps({'passed': len(results), 'errors': errors, 'artifacts': str(OUT)}, ensure_ascii=False), flush=True)
    browser.close()
