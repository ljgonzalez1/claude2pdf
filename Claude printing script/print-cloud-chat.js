/*
 * Claude2PDF v9 — automatic, permission-free, browser-console PDF export.
 * Edit the options in the call at the END of this file, then paste the
 * entire file into DevTools Console while a Claude chat is open.
 * Printing starts automatically after pasting and pressing Enter.
 *
 * Help (after loading):     printClaudePDF.help();
 * Validate (after loading): printClaudePDF.validate({ page: 'A4', retries: 2 });
 * Cancel an active scan:    cancelClaudePDF();
 *
 * Defaults: portrait A4, white page, 5 mm margins, one H1 title.
 * IMPORTANT: Browser-generated headers, footers and page numbers must be
 * disabled manually in the print dialog (More settings > Headers and footers).
 * Never requests screen sharing, screen recording, or display capture.
 * Same-origin artifact frames can be frozen from their rendered DOM; cross-
 * origin artifact frames must rely on the browser's native iframe printing.
 * A pixel-perfect snapshot of every interactive artifact is not guaranteed.
 * No third-party JS libraries or additional data-upload services are used.
 */
(() => {
  'use strict';
  const CONFIG = Object.freeze({
    page: 'A4',
    margin: '5mm',
    landscape: false,
    theme: 'light',
    title: true,
    showMessageRoles: true,
    copySiteStyles: true,
    scan: true,
    scrollDelay: 250,
    retries: 3,
    maxScrollSteps: 18000,
    expand: true,
    expandDelay: 300,
    expandWait: 1500,
    expandRetries: 3,
    maxExpansionClicks: 18000,
    captureArtifacts: true,
    artifactWait: 850,
    maxArtifactPreviews: 400,
    allowPartial: false,
    printAutomatically: true,
    imageWait: 14000,
    debug: false
  });

  const integer = (min, max) => value =>
    Number.isSafeInteger(value) && value >= min && value <= max;
  const boolean = value => typeof value === 'boolean';
  // CSS page margins: 1 to 4 explicit non-negative lengths, or literal 0.
  const marginLength = '(?:0|(?:\\d+(?:\\.\\d+)?|\\.\\d+)(?:mm|cm|pt|in|px))';
  const marginRE = new RegExp(`^${marginLength}(?:\\s+${marginLength}){0,3}$`, 'i');

  // This map is the single source of truth for validation and console help.
  const SPEC = Object.freeze({
    page: { accepted: '"A3" | "A4" | "A5" | "Letter" | "Legal"', test: v => ['A3','A4','A5','Letter','Legal'].includes(v), meaning: 'Paper size.' },
    margin: { accepted: '"0" or 1–4 nonnegative CSS lengths in mm, cm, pt, in, px (e.g. "5mm 8mm")', test: v => typeof v === 'string' && marginRE.test(v), meaning: 'Page margins in CSS top/right/bottom/left order.' },
    landscape: { accepted: 'true | false', test: boolean, meaning: 'Use landscape rather than portrait paper orientation.' },
    theme: { accepted: '"light" | "dark" | "current"', test: v => ['light','dark','current'].includes(v), meaning: 'Output color scheme; current follows Claude when available.' },
    title: { accepted: 'true | false', test: boolean, meaning: 'Add an H1 chat title before the first message.' },
    showMessageRoles: { accepted: 'true | false', test: boolean, meaning: 'Show You / Claude author labels.' },
    copySiteStyles: { accepted: 'true | false', test: boolean, meaning: 'Reuse Claude CSS where possible.' },
    scan: { accepted: 'true | false', test: boolean, meaning: 'Scroll through the conversation to collect virtualized messages.' },
    scrollDelay: { accepted: 'integer 0..10000 (milliseconds)', test: integer(0, 10000), meaning: 'Delay between scroll steps.' },
    retries: { accepted: 'integer 0..6', test: integer(0, 6), meaning: 'Additional full-history passes after the first pass.' },
    maxScrollSteps: { accepted: 'integer 1..100000', test: integer(1, 100000), meaning: 'Maximum scroll steps per pass.' },
    expand: { accepted: 'true | false', test: boolean, meaning: 'Expand nested disclosures, reasoning, tool steps and show-more sections.' },
    expandDelay: { accepted: 'integer 0..10000 (milliseconds)', test: integer(0, 10000), meaning: 'Minimum delay after an expansion click.' },
    expandWait: { accepted: 'integer 0..60000 (milliseconds)', test: integer(0, 60000), meaning: 'Wait for this much DOM quiet before looking for more nested controls or capturing a message.' },
    expandRetries: { accepted: 'integer 0..10', test: integer(0, 10), meaning: 'Additional attempts per control if a click produces no expansion progress.' },
    maxExpansionClicks: { accepted: 'integer 0..100000', test: integer(0, 100000), meaning: 'Maximum total expansion clicks.' },
    captureArtifacts: { accepted: 'true | false', test: boolean, meaning: 'Preserve accessible embedded artifact DOM in its current state; no screen-sharing permissions.' },
    artifactWait: { accepted: 'integer 0..60000 (milliseconds)', test: integer(0, 60000), meaning: 'Maximum time to allow print-tab embedded artifact frames to settle.' },
    maxArtifactPreviews: { accepted: 'integer 0..5000', test: integer(0, 5000), meaning: 'Maximum number of embedded artifact frames to preserve.' },
    allowPartial: { accepted: 'true | false', test: boolean, meaning: 'Permit automatic printing even if conversation rows are missing or the total cannot be verified.' },
    printAutomatically: { accepted: 'true | false', test: boolean, meaning: 'Open the print dialog when the capture finishes successfully.' },
    imageWait: { accepted: 'integer 0..120000 (milliseconds)', test: integer(0, 120000), meaning: 'Maximum wait for print-preview images to load.' },
    debug: { accepted: 'true | false', test: boolean, meaning: 'Enable verbose console reporting.' },
    light: { accepted: 'true | false (legacy theme alias)', test: boolean, meaning: 'Deprecated: true means light, false means dark; do not conflict with theme.' }
  });

  function shown(value) {
    try {
      const s = JSON.stringify(value);
      if (s !== undefined) return s.length > 120 ? s.slice(0, 117) + '...' : s;
    } catch (_) {}
    try { return String(value); } catch (_) { return '<unprintable value>'; }
  }

  function validateOptions(options = {}) {
    const isRecord = options !== null &&
      typeof options === 'object' &&
      !Array.isArray(options) &&
      Object.prototype.toString.call(options) === '[object Object]';
    if (!isRecord) {
      throw new TypeError(
        '[Claude PDF] Options must be a plain object. Example: ' +
        'printClaudePDF({ page: "A4", margin: "5mm", theme: "light" }).'
      );
    }

    const errors = [];
    for (const [key, value] of Object.entries(options)) {
      const rule = Object.hasOwn(SPEC, key) ? SPEC[key] : undefined;
      if (!rule) {
        const keys = Object.keys(SPEC);
        const suggestions = keys.filter(k => k.toLowerCase().includes(key.toLowerCase().slice(0, 3)));
        errors.push(`- Unknown option "${key}". ${suggestions.length ? `Did you mean: ${suggestions.join(', ')}? ` : ''}Supported options: ${keys.join(', ')}.`);
        continue;
      }
      if (!rule.test(value)) {
        const fallback = Object.hasOwn(CONFIG, key)
          ? ` Default: ${shown(CONFIG[key])}.` : '';
        errors.push(`- "${key}" = ${shown(value)}: invalid value or type. Accepted: ${rule.accepted}.${fallback}`);
      }
    }

    if (Object.hasOwn(options, 'light') &&
        Object.hasOwn(options, 'theme') &&
        (options.theme !== (options.light ? 'light' : 'dark'))) {
      errors.push('- "light" and "theme" conflict. Use only "theme", or provide matching values.');
    }
    if (errors.length) {
      throw new TypeError(`[Claude PDF] Invalid options (${errors.length}):\n${errors.join('\n')}\n` +
        'Run printClaudePDF.help() to list all accepted options.');
    }

    const result = { ...CONFIG, ...options };
    if (Object.hasOwn(options, 'light') && !Object.hasOwn(options, 'theme')) {
      result.theme = options.light ? 'light' : 'dark';
    }
    delete result.light;
    if (result.theme === 'current') {
      const mode = document.documentElement.getAttribute('data-mode');
      result.theme = mode === 'light' || mode === 'dark'
        ? mode : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    result.light = result.theme === 'light'; // internal derived flag, not a public parameter.
    return result;
  }

  function helpOptions() {
    const data = Object.entries(SPEC).map(([name, rule]) => ({
      parameter: name,
      defaultValue: Object.hasOwn(CONFIG, name) ? shown(CONFIG[name]) : '— (alias)',
      acceptedValues: rule.accepted,
      description: rule.meaning
    }));
    console.table(data);
    console.info('Usage: printClaudePDF({ page: "A4", margin: "5mm", theme: "light", retries: 2 });');
    console.info('Validate without printing: printClaudePDF.validate({ page: "A4" });');
    console.info('Note: browser-generated headers and footers must be disabled in the print dialog.');
    return data;
  }
  const LIST = '[data-testid="transcript-list"]';
  const ROW = '[data-testid="transcript-row"]';
  const delay = ms => new Promise(r => setTimeout(r, ms));
  const tick = () => Promise.race([
    new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))),
    delay(90)
  ]);
  const visible = el => {
    if (!el?.isConnected) return false;
    const s = getComputedStyle(el);
    return s.display !== 'none' && s.visibility !== 'hidden' &&
      (el.getClientRects().length > 0 || s.display === 'contents');
  };
  const log = (...a) => console.log('[Claude PDF]', ...a);
  const safeText = s => (s || '').replace(/\s+/g, ' ').trim();
  const NUM = n => Number.isInteger(n) && n >= 0;

  function rowIndex(row) {
    const n = row.getAttribute('data-rs-index') ?? row.getAttribute('data-index');
    if (n != null && /^\d+$/.test(n)) return Number(n);
    const p = row.querySelector('[aria-posinset]')?.getAttribute('aria-posinset');
    return p && /^\d+$/.test(p) ? Number(p) - 1 : null;
  }
  function rowTotal(row) {
    const size = Number(row.querySelector('[aria-setsize]')?.getAttribute('aria-setsize'));
    if (size > 0 && Number.isSafeInteger(size)) return size;
    const i = rowIndex(row), t = Number(row.getAttribute('data-perf-row-from-tail'));
    return NUM(i) && NUM(t) ? i + t + 1 : null;
  }
  function getScroll(el) {
    for (let e = el; e; e = e.parentElement) {
      const s = getComputedStyle(e);
      if (/(auto|scroll)/.test(s.overflowY) && e.scrollHeight > e.clientHeight + 12) return e;
    }
    return document.scrollingElement || document.documentElement;
  }
  function scrollToY(el, y) {
    el.scrollTop = y;
    el.dispatchEvent(new Event('scroll', { bubbles: false }));
  }
  function sourceOf(row) {
    const u = row.querySelector('[data-testid="user-message"]');
    if (u) return { kind: 'user', element: u.closest('[data-user-scope]') || u };
    const a = row.querySelector('[data-testid="assistant-message"]');
    if (a) return { kind: 'assistant', element: a.closest('[data-reply-scope]') || a };
    return null;
  }

  function rgb(value) {
    let m = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i.exec(value || '');
    if (m) return m.slice(1, 4).map(Number);
    m = /^#([\da-f]{6})$/i.exec(value || '');
    if (m) return [0, 2, 4].map(x => parseInt(m[1].slice(x, x + 2), 16));
    m = /^#([\da-f]{3})$/i.exec(value || '');
    if (m) return Array.from(m[1], x => parseInt(x + x, 16));
    return null;
  }
  function lum(c) {
    const x = c.map(v => (v /= 255) <= 0.04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
    return .2126 * x[0] + .7152 * x[1] + .0722 * x[2];
  }
  function contrast(c, bg = [255, 255, 255]) {
    const a = lum(c), b = lum(bg);
    return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
  }
  function accessibleColor(value) {
    const c = rgb(value);
    if (!c) return value;
    if (contrast(c) >= 5.0) return value;
    if (Math.max(...c) - Math.min(...c) < 24) return '#24272b';
    let lo = 0, hi = 1;
    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) / 2;
      if (contrast(c.map(v => Math.round(v * mid))) >= 5) lo = mid;
      else hi = mid;
    }
    return `rgb(${c.map(v => Math.round(v * lo)).join(',')})`;
  }

  const TOGGLE = 'button,[role="button"],[aria-expanded],[data-cds-row-toggle],[data-cds-row-toggle-stretched]';
  const REASONING = [
    '[data-cds="TurnStatus"]', '[data-cds="TurnStatusStep"]',
    '[data-testid*="thinking" i]', '[data-testid*="reasoning" i]',
    '[data-cds*="Thinking" i]', '[data-cds*="Reasoning" i]'
  ].join(',');

  function chevronVector(shape) {
    const length = shape.getTotalLength();
    if (!length) return null;
    const a = shape.getPointAtLength(0), b = shape.getPointAtLength(length / 2);
    const c = shape.getPointAtLength(length);
    const x = b.x - (a.x + c.x) / 2, y = b.y - (a.y + c.y) / 2;
    if (Math.abs(a.x - c.x) < Math.abs(x) * .25 && Math.abs(a.y - c.y) > Math.abs(x)) return [x, 0];
    if (Math.abs(a.y - c.y) < Math.abs(y) * .25 && Math.abs(a.x - c.x) > Math.abs(y)) return [0, y];
    // Filled chevrons are closed outlines: the first and last points coincide.
    // Their two arms converge at the middle; a box or play triangle does not.
    const points = Array.from({ length: 64 }, (_, i) => {
      const p = shape.getPointAtLength(length * i / 64); return [p.x, p.y];
    });
    const average = values => values.reduce((sum, value) => sum + value, 0) / values.length;
    for (const axis of [0, 1]) for (const sign of [1, -1]) {
      const along = points.map(p => p[axis] * sign), across = points.map(p => p[1 - axis]);
      const low = Math.min(...across), span = Math.max(...across) - low;
      const width = Math.max(...along) - Math.min(...along);
      if (!span || width < span * .2 || width > span) continue;
      const edgeA = [], edgeB = [], middle = [];
      points.forEach((p, i) => {
        const position = (across[i] - low) / span;
        if (position <= .15) edgeA.push(along[i]);
        if (position >= .85) edgeB.push(along[i]);
        if (Math.abs(position - .5) <= .08) middle.push(along[i]);
      });
      if (!edgeA.length || !edgeB.length || !middle.length) continue;
      if (Math.abs(average(edgeA) - average(edgeB)) < width * .3 &&
          average(middle) - Math.max(average(edgeA), average(edgeB)) > width * .45 &&
          Math.max(...middle) - Math.min(...middle) < width * .6) {
        return axis === 0 ? [sign, 0] : [0, sign];
      }
    }
    return null;
  }

  // Some Claude headers have neither aria-expanded nor an accessible label.
  // Recognize their own chevron (including a bare SVG or a rotated icon span).
  // A nested step's icon must never be mistaken for its parent's state.
  function closedChevron(control) {
    for (const icon of [control, ...control.querySelectorAll('svg,span,[data-icon],[class*="chevron" i]')]) {
      if (!visible(icon)) continue;
      const owner = icon.closest(TOGGLE);
      if (owner && owner !== control) continue;
      let vector = null, screenTransformed = false;
      const metadata = [icon.getAttribute('class'), icon.getAttribute('data-icon'),
        icon.getAttribute('data-testid'), icon.getAttribute('aria-label'),
        icon.querySelector('use')?.getAttribute('href'),
        icon.querySelector('use')?.getAttribute('xlink:href')].join(' ');
      const named = /(?:chevron|caret|triangle)[-_\s]*(right|down|left|up)/i.exec(metadata);
      const symbol = icon.childElementCount ? '' : safeText(icon.textContent);
      if (named) vector = { right: [1, 0], down: [0, 1], left: [-1, 0], up: [0, -1] }[named[1].toLowerCase()];
      else if (/^[>›❯▸▶]$/.test(symbol)) vector = [1, 0];
      else if (/^[⌄⌃˅∨▾▼]$/.test(symbol)) vector = [0, symbol === '⌃' ? -1 : 1];
      else if (icon.localName === 'svg') {
        const shapes = icon.querySelectorAll('path,polyline,line,polygon,circle,rect');
        if (shapes.length === 1 && shapes[0].matches('path,polyline')) {
          try {
            const shape = shapes[0];
            vector = chevronVector(shape);
            if (vector) {
              const matrix = shape.getScreenCTM();
              if (matrix) {
                vector = [matrix.a * vector[0] + matrix.c * vector[1], matrix.b * vector[0] + matrix.d * vector[1]];
                screenTransformed = true;
              }
            }
          } catch (_) { /* A detached or non-geometric SVG is not a chevron. */ }
        }
      }
      if (!vector) continue;
      if (icon.localName === 'svg' && !screenTransformed) {
        const m = icon.getScreenCTM();
        if (m) {
          vector = [m.a * vector[0] + m.c * vector[1], m.b * vector[0] + m.d * vector[1]];
          screenTransformed = true;
        }
      }
      // Screen CTMs include ancestor CSS transforms; do not apply them twice.
      for (let el = screenTransformed ? null : icon; el; el = el.parentElement) {
        try {
          const transform = getComputedStyle(el).transform;
          if (transform && transform !== 'none') {
            const m = new DOMMatrixReadOnly(transform), [x, y] = vector;
            vector = [m.a * x + m.c * y, m.b * x + m.d * y];
          }
        } catch (_) {}
        if (el === control) break;
      }
      const direction = getComputedStyle(control).direction === 'rtl' ? -1 : 1;
      if (vector[0] * direction > Math.abs(vector[1]) * 1.5) return true;
    }
    return false;
  }

  // Stay within the transcript. Exclude navigation, menus and file openers.
  function expandableButtons(row) {
    return [...row.querySelectorAll(`${TOGGLE},details,[onclick],[class*="cursor-pointer"]`)]
      .filter(el => {
        if (!visible(el)) return false;
        if (el.localName === 'details') return !el.open;
        if (el.closest('a[href],[role="link"],[inert],[data-testid="message-actions"],[data-testid="user-message-actions"],[data-testid="file-card-open"],[data-cds="CardLink"]') ||
            (el.hasAttribute('aria-haspopup') && el.getAttribute('aria-haspopup') !== 'false')) return false;
        const expanded = el.getAttribute('aria-expanded');
        if (expanded === 'true') return false;
        if (expanded === 'false') return true;
        const toggle = el.matches('[data-cds-row-toggle]') || el.hasAttribute('data-cds-row-toggle-stretched');
        const state = el.getAttribute('data-state') || el.getAttribute('data-expanded');
        if (toggle || (el.closest(REASONING) && el.hasAttribute('aria-controls'))) {
          if (/^(open|expanded|true)$/.test(state)) return false;
          if (/^(closed|collapsed|false)$/.test(state)) return true;
        }
        // Avoid clicking both a stretched row wrapper and its actual trigger.
        if (!el.matches('button,[role="button"]') && el.querySelector(TOGGLE)) return false;
        const label = safeText(el.getAttribute('aria-label') || el.textContent);
        if (/^(mostrar (más|todo|pasos)|ver más|expandir|desplegar|show more|view more|see more|expand all|more steps)(\b|$)/i.test(label)) {
          return el.matches(TOGGLE);
        }
        return closedChevron(el);
      });
  }
  function toggleKey(el) {
    // Include the complete DOM path: siblings and nested controls often share
    // a step/item key, a label, or even aria-controls during React rendering.
    const row = el.closest(ROW);
    const path = [];
    for (let node = el; node && node !== row; node = node.parentElement) {
      path.push(`${node.localName}:${[...node.parentElement.children].indexOf(node)}`);
    }
    return `${row ? rowIndex(row) : '?'}:${path.reverse().join('/')}`;
  }

  function liveRow(index, fallback) {
    const rows = [...(document.querySelector(LIST)?.querySelectorAll(ROW) || [])];
    return NUM(index) ? rows.find(row => rowIndex(row) === index) || null
      : fallback?.isConnected ? fallback : null;
  }

  async function settleExpansion(resolveRow, cfg, assertRunning, afterClick) {
    const start = Date.now();
    let changed = start, observed = null;
    const observer = new MutationObserver(() => { changed = Date.now(); });
    const quiet = cfg.expandWait, minimum = afterClick ? cfg.expandDelay : 0;
    // Bound continuously mutating/spinning UI; report it as incomplete.
    const maximum = Math.max(10000, quiet * 4, minimum * 2);
    try {
      do {
        assertRunning();
        const row = resolveRow();
        if (!row) return false;
        if (row !== observed) {
          observer.disconnect(); observed = row; changed = Date.now();
          observer.observe(row, { subtree: true, childList: true, characterData: true,
            attributes: true, attributeFilter: ['aria-expanded', 'aria-busy', 'aria-disabled',
              'data-state', 'data-expanded', 'open', 'hidden', 'disabled', 'class', 'style'] });
        }
        const now = Date.now();
        const busy = row.matches('[aria-busy="true"]') || !!row.querySelector('[aria-busy="true"]');
        if (!busy && now - start >= minimum && now - changed >= quiet) {
          await tick();
          // A render may have landed during the animation frames.
          if (resolveRow() === row && Date.now() - changed >= quiet) return true;
        }
        if (now - start >= maximum) return false;
        await delay(Math.max(20, Math.min(100, quiet || minimum || 20)));
      } while (true);
    } finally { observer.disconnect(); }
  }

  // Keep the dimensions of file previews, SVGs, icons, and card content.
  // Remove clipping only from known expandable or scrollable text containers.
  function applyLightStyles(node) {
    for (const el of [node, ...node.querySelectorAll('*')]) {
      if (el.hasAttribute?.('data-mode')) el.setAttribute('data-mode', 'light');
      const style = el.style;
      if (!style) continue;
      const canUnclip = el.matches([
        '[data-testid="user-message"]',
        '[data-cds="TurnStatus"]',
        '[data-cds="TurnStatusStep"]',
        '[class*="max-h-"]',
        '[class*="overflow-y-"]',
        '.code-block__code',
        'pre'
      ].join(','));
      if (canUnclip) {
        for (const property of ['max-height', 'min-height', 'mask-image', '-webkit-mask-image']) {
          style.removeProperty(property);
        }
        // Only undo explicit heights when they are text-container clipping.
        if (el.matches('[class*="max-h-"],[data-testid="user-message"],pre')) {
          style.removeProperty('height');
        }
        if (/^(hidden|clip|auto|scroll)$/.test(style.overflowY)) {
          style.removeProperty('overflow-y');
        }
      }
      if (/^(sticky|fixed)$/.test(style.position)) style.position = 'static';
      const foreground = style.color;
      if (foreground && !el.closest('svg')) {
        const parsed = rgb(foreground);
        if (parsed && contrast(parsed) < 4.5) {
          style.setProperty('color', accessibleColor(foreground), 'important');
        }
      }
      // Do not discard thumbnail backgrounds or user-selected highlights.
      const background = rgb(style.backgroundColor);
      if (background && lum(background) < .22 &&
          !el.closest('svg,figure,[data-testid="file-thumbnail"]') &&
          !el.matches('img,canvas,video')) {
        style.removeProperty('background-color');
      }
    }
  }

  // Original visual elements, including Claude's rounded file cards and SVGs.
  function cloneMessage(source, kind) {
    const cloned = source.cloneNode(true);
    const originals = source.querySelectorAll('img');
    cloned.querySelectorAll('img').forEach((img, i) => {
      const src = originals[i]?.currentSrc || originals[i]?.src;
      if (src) img.setAttribute('src', src);
      img.removeAttribute('srcset'); img.removeAttribute('sizes');
      img.setAttribute('loading', 'eager'); img.setAttribute('decoding', 'sync');
    });
    const rawCanvases = source.querySelectorAll('canvas');
    cloned.querySelectorAll('canvas').forEach((canvas, i) => {
      try {
        const image = document.createElement('img');
        image.src = rawCanvases[i].toDataURL('image/png');
        image.alt = rawCanvases[i].getAttribute('aria-label') || 'Chart';
        image.className = 'cp-snapshot';
        canvas.replaceWith(image);
      } catch (e) { /* keep canvas, marked as unavailable below */ }
    });
    cloned.querySelectorAll('script,style,noscript,video,audio,object,embed').forEach(el => {
      if (el.matches('video')) {
        const image = document.createElement('img');
        image.alt = 'Video preview';
        image.src = el.poster || '';
        if (image.src) el.replaceWith(image);
        else el.replaceWith(document.createTextNode('[Interactive video]'));
      } else if (el.matches('object,embed')) {
        const ref = document.createElement('span');
        ref.textContent = '[Embedded resource: ' + (el.getAttribute('data') || el.getAttribute('src') || '') + ']';
        el.replaceWith(ref);
      } else el.remove();
    });
    cloned.querySelectorAll([
      '[data-testid="user-message-actions"]','[data-testid="message-actions"]',
      '[data-testid="failed-send-status-region"]','[data-testid="jump-to-latest"]',
      '[role="tooltip"]','[data-cds="Tooltip"]','[data-testid="action-bar-retry"]'
    ].join(',')).forEach(el => el.remove());
    // Keep file cards in their original markup; remove only their action controls.
    cloned.querySelectorAll('button,[role="button"]').forEach(el => {
      // A role=button wrapper can contain its entire expanded panel. Preserve
      // that content instead of deleting it together with the trigger.
      if (el.localName !== 'button' && el.getAttribute('aria-expanded') === 'true' &&
          el.querySelector('p,pre,details,[role="region"],[data-cds="TurnStatusStep"]')) {
        for (const name of ['role', 'tabindex', 'onclick', 'data-cds-row-toggle', 'data-cds-row-toggle-stretched']) el.removeAttribute(name);
        return;
      }
      if (el.matches('[data-testid="file-card-open"],[data-cds="CardLink"]')) {
        el.removeAttribute('role'); el.removeAttribute('tabindex');
        return;
      }
      const desc = safeText(el.textContent || el.getAttribute('aria-label'));
      if (el.closest('[data-testid="file-card-block"]') && desc.length > 14) {
        const span = document.createElement('span'); span.textContent = desc;
        el.replaceWith(span);
      } else el.remove();
    });
    cloned.querySelectorAll('input,select,textarea').forEach(el => {
      const content = document.createElement('span');
      content.textContent = el.value || '';
      el.replaceWith(content);
    });
    cloned.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'));
    cloned.querySelectorAll('details').forEach(el => el.open = true);
    cloned.querySelectorAll('iframe').forEach(f => {
      // Keep embedded pages for browser printing; no display capture is used.
      f.loading = 'eager';
      f.setAttribute('data-cp-iframe', '');
    });
    cloned.querySelectorAll('a[href]').forEach(a => {
      if (/^javascript:/i.test(a.getAttribute('href'))) a.removeAttribute('href');
      else { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
    });
    if (kind === 'user') cloned.classList.add('cp-user-original');
    // Light-theme adjustments are applied only when printing in light mode.
    if (window.__claudePdfLightMode) applyLightStyles(cloned);
    return cloned;
  }

  function css(cfg) {
    const white = cfg.light;
    const ink = white ? '#202124' : '#f2f1ed';
    const muted = white ? '#575c63' : '#c2bfba';
    const bg = white ? '#ffffff' : '#1e1e1e';
    const card = white ? '#f5f4f1' : '#30302f';
    const code = white ? '#f5f6f8' : '#282a2d';
    const border = white ? '#dedfdf' : '#505254';
    return `
@page { size: ${cfg.page} ${cfg.landscape ? 'landscape' : 'portrait'}; margin: ${cfg.margin}; }
@page { @top-left {content:none;} @top-center {content:none;} @top-right {content:none;}
        @bottom-left {content:none;} @bottom-center {content:none;} @bottom-right {content:none;} }
:root { color-scheme:${white ? 'light' : 'dark'}!important; }
html,body { width:auto!important;height:auto!important;max-height:none!important;min-height:0!important;
  margin:0!important;padding:0!important;overflow:visible!important;background:${bg}!important;color:${ink}!important; }
html,body,.cp-chat { -webkit-print-color-adjust:exact!important;print-color-adjust:exact!important; }
body { font-family:Arial,Helvetica,sans-serif!important;font-size:14px!important;line-height:1.48!important; }
.cp-chat { margin:0 auto!important;max-width:780px!important;width:100%!important;
  display:block!important;overflow:visible!important;color:${ink}!important; }
.cp-title { display:block!important;font-family:Arial,Helvetica,sans-serif!important;
  font-weight:700!important;font-size:22px!important;line-height:1.3!important;
  margin:0 0 1.3em!important;padding:0!important;color:${ink}!important;break-after:avoid!important; }
.cp-entry { display:flow-root!important;position:relative!important;overflow:visible!important;
  height:auto!important;max-height:none!important;width:100%!important;
  margin:0 0 22px!important;padding:0 0 5px!important;break-inside:auto!important; }
.cp-entry > .cp-body { display:flow-root!important;max-width:100%!important;width:100%!important;
  min-width:0!important;overflow:visible!important;overflow-wrap:normal!important; }
.cp-entry[data-role="user"] > .cp-body { max-width:100%!important; }
.cp-entry .cp-body *:not(svg):not(path):not(line):not(circle):not(rect):not(polygon):not(polyline) {
  box-sizing:border-box; }
.cp-entry :is(.text-primary,.text-heading,[data-cds="Prose"],.prose) { color:${ink}!important; }
.cp-entry :is(.text-secondary,.text-tertiary,.text-muted) {color:${muted}!important;}
.cp-entry :is([data-cds="TurnStatus"],[data-cds="TurnStatusStep"]) {
  break-inside:auto!important;max-height:none!important;overflow:visible!important; }
.cp-entry :is([data-cds="TurnStatus"],[data-cds="TurnStatusStep"]) [data-cds-row] {
  break-after:avoid!important; }
.cp-entry :is(.overflow-y-auto,.overflow-y-hidden,.overflow-y-clip,.overflow-x-auto,.overflow-x-clip,
  [class*="max-h-"],[class*="overflow-hidden"],[style*="max-height"], [style*="maxHeight"]) {
  overflow:visible!important;max-height:none!important;height:auto!important;
  mask-image:none!important;-webkit-mask-image:none!important;clip-path:none!important; }
.cp-entry [data-testid="user-message"] {max-height:none!important;overflow:visible!important;}
.cp-entry [data-cds="UserMessage"],.cp-entry .cp-user-original {max-width:100%!important;}
.cp-entry [data-role="user"] {color:${ink}!important;}
.cp-entry[data-role="user"] .group\\/bubble { background:${card}!important;color:${ink}!important;
  border-radius:13px!important;max-width:92%!important;width:fit-content!important;
  margin-left:auto!important;overflow:visible!important; }
.cp-entry[data-role="user"] .group\\/bubble :is(p,span,div) {color:${ink};}
.cp-entry :is(h1,h2,h3,h4,h5,h6) {color:${ink}!important;break-after:avoid!important;}
.cp-entry :is(p,li,blockquote,td,th) {overflow-wrap:break-word;word-break:normal;orphans:2;widows:2;}
.cp-entry :is(pre,pre *,code,[data-code-line-group]) {
  font-family:"DejaVu Sans Mono",Consolas,"Liberation Mono",monospace!important;
  font-size:10.8px!important;line-height:1.43!important;
  white-space:pre-wrap!important;overflow-wrap:anywhere!important;word-break:break-word!important;tab-size:4!important; }
.cp-entry pre,.cp-entry .code-block__code {overflow:visible!important;max-height:none!important;height:auto!important;
  break-inside:auto!important;page-break-inside:auto!important; }
.cp-entry .code-block__code {background:${code}!important;border-radius:7px!important;}
.cp-entry :is([data-code-line-group],.code-line) {break-inside:avoid!important;}
.cp-entry :is(img,canvas,video) {max-width:100%!important;height:auto;object-fit:contain!important;}
.cp-entry img {max-height:245mm!important;}
.cp-entry svg {max-width:100%!important;}
.cp-entry :is(img,figure,[data-testid="file-card-block"],tr,.cp-artifact) {
  break-inside:avoid!important;page-break-inside:avoid!important; }
.cp-entry [data-testid="file-card-block"] {border-radius:11px!important;overflow:hidden!important;
  border:1px solid ${border}!important;background:${card}!important; }
.cp-entry [data-cds="Card"] {border-radius:12px!important;}
.cp-entry .cds-card-fill {border-radius:inherit!important;}
.cp-entry table {max-width:100%!important;width:100%!important;border-collapse:collapse!important;table-layout:auto!important;}
.cp-entry :is(th,td) {white-space:normal!important;word-break:break-word!important;border-bottom:1px solid ${border};padding:5px 7px!important;}
.cp-entry a[href] {color:${white?'#165caa':'#8dc5ff'}!important;}
.cp-entry :is([data-cds="Prose"],.prose) {max-height:none!important;overflow:visible!important;}
.cp-entry [data-cds="Icon"] {font-family:inherit;}
.cp-entry iframe[data-cp-iframe] {border:1px solid ${border};border-radius:9px;max-width:100%!important;}
/* Only apply these classes when a measured print layout actually collapses. */
.cp-entry .cp-print-reflow-parent {display:flex!important;flex-wrap:wrap!important;
  justify-content:flex-start!important;align-items:flex-start!important;gap:9px!important;
  max-width:100%!important;}
.cp-entry .cp-print-reflow-child {flex:1 1 250px!important;
  width:auto!important;min-width:min(100%,220px)!important;max-width:100%!important;
  overflow-wrap:break-word!important;word-break:normal!important;}
.cp-entry .cp-print-reflow-item {width:100%!important;min-width:min(100%,220px)!important;
  max-width:100%!important;overflow-wrap:break-word!important;word-break:normal!important;}
.cp-entry .cp-print-reflow-grid {display:grid!important;
  grid-template-columns:repeat(auto-fit,minmax(min(100%,250px),1fr))!important;
  gap:10px!important;max-width:100%!important;}
.cp-artifact {display:block!important;max-width:100%!important;width:100%;
  margin:9px 0 13px!important;padding:0!important;border-radius:10px!important;
  background:${bg}!important;overflow:hidden!important;}
.cp-artifact img {display:block;width:auto;max-width:100%!important;height:auto!important;
  max-height:245mm!important;object-fit:contain!important;border:1px solid ${border};border-radius:10px!important;}
.cp-artifact figcaption {font:11px/1.4 Arial,sans-serif;color:${muted};margin:5px 0 0;}
.cp-author {font:600 11px/1.4 Arial,sans-serif;color:${muted};margin:0 0 7px!important;break-after:avoid!important;}
.cp-entry[data-role="user"] > .cp-author {text-align:right;}
.cp-entry[data-role="assistant"] > .cp-author {color:${white?'#a35034':'#dfa17a'};}
.cp-warning {border:1px solid #dca86d!important;border-radius:8px;background:#fff9ec!important;
  color:#603b13!important;padding:10px 13px;margin:0 0 16px;}
.cp-warning button {padding:6px 10px;margin:6px;cursor:pointer;}
.cp-entry [data-cds-row-toggle],.cp-entry [data-testid="message-actions"],.cp-entry [data-testid="user-message-actions"],
.cp-entry :is(button,[role="tooltip"],[data-testid="action-bar-retry"]) {display:none!important;}
@media print {
  html,body,.cp-chat,.cp-entry {overflow:visible!important;}
  .cp-entry {break-inside:auto!important;}
  .cp-warning {display:none!important;}
}
`;
  }

  // A 1920px desktop layout can leave flex/grid search cards 20px wide
  // when transplanted into an A4 page. Repair ONLY measured narrow cards,
  // rather than globally changing every nested flexbox or wrapping words.
  function repairNarrowPrintLayouts(doc, main) {
    let repairs = 0;
    const pageWidth = main.getBoundingClientRect().width;
    if (pageWidth < 220) return repairs;
    const candidates = [...main.querySelectorAll('a,p,li,div,section,article')]
      .filter(el => {
        if (el.closest('pre,code,svg,.cp-warning,.cp-author')) return false;
        if (el.querySelector('pre,code,svg,table')) return false;
        const txt = safeText(el.textContent);
        if (txt.length < 48 || el.getClientRects().length === 0) return false;
        const r = el.getBoundingClientRect();
        return r.width >= 8 && r.width < 110 && r.height > 40;
      })
      .sort((a,b) => a.querySelectorAll('*').length - b.querySelectorAll('*').length);

    for (const target of candidates) {
      let child = target;
      if (child.getBoundingClientRect().width >= 150) continue;
      for (let level = 0; level < 10 && child.parentElement; level++) {
        const parent = child.parentElement;
        if (parent === main || parent.classList.contains('cp-entry')) break;
        const parentWidth = parent.getBoundingClientRect().width;
        if (parentWidth >= 220 && child.getBoundingClientRect().width < 135) {
          const display = doc.defaultView.getComputedStyle(parent).display;
          if (display.includes('grid')) {
            parent.classList.add('cp-print-reflow-grid');
            child.classList.add('cp-print-reflow-item');
          } else if (display.includes('flex')) {
            parent.classList.add('cp-print-reflow-parent');
            child.classList.add('cp-print-reflow-child');
          } else {
            child.classList.add('cp-print-reflow-item');
          }
          repairs++;
          break;
        }
        child = parent;
      }
    }
    return repairs;
  }

  // Best-effort preservation of already rendered iframe content.
  // Same-origin iframe documents are serialized *after* their JS has rendered.
  // Cross-origin frames cannot be inspected by a normal web page; keep their
  // src/srcdoc for native browser printing without requesting any permissions.
  function preserveEmbeddedFrames(source, cloned, cfg, allowance) {
    const liveFrames = [...source.querySelectorAll('iframe')];
    const printFrames = [...cloned.querySelectorAll('iframe')];
    let attempted = 0, frozen = 0, unavailable = 0;
    for (let i = 0; i < liveFrames.length && attempted < allowance; i++) {
      const live = liveFrames[i], target = printFrames[i];
      if (!target || !visible(live)) continue;
      attempted++;
      if (!cfg.captureArtifacts) continue;
      try {
        const frameDoc = live.contentDocument;
        if (!frameDoc?.documentElement) { unavailable++; continue; }
        const html = frameDoc.documentElement.cloneNode(true);
        html.querySelectorAll('script,noscript').forEach(el => el.remove());
        // Convert readable canvas pixels to a static image in the DOM copy.
        const canvases = [...frameDoc.querySelectorAll('canvas')];
        html.querySelectorAll('canvas').forEach((canvas, n) => {
          try {
            const img = frameDoc.createElement('img');
            img.src = canvases[n].toDataURL('image/png');
            img.width = canvases[n].width;
            img.height = canvases[n].height;
            img.alt = canvases[n].getAttribute('aria-label') || 'Artifact graphic';
            canvas.replaceWith(img);
          } catch (_) { /* Keep inaccessible canvas unchanged. */ }
        });
        const liveControls = frameDoc.querySelectorAll('input,textarea,select');
        html.querySelectorAll('input,textarea,select').forEach((control, n) => {
          const original = liveControls[n];
          if (!original) return;
          if (control.localName === 'textarea') control.textContent = original.value;
          else if (control.localName === 'input') {
            control.value = original.value;
            control.setAttribute('value', original.value);
            if (original.checked) control.setAttribute('checked', '');
            else control.removeAttribute('checked');
          } else if (control.localName === 'select') {
            [...control.options].forEach((option, index) => {
              option.selected = !!original.options[index]?.selected;
            });
          }
        });
        const head = html.querySelector('head') || html.insertBefore(frameDoc.createElement('head'), html.firstChild);
        const base = frameDoc.createElement('base');
        base.href = frameDoc.baseURI;
        head.prepend(base);
        // Setting srcdoc retains the rendered DOM without restarting its JS.
        target.setAttribute('srcdoc', '<!doctype html>\n' + html.outerHTML);
        target.removeAttribute('src');
        target.setAttribute('sandbox', ''); // Do not execute scripts again.
        const rect = live.getBoundingClientRect();
        if (rect.width > 50) target.style.width = Math.round(rect.width) + 'px';
        if (rect.height > 50) target.style.height = Math.round(rect.height) + 'px';
        frozen++;
      } catch (_) {
        unavailable++; // Browser same-origin policy; preserve original iframe.
      }
    }
    return { attempted, frozen, unavailable };
  }

  window.printClaudePDF = async function printClaudePDF(options = {}) {
    // Validation happens BEFORE opening the loading tab or scrolling.
    // Never silently replace an invalid parameter with a default.
    let cfg;
    try {
      cfg = validateOptions(options);
    } catch (err) {
      console.error('[Claude PDF] Configuration error:', err.message);
      throw err;
    }
    if (!document.querySelector(LIST)) throw Error('Open a Claude conversation before running this function.');

    // Open the loading tab synchronously to preserve the browser user gesture.
    // There are no screen-share calls, permission dialogs or camera requests.
    const out = window.open('', '_blank');
    if (!out) throw Error('Popup blocked. Allow popups for claude.ai and try again.');
    const doc = out.document;
    const title = safeText(document.querySelector('[data-testid="session-title-split"]')?.textContent)
      .replace(/[\ue000-\uf8ff]/g, '').trim() ||
      document.title.replace(/\s*[-–|]\s*Claude.*$/i, '').trim() || 'Claude conversation';
    doc.open();
    doc.write('<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Preparing PDF</title></head>' +
      '<body><p id="cp-status" style="font:14px Arial;padding:20px">Reading conversation...</p><main id="claude-pdf"></main></body></html>');
    doc.close(); doc.title = `${title} - Claude`;
    doc.documentElement.lang = document.documentElement.lang || "en";
    const status = message => {
      const el = doc.getElementById('cp-status');
      if (el) el.textContent = message;
      if (cfg.debug) log(message);
    };
    // Read the original Claude chat while the independent tab shows progress.
    try { window.focus(); } catch (_) {}
    window.__claudePdfLightMode = cfg.light;
    const originals = new Map();
    let total = 0, clicked = 0, previews = 0, frozenArtifacts = 0, inaccessibleArtifacts = 0;
    let reachedBottom = false;
    let cancel = false;
    let capturePass = 0, captureError = null;
    window.cancelClaudePDF = () => { cancel = true; };
    function assertRunning() {
      if (cancel || out.closed) throw Error('Export canceled.');
    }
    async function expandOne(row) {
      if (!cfg.expand) return { complete: true, remaining: 0 };
      const startKey = rowIndex(row);
      const resolveRow = () => liveRow(startKey, row);
      const attempts = new Map();
      let afterClick = false, previous = null;
      // Re-query after EVERY click. Expanding a parent can replace its children,
      // reveal further levels, or invalidate all previously collected buttons.
      while (true) {
        assertRunning();
        const settled = await settleExpansion(resolveRow, cfg, assertRunning, afterClick);
        const live = resolveRow();
        if (!live) return { complete: false, remaining: 1, reason: 'Message was recycled during expansion' };
        const targets = expandableButtons(live);
        if (!settled) return { complete: false, remaining: Math.max(1, targets.length), reason: 'Message did not finish rendering' };
        // Show-more controls can legitimately take many clicks. Only failed
        // attempts consume retries; newly revealed content resets that count.
        const progress = safeText(live.textContent) + ':' + live.querySelectorAll('*').length;
        if (previous && previous.progress !== progress) attempts.delete(previous.key);
        if (!targets.length) return { complete: true, remaining: 0 };
        if (clicked >= cfg.maxExpansionClicks) {
          return { complete: false, remaining: targets.length, reason: 'Expansion click limit reached' };
        }
        const candidate = targets.find(el => !el.matches(':disabled,[aria-disabled="true"]') &&
          (attempts.get(toggleKey(el)) || 0) <= cfg.expandRetries);
        if (!candidate) return { complete: false, remaining: targets.length, reason: 'Controls stayed closed or disabled after retries' };
        const key = toggleKey(candidate);
        attempts.set(key, (attempts.get(key) || 0) + 1);
        previous = { key, progress };
        status(`Messages ${originals.size}${total ? '/' + total : ''}; ` +
          `expanding message ${NUM(startKey) ? startKey + 1 : '?'}; clicks ${clicked + 1}`);
        try {
          clicked++;
          if (candidate.localName === 'details') candidate.open = true;
          else candidate.click();
        } catch (err) { if (cfg.debug) console.warn('Could not expand:', key, err); }
        afterClick = true;
      }
    }
    async function takeRows() {
      const rows = [...(document.querySelector(LIST)?.querySelectorAll(ROW) || [])];
      // Store renderized rows promptly; virtualizers can recycle them.
      for (const initial of rows) {
        assertRunning();
        const idx = rowIndex(initial);
        const size = rowTotal(initial);
        if (size && size > total) total = size;
        const origin = liveRow(idx, initial);
        if (!origin) continue;
        const src = sourceOf(origin);
        if (!src) continue;
        const key = NUM(idx) ? `i:${idx}` : `u:${origin.getAttribute('data-item-key') || originals.size}`;
        const previous = originals.get(key);
        // Revisit changed or remounted messages. A previous capture is not
        // proof that late-rendered nested controls have already been expanded.
        if (previous?.sourceHTML === origin.outerHTML &&
            (previous.expansion.complete || previous.pass === capturePass)) continue;
        const expansion = await expandOne(origin);
        const after = liveRow(idx, origin);
        const current = after && sourceOf(after);
        if (!current) continue; // Never overwrite a good capture with a recycled row.
        const clone = cloneMessage(current.element, current.kind);
        // Preserve current same-origin artifact DOM without screen capture.
        // Cross-origin frames are kept as native iframes for browser printing.
        const old = previous?.embedded || { attempted: 0, frozen: 0, unavailable: 0 };
        const remaining = Math.max(0, cfg.maxArtifactPreviews - previews + old.attempted);
        const embedded = preserveEmbeddedFrames(current.element, clone, cfg, remaining);
        previews += embedded.attempted - old.attempted;
        frozenArtifacts += embedded.frozen - old.frozen;
        inaccessibleArtifacts += embedded.unavailable - old.unavailable;
        originals.set(key, { idx, kind: current.kind, node: clone, embedded, expansion,
          sourceHTML: after.outerHTML, pass: capturePass });
      }
      return originals.size;
    }
    function historyComplete() {
      if (total > 0) {
        if (originals.size < total) return false;
        for (let i = 0; i < total; i++) if (!originals.has(`i:${i}`)) return false;
        return true;
      }
      // Older Claude layouts may not expose aria-setsize. Once a complete
      // top-to-bottom scan finishes, accept a contiguous 0-based row sequence.
      // A skipped beginning or missing intermediate row still fails closed.
      if (!cfg.scan || !reachedBottom || !originals.size) return false;
      for (let i = 0; i < originals.size; i++) if (!originals.has(`i:${i}`)) return false;
      return true;
    }
    const expansionsComplete = () => !cfg.expand || [...originals.values()].every(entry => entry.expansion.complete);
    const complete = () => !captureError && historyComplete() && expansionsComplete();
    const missing = () => {
      const result = [];
      for (let i = 0; i < total; i++) if (!originals.has(`i:${i}`)) result.push(i + 1);
      return result;
    };
    const list = document.querySelector(LIST);
    const scroll = getScroll(list);
    const restore = { top: scroll.scrollTop, behavior: scroll.style.scrollBehavior,
      anchor: scroll.style.overflowAnchor, htmlBehavior: document.documentElement.style.scrollBehavior };
    scroll.style.scrollBehavior = 'auto'; scroll.style.overflowAnchor = 'none';
    document.documentElement.style.scrollBehavior = 'auto';
    try {
      if (cfg.scan) {
        for (let pass = 0; pass <= cfg.retries && !complete(); pass++) {
          capturePass = pass;
          assertRunning();
          let current = getScroll(document.querySelector(LIST) || list);
          scrollToY(current, 0);
          await delay(cfg.scrollDelay * 2); await tick();
          // Some Claude virtualizers need additional top-of-list settle time.
          for (let i = 0; i < 4; i++) { await takeRows(); await delay(cfg.scrollDelay); }
          let stagnant = 0;
          for (let step = 0; step < cfg.maxScrollSteps; step++) {
            assertRunning();
            const beforeCount = originals.size;
            await takeRows();
            if (complete()) break;
            current = getScroll(document.querySelector(LIST) || list);
            const limit = Math.max(0, current.scrollHeight - current.clientHeight);
            const before = current.scrollTop;
            const advance = Math.max(125, current.clientHeight * .45);
            if (step % 5 === 0) status(`Messages ${originals.size}${total ? '/' + total : ''}; ` +
              `pass ${pass + 1}/${cfg.retries + 1}; ` +
              `expanded thoughts/steps ${clicked}; artifacts ${previews}`);
            if (before >= limit - 2) {
              await delay(cfg.scrollDelay * 2);
              if (originals.size > beforeCount) { stagnant = 0; continue; }
              if (++stagnant >= 4) { reachedBottom = true; break; }
              continue;
            }
            scrollToY(current, Math.min(limit, before + advance));
            await tick(); await delay(cfg.scrollDelay);
            if (Math.abs(current.scrollTop - before) < 1 && originals.size === beforeCount) stagnant++;
            else stagnant = 0;
            if (stagnant >= 7) break;
          }
        }
      }
      await takeRows();
    } catch (err) {
      console.error('[Claude PDF] Capture interrupted:', err);
      if (cancel || out.closed) { if (!out.closed) out.close(); return { canceled: true }; }
      captureError = err;
    } finally {
      try {
        scroll.style.scrollBehavior = restore.behavior;
        scroll.style.overflowAnchor = restore.anchor;
        document.documentElement.style.scrollBehavior = restore.htmlBehavior;
        scroll.scrollTop = restore.top;
      } catch (_) {}
      delete window.cancelClaudePDF;
      delete window.__claudePdfLightMode;
    }
    if (out.closed) return { error: 'Window closed' };
    if (!originals.size) { out.close(); throw Error('No messages could be recovered.'); }
    status(`Laying out ${originals.size} messages…`);
    const base = doc.createElement('base'); base.href = location.href; doc.head.append(base);
    if (cfg.copySiteStyles) {
      for (const el of document.head.querySelectorAll('style,link[rel="stylesheet"]')) {
        const copy = el.cloneNode(true);
        if (copy.tagName === 'LINK') copy.removeAttribute('crossorigin');
        doc.head.append(copy);
      }
    }
    doc.documentElement.className = document.documentElement.className || 'cds-root';
    for (const attribute of ['data-theme','data-density','data-color-version','data-cds-fizzy-lake',
      'data-reply-face','data-font','data-cjk-order','dir']) {
      const v = document.documentElement.getAttribute(attribute);
      if (v != null) doc.documentElement.setAttribute(attribute, v);
    }
    doc.documentElement.style.cssText = document.documentElement.style.cssText;
    doc.documentElement.setAttribute('data-mode', cfg.light ? 'light' : 'dark');
    doc.documentElement.setAttribute('data-theme', 'claude');
    const sheet = css(cfg);
    const style = doc.createElement('style'); style.textContent = sheet; doc.head.append(style);
    try {
      const constructed = new out.CSSStyleSheet(); constructed.replaceSync(sheet);
      doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, constructed];
    } catch (_) {}
    const main = doc.getElementById('claude-pdf');
    main.className = 'cp-chat cds-root text-primary';
    main.setAttribute('data-mode', cfg.light ? 'light' : 'dark');
    const frag = doc.createDocumentFragment();
    if (cfg.title) {
      const h1 = doc.createElement('h1'); h1.className = 'cp-title'; h1.textContent = title; frag.append(h1);
    }
    const ordered = [...originals.values()].sort((a,b) => (a.idx ?? Infinity) - (b.idx ?? Infinity));
    for (const {idx,kind,node} of ordered) {
      const article = doc.createElement('article'); article.className = 'cp-entry';
      article.dataset.role = kind; if (NUM(idx)) article.dataset.index = idx;
      if (cfg.showMessageRoles) {
        const author = doc.createElement('div'); author.className = 'cp-author';
        author.textContent = kind === 'user' ? 'You' : 'Claude';
        article.append(author);
      }
      const content = doc.createElement('div'); content.className = 'cp-body';
      content.append(doc.importNode(node, true));
      article.append(content); frag.append(article);
    }
    main.replaceChildren(frag);
    const gaps = missing();
    const isFull = complete();
    const pendingExpansions = [...originals.values()].filter(entry => !entry.expansion.complete)
      .map(entry => ({ message: NUM(entry.idx) ? entry.idx + 1 : null,
        remaining: entry.expansion.remaining, reason: entry.expansion.reason }));
    const warnings = [];
    if (!historyComplete()) warnings.push(`Conversation not verified: ${originals.size} captured; ` +
      `${total || '?'} expected. Missing messages: ${gaps.slice(0,30).join(', ')}${gaps.length>30?'…':''}.`);
    if (pendingExpansions.length) warnings.push('Some sections could not be fully expanded. ' +
      pendingExpansions.slice(0, 20).map(item => `Message ${item.message ?? '?'}: ${item.reason} (${item.remaining} pending).`).join(' '));
    if (captureError) warnings.push(`Capture interrupted: ${captureError.message || captureError}.`);
    if (inaccessibleArtifacts > 0) warnings.push(
      `${inaccessibleArtifacts} cross-origin artifact frames could not be frozen; ` +
      'the browser will attempt to print their embedded frames directly.');
    if (warnings.length) {
      const alert = doc.createElement('aside'); alert.className = 'cp-warning';
      alert.append(doc.createTextNode(warnings.join(' ')));
      if (!isFull) {
        const btn = doc.createElement('button'); btn.textContent = 'Print anyway';
        btn.addEventListener('click', () => out.print()); alert.append(btn);
      }
      main.prepend(alert);
    }
    status('Loading CSS, fonts, and images…');
    const timeout = (promise, time) => Promise.race([promise, delay(time)]);
    const sheets = [...doc.querySelectorAll('link[rel="stylesheet"]')].map(link =>
      new Promise(resolve => {
        try { if (link.sheet) return resolve(); } catch (_) {}
        link.addEventListener('load', resolve, { once: true });
        link.addEventListener('error', resolve, { once: true });
      })
    );
    await timeout(Promise.allSettled(sheets), 5000);
    await timeout(doc.fonts?.ready || Promise.resolve(), 5000);
    // Wait briefly for embedded previews to settle in the new document.
    // No permissions are requested, even if an iframe is cross-origin.
    if (cfg.captureArtifacts && cfg.artifactWait) {
      const frames = [...main.querySelectorAll('iframe[data-cp-iframe]')];
      await Promise.race([
        Promise.allSettled(frames.map(frame => new Promise(resolve => {
          try {
            if (frame.contentDocument?.readyState === 'complete') return resolve();
          } catch (_) { /* Cross-origin readiness is not inspectable. */ }
          frame.addEventListener('load', resolve, { once: true });
          frame.addEventListener('error', resolve, { once: true });
        }))),
        delay(cfg.artifactWait)
      ]);
    }
    // Perform after site CSS and fonts are ready; two passes cover nested cards.
    const layoutRepairs = repairNarrowPrintLayouts(doc, main);
    if (layoutRepairs && cfg.debug) log(`Reflowed ${layoutRepairs} narrow print blocks.`);
    await timeout(Promise.allSettled([...doc.images].map(img => new Promise(resolve => {
      img.loading = 'eager';
      if (img.complete) return resolve();
      img.addEventListener('load', resolve, {once:true});
      img.addEventListener('error', resolve, {once:true});
    }))), cfg.imageWait);
    const failedImages = [...doc.images].filter(img => img.complete && img.naturalWidth === 0).length;
    if (failedImages) {
      const alert = doc.createElement('aside'); alert.className = 'cp-warning';
      alert.textContent = `${failedImages} images could not load in the print view. ` +
        'Check resource permissions or expired image URLs before printing.';
      main.prepend(alert);
    }
    doc.getElementById('cp-status')?.remove();
    out.focus();
    log({ captured: originals.size, expected: total || 'unknown',
      complete: isFull, expandedClicks: clicked, embeddedFrames: previews,
      embeddedFramesFrozen: frozenArtifacts, inaccessibleArtifactFrames: inaccessibleArtifacts, failedImages,
      missing: gaps.slice(0, 100), pendingExpansions });
    // Do not stop automatic printing for cross-origin iframes or failed images:
    // they can still appear in the native print output. Missing chat rows,
    // unfinished expansion or interrupted capture enforce allowPartial=false.
    const safeToAutoPrint = isFull;
    if (cfg.printAutomatically && (safeToAutoPrint || cfg.allowPartial)) out.print();
    else if (!safeToAutoPrint && cfg.printAutomatically) log('Automatic printing skipped: messages or expanded sections are incomplete. Review the new tab or use allowPartial:true.');
    return { window: out, captured: originals.size, expected: total || null,
      complete: isFull, messagesComplete: historyComplete(), expansionsComplete: expansionsComplete(),
      expanded: clicked, pendingExpansions, embeddedFrames: previews,
      embeddedFramesFrozen: frozenArtifacts, crossOriginFrames: inaccessibleArtifacts,
      failedImages, missing: gaps };
  };
  window.printClaudePDF.validate = function (options = {}) {
    try {
      return validateOptions(options);
    } catch (err) {
      console.error('[Claude PDF] Configuration error:', err.message);
      throw err;
    }
  };
  window.printClaudePDF.help = helpOptions;
  window.printClaudePDF.defaults = CONFIG;
  log('Function registered: printClaudePDF({ page:"A4", margin:"5mm", theme:"light" }).');
  log('Help and parameters: printClaudePDF.help().');
})();






























































// ---------------------------------------------------------------------------
// USER CONFIGURATION — edit these values before pasting into the console.
// This call runs automatically, so there is no second command to enter.
// Run printClaudePDF.help() afterwards to see all supported options.
// ---------------------------------------------------------------------------
printClaudePDF({
  page: "A4",
  margin: "5mm",
  theme: "light",
  scan: true,
  retries: 2,
  expand: true,
  expandDelay: 300,
  expandWait: 1500,
  expandRetries: 3,
  allowPartial: false,
  printAutomatically: true
}).catch(error => {
  console.error("[Claude PDF] Export failed:", error);
});

