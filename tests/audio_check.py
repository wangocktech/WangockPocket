"""Native audio regression checks on Chromium and WebKit, including touch input.

PORTFOLIO_URL may point at the isolated candidate server on the VPS.
This verifies decoded media playback; it cannot measure a physical iPhone speaker.
"""
import io
import json
import math
import os
import struct
import wave
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

URL = os.environ.get('PORTFOLIO_URL', 'https://wangock.tech')
OUT = Path(os.environ.get('PORTFOLIO_RESULTS', '/tmp/wangock-audio-results'))
OUT.mkdir(parents=True, exist_ok=True)
results = []

INSTRUMENT = '''
window.mediaEvents = [];
window.mediaCalls = [];
window.mediaFailures = [];
for (const type of ['playing', 'ended', 'error']) {
  document.addEventListener(type, event => {
    if (!(event.target instanceof HTMLMediaElement)) return;
    window.mediaEvents.push({type, src: event.target.currentSrc, time: event.target.currentTime,
      muted: event.target.muted, volume: event.target.volume, error: event.target.error?.code});
  }, true);
}
const nativePlay = HTMLMediaElement.prototype.play;
HTMLMediaElement.prototype.play = function() {
  window.mediaCalls.push({src: this.src, activeGesture: navigator.userActivation?.isActive});
  if (window.rejectNextMediaPlay) {
    window.rejectNextMediaPlay = false;
    return Promise.reject(new DOMException('Simulated browser interruption', 'NotAllowedError'));
  }
  const result = nativePlay.call(this);
  result?.catch(error => window.mediaFailures.push(error.name));
  return result;
};
window.addEventListener('unhandledrejection', event => window.mediaFailures.push('unhandled: ' + event.reason));
'''


def record(engine, name):
    results.append({'browser': engine, 'check': name})
    print('PASS ' + engine + ': ' + name, flush=True)


def play_effect(page, selector, name, method='tap'):
    previous = page.evaluate('mediaEvents.length')
    if method == 'keyboard':
        page.keyboard.press(selector)
    else:
        getattr(page.locator(selector), method)()
    try:
        page.wait_for_function('''({previous, name}) => mediaEvents.slice(previous).some(event =>
          event.type === 'ended' && event.src.endsWith('/' + name + '.wav') && event.time > .05
          && !event.muted && event.volume > 0)''', arg={'previous': previous, 'name': name}, timeout=10000)
    except Exception:
        print(json.dumps(page.evaluate('''({selector, name}) => ({selector, name, events: mediaEvents,
          calls: mediaCalls, failures: mediaFailures, hidden: document.hidden,
          power: document.querySelector('#console').dataset.power,
          audio: Array.from(document.querySelectorAll('audio')).map(a => ({src: a.src,
            time: a.currentTime, duration: a.duration, ended: a.ended, paused: a.paused,
            seeking: a.seeking, ready: a.readyState, error: a.error?.code}))})''',
          {'selector': selector, 'name': name})), flush=True)
        raise
    assert page.evaluate('mediaCalls.at(-1).activeGesture !== false'), 'Playback escaped the input gesture'


with sync_playwright() as playwright:
    for engine in os.environ.get('PORTFOLIO_BROWSERS', 'chromium,webkit').split(','):
        browser = getattr(playwright, engine).launch(headless=True, args=['--no-sandbox'] if engine == 'chromium' else [])
        context = browser.new_context(viewport={'width': 390, 'height': 844}, has_touch=True,
                                      is_mobile=True, locale='ru-RU')
        context.add_init_script(INSTRUMENT)
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(URL, wait_until='networkidle')
        expect(page.locator('#sound-toggle')).to_have_attribute('aria-pressed', 'false')
        assert page.evaluate('mediaCalls.length') == 0
        assert page.locator('audio').count() == 0
        record(engine, 'No audio or hidden autoplay on initial load')

        # Validate the actual production bytes, not just an enabled SOUND LED.
        for name in ['move', 'confirm', 'back', 'boot', 'off']:
            response = context.request.get(URL + '/assets/sounds/' + name + '.wav')
            assert response.status == 200, (name, response.status)
            assert 'audio/' in response.headers['content-type'], response.headers
            with wave.open(io.BytesIO(response.body())) as wav:
                assert wav.getnchannels() == 1 and wav.getsampwidth() == 2
                samples = struct.unpack('<' + 'h' * wav.getnframes(), wav.readframes(wav.getnframes()))
                rms = math.sqrt(sum(value * value for value in samples) / len(samples)) / 32768
                assert .02 < rms < .3, (name, rms)
        record(engine, 'All five sound assets decode to audible, unclipped PCM samples')

        play_effect(page, '#sound-toggle', 'confirm')
        expect(page.locator('#sound-toggle')).to_have_attribute('aria-pressed', 'true')
        play_effect(page, '#button-start', 'boot')
        expect(page.locator('.menu-item')).to_have_count(5)
        play_effect(page, '[data-control="down"]', 'move')
        play_effect(page, '#button-a', 'confirm')
        play_effect(page, '#button-b', 'back')
        play_effect(page, '#power-toggle', 'off')
        record(engine, 'Touch starts and completes all five native sound effects')

        play_effect(page, '#button-start', 'boot')
        expect(page.locator('.menu-item')).to_have_count(5)
        for _ in range(8):
            page.locator('[data-control="right"]').tap()
        play_effect(page, '[data-control="left"]', 'move')
        page.wait_for_function('Array.from(document.querySelectorAll("audio")).every(audio => audio.paused || audio.ended)')
        record(engine, 'Rapid repeated presses recover without overlapping or queued audio')

        page.locator('#power-toggle').tap()
        page.locator('#button-start').tap()
        page.locator('#sound-toggle').tap()
        expect(page.locator('#sound-toggle')).to_have_attribute('aria-pressed', 'false')
        assert page.locator('audio').evaluate_all('(clips) => clips.every(clip => clip.paused)')
        calls = page.evaluate('mediaCalls.length')
        expect(page.locator('.menu-item')).to_have_count(5)
        page.locator('[data-control="down"]').tap()
        assert page.evaluate('mediaCalls.length') == calls
        record(engine, 'SOUND off cancels playback immediately and suppresses future button sounds')

        play_effect(page, '#sound-toggle', 'confirm')
        page.reload(wait_until='networkidle')
        expect(page.locator('#sound-toggle')).to_have_attribute('aria-pressed', 'true')
        assert page.evaluate('mediaCalls.length') == 0
        play_effect(page, '#button-start', 'boot')
        expect(page.locator('.menu-item')).to_have_count(5)
        play_effect(page, 'ArrowDown', 'move', 'keyboard')
        play_effect(page, 'Enter', 'confirm', 'keyboard')
        play_effect(page, 'Escape', 'back', 'keyboard')
        record(engine, 'Saved preference waits for a gesture; keyboard audio remains functional')

        # Emulate page lifecycle only, without faking media playback or decoding.
        page.locator('#power-toggle').tap()
        page.locator('#button-start').tap()
        page.evaluate('''() => {
          Object.defineProperty(document, 'hidden', {configurable: true, value: true});
          document.dispatchEvent(new Event('visibilitychange'));
        }''')
        assert page.locator('audio').evaluate_all('(clips) => clips.every(clip => clip.paused)')
        page.evaluate('''() => {
          delete document.hidden;
          document.dispatchEvent(new Event('visibilitychange'));
        }''')
        expect(page.locator('.menu-item')).to_have_count(5)
        play_effect(page, '[data-control="down"]', 'move')
        page.evaluate('window.dispatchEvent(new PageTransitionEvent("pagehide"))')
        assert page.locator('audio').evaluate_all('(clips) => clips.every(clip => clip.paused)')
        play_effect(page, '[data-control="up"]', 'move')
        record(engine, 'Background/pagehide stops sound; the next foreground tap plays again')

        # Real navigation away/back exercises restoration, in addition to lifecycle events.
        page.goto('about:blank')
        page.go_back(wait_until='networkidle')
        expect(page.locator('#sound-toggle')).to_have_attribute('aria-pressed', 'true')
        if page.locator('#console').get_attribute('data-power') == 'off':
            play_effect(page, '#button-start', 'boot')
        expect(page.locator('.menu-item')).to_have_count(5)
        play_effect(page, '[data-control="down"]', 'move')
        record(engine, 'Playback resumes after navigating away and back')

        page.evaluate('window.rejectNextMediaPlay = true')
        page.locator('[data-control="down"]').tap()
        expect(page.locator('#sound-toggle')).to_have_attribute('aria-pressed', 'false')
        expect(page.locator('.screen-toast')).to_be_visible()
        play_effect(page, '#sound-toggle', 'confirm')
        expect(page.locator('#sound-toggle')).to_have_attribute('aria-pressed', 'true')
        record(engine, 'A blocked play request shows an accurate sound state and retries on SOUND')

        assert page.locator('.direction svg').count() == 4
        assert page.locator('.direction').all_text_contents() == ['', '', '', '']
        assert page.locator('.menu-item .cursor svg').count() == 5
        assert not page.locator('#console').evaluate("el => /[\\u25b6\\u25c0\\u2197\\ufe0f]/u.test(el.textContent)")
        page.locator('#button-select').tap()
        page.screenshot(path=str(OUT / (engine + '-mobile.png')), full_page=True, animations='disabled')
        record(engine, 'D-pad and screen arrows are SVG shapes with no emoji text')

        assert errors == [], errors
        assert page.evaluate('mediaEvents.every(event => event.type !== "error")')
        failures = page.evaluate('mediaFailures.filter(name => name !== "AbortError")')
        assert failures == [], failures
        record(engine, 'No media decoder errors or unhandled playback failures')
        (OUT / (engine + '-media.json')).write_text(json.dumps(page.evaluate('({events: mediaEvents, calls: mediaCalls})'), indent=2))
        browser.close()
    (OUT / 'results.json').write_text(json.dumps(results, indent=2))
    print(json.dumps({'passed': len(results), 'artifacts': str(OUT)}), flush=True)
