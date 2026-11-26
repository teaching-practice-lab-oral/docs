// Demo player: plays recreated system screens scene by scene.
// Auto mode: a pointer performs each click/typing beat by itself.
// Manual mode: entered as soon as the viewer clicks inside the screen; the next
// clickable element is outlined and the scene waits for the viewer. After a
// period with no interaction the player returns to auto mode.

const DESIGN_W = 900;
const DESIGN_H = 600;
const IDLE_MS = 20000;
const HOLD_AUTO_MS = 3500;
const TEXT_W = 300; // text column beside the screen on the page
const FS_TEXT_W = 260; // narrower text column in fullscreen
const GAP = 28;

export class Cancelled extends Error {}

export type SceneScript = (ctx: Ctx) => Promise<void>;
export type ScriptMap = Record<string, SceneScript>;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface Ctx {
  $: (sel: string) => HTMLElement;
  $$: (sel: string) => HTMLElement[];
  wait: (ms: number) => Promise<void>;
  /** A click the student/teacher would make. */
  click: (sel: string | HTMLElement) => Promise<void>;
  /** Click into a field, then type its data-text. */
  type: (sel: string, opts?: { cps?: number; focus?: boolean }) => Promise<void>;
  /** Show a hidden element and keep it in view. */
  reveal: (sel: string | HTMLElement, opts?: { follow?: boolean }) => Promise<void>;
  hide: (sel: string | HTMLElement) => void;
  follow: (sel: string | HTMLElement, align?: 'bottom' | 'top') => Promise<void>;
  /** Run fn every frame for durationMs of (pausable) scene time; fn gets 0..1. */
  tween: (durationMs: number, fn: (p: number) => void) => Promise<void>;
  toast: (text: string, ms?: number) => Promise<void>;
}

export function mountAll(scripts: ScriptMap) {
  document.querySelectorAll<HTMLElement>('[data-demo]').forEach((root) => new Player(root, scripts));
}

class Player {
  root: HTMLElement;
  name: string;
  scripts: ScriptMap;
  templates: HTMLTemplateElement[];
  tabs: HTMLButtonElement[];
  texts: HTMLElement[];
  frame: HTMLElement;
  scaler: HTMLElement;
  scroll: HTMLElement;
  cursor: HTMLElement;
  statusEl: HTMLElement;
  playBtn: HTMLButtonElement;
  index = 0;
  epoch = 0;
  scale = 1;
  mode: 'auto' | 'manual' = 'auto';
  userPaused = false;
  offscreen = true;
  started = false;
  lastClick: HTMLElement | null = null;
  /** The element the current click beat is waiting for. */
  pending: HTMLElement | null = null;
  idleTimer = 0;
  hintTimer = 0;
  hintEl: HTMLElement;
  badgeEl: HTMLElement;

  constructor(root: HTMLElement, scripts: ScriptMap) {
    this.root = root;
    this.name = root.dataset.demo!;
    this.scripts = scripts;
    this.templates = [...root.querySelectorAll<HTMLTemplateElement>('template[data-scene]')];
    this.tabs = [...root.querySelectorAll<HTMLButtonElement>('[data-tab]')];
    this.texts = [...root.querySelectorAll<HTMLElement>('[data-text-for]')];
    this.frame = root.querySelector('.demo-frame')!;
    this.scaler = root.querySelector('.demo-scaler')!;
    this.scroll = root.querySelector('.demo-scroll')!;
    this.cursor = root.querySelector('.demo-cursor')!;
    this.statusEl = root.querySelector('[data-status]')!;
    this.playBtn = root.querySelector('[data-act="play"]')!;
    this.hintEl = root.querySelector('.demo-hint')!;
    this.badgeEl = root.querySelector('.demo-badge')!;
    // Every demo opens on a start screen that offers fullscreen first.
    this.userPaused = true;
    root.classList.add('is-intro');
    if (!document.fullscreenEnabled) root.classList.add('no-fs');
    root.querySelector('.demo-overlay')!.addEventListener('click', () => this.setUserPaused(false));
    root.querySelector('[data-act="start-fs"]')!.addEventListener('click', () => {
      this.endIntro();
      if (!document.fullscreenElement) this.toggleFullscreen();
    });
    root.querySelector('[data-act="start-play"]')!.addEventListener('click', () => this.endIntro());

    this.tabs.forEach((t, i) => t.addEventListener('click', () => this.go(i)));
    root.querySelector('[data-act="prev"]')!.addEventListener('click', () => this.go(this.index - 1));
    root.querySelector('[data-act="next"]')!.addEventListener('click', () => this.go(this.index + 1));
    this.playBtn.addEventListener('click', () => this.setUserPaused(!this.userPaused));
    root.querySelectorAll('[data-act="fullscreen"]').forEach((b) => b.addEventListener('click', () => {
      this.endIntro();
      this.toggleFullscreen();
    }));
    root.querySelector('[data-act="restart"]')?.addEventListener('click', () => this.go(this.index));

    // Taking over: any press inside the screen.
    this.frame.addEventListener('pointerdown', (e) => {
      const hit = e.target as HTMLElement;
      if (hit.closest('.demo-overlay, .demo-start')) return;
      e.preventDefault();
      this.takeOver();
      this.press(hit);
    });
    this.frame.addEventListener('wheel', () => this.mode === 'manual' && this.touch(), { passive: true });
    this.frame.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      this.takeOver();
      if (this.pending) this.lastClick = this.pending;
    });

    new ResizeObserver(() => this.fit()).observe(this.root);
    document.addEventListener('fullscreenchange', () => {
      const fs = document.fullscreenElement === this.root;
      root.querySelectorAll('[data-fs-label]').forEach((l, i) => {
        l.textContent = fs ? '離開全螢幕' : i === 0 ? '全螢幕觀看' : '全螢幕';
      });
      this.fit();
    });
    window.addEventListener('resize', () => this.fit());
    new IntersectionObserver(
      ([entry]) => {
        this.offscreen = !entry.isIntersecting;
        if (!this.offscreen && !this.started) { this.started = true; this.go(0); }
        this.updateStatus();
      },
      { threshold: 0.35 },
    ).observe(this.frame);
    document.addEventListener('visibilitychange', () => this.updateStatus());
    this.fit();
    this.updateStatus();
  }

  // A method (not a field read) so TypeScript does not narrow it across awaits.
  isAuto() {
    return this.mode === 'auto';
  }

  /** A viewer press inside the screen: counts if it lands on the awaited element, otherwise explains. */
  press(hit: HTMLElement) {
    if (this.pending && (this.pending === hit || this.pending.contains(hit))) {
      this.lastClick = this.pending;
      return;
    }
    this.hint(this.pending ? '請點框起來的地方繼續' : '示範進行中，請稍候');
  }

  hint(text: string) {
    this.hintEl.textContent = text;
    this.hintEl.hidden = false;
    clearTimeout(this.hintTimer);
    this.hintTimer = window.setTimeout(() => (this.hintEl.hidden = true), 1800);
  }

  get paused() {
    return this.userPaused || this.offscreen || document.hidden;
  }

  fit() {
    const fs = document.fullscreenElement === this.root;
    const stacked = !fs && window.matchMedia('(max-width: 1100px)').matches;
    let w: number;
    let h: number;
    if (fs) {
      // Fullscreen: a narrow text column, the screen gets everything else.
      const tabs = this.root.querySelector<HTMLElement>('.demo-tabs')!.offsetHeight;
      const controls = this.root.querySelector<HTMLElement>('.demo-controls')!.offsetHeight;
      w = window.innerWidth - 2 * GAP - FS_TEXT_W - GAP;
      h = window.innerHeight - tabs - controls - 14 - 10 - 2 * 20;
    } else {
      // Page: the screen takes what is left after the text column (which absorbs
      // any width the screen cannot use), and always fits in the window height.
      w = stacked ? this.frame.parentElement!.clientWidth : this.root.clientWidth - TEXT_W - GAP;
      h = window.innerHeight - 150;
    }
    const s = Math.max(0.3, Math.min(w / DESIGN_W, h / DESIGN_H));
    if (fs) {
      const total = FS_TEXT_W + GAP + DESIGN_W * s;
      this.root.style.setProperty('--fs-pad', `${Math.max(GAP, (window.innerWidth - total) / 2)}px`);
    }
    this.scale = s;
    this.scaler.style.transform = `scale(${s})`;
    this.frame.style.width = `${DESIGN_W * s}px`;
    this.frame.style.height = `${DESIGN_H * s}px`;
  }

  toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else this.root.requestFullscreen?.();
  }

  setUserPaused(p: boolean) {
    this.userPaused = p;
    this.updateStatus();
  }

  endIntro() {
    this.root.classList.remove('is-intro');
    this.setUserPaused(false);
  }

  takeOver() {
    this.root.classList.remove('is-intro');
    this.userPaused = false;
    if (this.mode !== 'manual') {
      this.mode = 'manual';
      this.cursor.classList.add('is-off');
    }
    this.touch();
    this.updateStatus();
  }

  touch() {
    clearTimeout(this.idleTimer);
    this.idleTimer = window.setTimeout(() => {
      this.mode = 'auto';
      this.cursor.classList.remove('is-off');
      this.updateStatus();
    }, IDLE_MS);
  }

  updateStatus() {
    const label = this.root.classList.contains('is-intro')
      ? '選擇全螢幕觀看，或在頁面中播放'
      : this.userPaused
        ? '已暫停'
      : this.mode === 'manual'
        ? '你正在操作：點選畫面上框起來的地方'
        : '自動播放中：點一下畫面即可自己操作';
    this.statusEl.textContent = label;
    const badge = this.userPaused ? '已暫停' : this.mode === 'manual' ? '操作中' : '自動播放中・點畫面可自己操作';
    if (this.badgeEl.textContent !== badge) {
      // Show briefly, then fade so it never hides the screen for long.
      this.badgeEl.textContent = badge;
      this.badgeEl.classList.remove('is-shown');
      void this.badgeEl.offsetWidth;
      this.badgeEl.classList.add('is-shown');
    }
    this.playBtn.setAttribute('aria-pressed', String(this.userPaused));
    this.playBtn.querySelector('[data-label]')!.textContent = this.userPaused ? '播放' : '暫停';
    this.root.classList.toggle('is-manual', this.mode === 'manual');
    this.root.classList.toggle('is-paused', this.userPaused);
  }

  go(i: number) {
    const n = this.templates.length;
    this.index = ((i % n) + n) % n;
    const my = ++this.epoch;
    this.tabs.forEach((t, k) => t.setAttribute('aria-selected', String(k === this.index)));
    this.texts.forEach((t, k) => (t.hidden = k !== this.index));
    this.scroll.replaceChildren(this.templates[this.index].content.cloneNode(true));
    this.scroll.scrollTop = 0;
    this.lastClick = null;
    this.pending = null;
    this.cursor.style.transform = `translate(${DESIGN_W * 0.62}px, ${DESIGN_H * 0.8}px)`;
    const key = this.templates[this.index].dataset.scene!;
    const script = this.scripts[`${this.name}:${key}`];
    const ctx = this.makeCtx(my);
    (async () => {
      try {
        if (script) await script(ctx);
        await this.hold(my);
        this.go(this.index + 1);
      } catch (e) {
        if (!(e instanceof Cancelled)) throw e;
      }
    })();
  }

  async hold(my: number) {
    const ctx = this.makeCtx(my);
    // In manual mode, wait for the viewer (or the idle timeout) before moving on.
    while (this.mode === 'manual') await ctx.wait(200);
    await ctx.wait(HOLD_AUTO_MS);
  }

  makeCtx(my: number): Ctx {
    const self = this;
    const check = () => { if (my !== self.epoch) throw new Cancelled(); };
    const el = (s: string | HTMLElement) => {
      if (typeof s !== 'string') return s;
      const found = self.scroll.querySelector<HTMLElement>(s);
      if (!found) throw new Error(`demo: missing ${s}`);
      return found;
    };

    const wait = async (ms: number) => {
      check();
      let left = ms;
      while (left > 0) {
        const step = Math.min(left, 40);
        await sleep(step);
        check();
        if (!self.paused) left -= step;
      }
    };

    const tween = async (ms: number, fn: (p: number) => void) => {
      check();
      let t = 0;
      let last = performance.now();
      while (t < ms) {
        await new Promise(requestAnimationFrame);
        check();
        const now = performance.now();
        if (!self.paused) t += Math.min(now - last, 100);
        last = now;
        fn(Math.min(t / ms, 1));
      }
    };

    const posOf = (target: HTMLElement) => {
      const a = target.getBoundingClientRect();
      const b = self.scaler.getBoundingClientRect();
      return { x: (a.left - b.left) / self.scale, y: (a.top - b.top) / self.scale, w: a.width / self.scale, h: a.height / self.scale };
    };

    const follow = async (s: string | HTMLElement, align: 'bottom' | 'top' = 'bottom') => {
      const target = el(s);
      const sc = self.scroll;
      const p = posOf(target);
      const viewH = DESIGN_H;
      let dest = sc.scrollTop;
      if (align === 'top' || p.h > viewH - 80) dest = sc.scrollTop + p.y - 70;
      else if (p.y + p.h > viewH - 30) dest = sc.scrollTop + (p.y + p.h) - (viewH - 30);
      else if (p.y < 60) dest = sc.scrollTop + p.y - 70;
      dest = Math.max(0, Math.min(dest, sc.scrollHeight - sc.clientHeight));
      if (Math.abs(dest - sc.scrollTop) < 2) return;
      const from = sc.scrollTop;
      await tween(Math.min(900, 300 + Math.abs(dest - from)), (q) => {
        const e = q < 0.5 ? 2 * q * q : 1 - Math.pow(-2 * q + 2, 2) / 2;
        sc.scrollTop = from + (dest - from) * e;
      });
    };

    const moveCursor = async (target: HTMLElement) => {
      const p = posOf(target);
      self.cursor.style.transform = `translate(${p.x + Math.min(p.w * 0.5, 60)}px, ${p.y + p.h * 0.55}px)`;
      await wait(700);
    };

    const press = async (target: HTMLElement) => {
      target.classList.add('is-pressed');
      self.cursor.classList.add('is-clicking');
      await wait(180);
      target.classList.remove('is-pressed');
      self.cursor.classList.remove('is-clicking');
    };

    const click = async (s: string | HTMLElement) => {
      const target = el(s);
      self.pending = target;
      self.lastClick = null;
      try {
        await follow(target);
        await clickLoop(target);
      } finally {
        if (self.pending === target) self.pending = null;
      }
    };

    const clickLoop = async (target: HTMLElement) => {
      for (;;) {
        check();
        if (self.lastClick === target) { self.lastClick = null; await press(target); return; }
        if (self.isAuto()) {
          await moveCursor(target);
          if (self.isAuto() || self.lastClick === target) { self.lastClick = null; await press(target); return; }
          continue;
        }
        target.classList.add('demo-target');
        let result: 'clicked' | 'auto' | null = null;
        try {
          while (!result) {
            await sleep(40);
            check();
            if (self.lastClick === target) result = 'clicked';
            else if (self.isAuto()) result = 'auto';
          }
        } finally {
          target.classList.remove('demo-target');
        }
        if (result === 'clicked') { self.lastClick = null; await press(target); return; }
      }
    };

    const type = async (s: string, opts: { cps?: number; focus?: boolean } = {}) => {
      const field = el(s);
      const text = field.dataset.text ?? '';
      if (opts.focus !== false) await click(field);
      field.classList.add('is-focused');
      const caret = document.createElement('span');
      caret.className = 'caret';
      const cps = opts.cps ?? 28;
      {
        const node = document.createTextNode('');
        field.replaceChildren(node, caret);
        // Type a few characters per tick so long answers stay watchable.
        const per = Math.max(1, Math.round(cps / 25));
        for (let i = 0; i < text.length; i += per) {
          node.data = text.slice(0, i + per);
          await wait(1000 / 25);
          if (field.scrollHeight > 0) await maybeFollow(field);
        }
        node.data = text;
        caret.remove();
      }
      field.classList.remove('is-focused');
    };

    let lastFollow = 0;
    const maybeFollow = async (field: HTMLElement) => {
      const now = performance.now();
      if (now - lastFollow < 400) return;
      lastFollow = now;
      const p = posOf(field);
      if (p.y + p.h > DESIGN_H - 30) await follow(field);
    };

    const reveal = async (s: string | HTMLElement, opts: { follow?: boolean } = {}) => {
      const target = el(s);
      target.classList.remove('is-hidden');
      target.classList.add('demo-in');
      if (opts.follow !== false) await follow(target);
    };

    const hide = (s: string | HTMLElement) => el(s).classList.add('is-hidden');

    const toast = async (text: string, ms = 2200) => {
      const t = document.createElement('div');
      t.className = 'toast demo-in';
      t.textContent = text;
      self.scaler.appendChild(t);
      try { await wait(ms); } finally { t.remove(); }
    };

    return {
      $: (s) => el(s),
      $$: (s) => [...self.scroll.querySelectorAll<HTMLElement>(s)],
      wait, click, type, reveal, hide, follow, tween, toast,
    };
  }
}
