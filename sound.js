const soundNames = ['move', 'confirm', 'back', 'boot', 'off'];

// Native media playback starts directly in the click/keydown gesture. It avoids
// Safari's suspended/interrupted AudioContext and works in embedded iOS browsers.
export class ButtonSounds {
  constructor(container, onError) {
    this.container = container;
    this.onError = onError;
    this.enabled = false;
    this.clips = new Map();
    this.current = null;
    this.request = 0;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) this.stop();
  }

  prepare() {
    if (this.clips.size) return;
    for (const name of soundNames) {
      const clip = document.createElement('audio');
      clip.src = new URL(`./assets/sounds/${name}.wav`, import.meta.url).href;
      clip.preload = 'auto';
      clip.hidden = true;
      clip.setAttribute('playsinline', '');
      clip.setAttribute('aria-hidden', 'true');
      this.container.append(clip);
      this.clips.set(name, clip);
    }
  }

  stop() {
    ++this.request;
    if (this.current) {
      this.current.pause();
      this.current = null;
    }
  }

  play(kind = 'move') {
    if (!this.enabled || document.hidden) return;
    this.prepare();
    this.stop();
    const clip = this.clips.get(kind) ?? this.clips.get('move');
    const request = this.request;
    this.current = clip;
    const failed = error => {
      // Rapid presses and muting intentionally cancel the previous play request.
      if (request !== this.request || error.name === 'AbortError') return;
      this.stop();
      for (const media of this.clips.values()) media.remove();
      this.clips.clear();
      this.onError?.(error);
    };
    try {
      // Seek only when replaying a used clip. Consecutive zero-time seeks during
      // pause/play can leave WebKit waiting for a seek that has been superseded.
      try { if (clip.currentTime > 0) clip.currentTime = 0; } catch { /* A fresh clip already starts at zero. */ }
      // Do not await a fetch, timer or AudioContext.resume() before play(): iOS
      // requires this call to remain in the original user activation handler.
      clip.play()?.catch(failed);
    } catch (error) { failed(error); }
  }
}
