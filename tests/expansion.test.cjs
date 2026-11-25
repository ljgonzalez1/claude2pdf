'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const script = fs.readFileSync(path.join(__dirname, '../Claude printing script/print-cloud-chat.js'), 'utf8');
// Load the real console script but omit its automatic invocation in fixtures.
const definition = script.slice(0, script.lastIndexOf('\nprintClaudePDF({'));
let browser;
before(async () => {
  browser = await chromium.launch({ headless: true,
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    args: ['--no-sandbox'] });
});
after(async () => { await browser?.close(); });

const row = (content, index = 0, total = 1) => `<section data-testid="transcript-row" data-rs-index="${index}">
  <div data-reply-scope><div data-testid="assistant-message" aria-posinset="${index + 1}" aria-setsize="${total}">${content}</div></div>
</section>`;

async function run(html, setup = () => {}, options = {}) {
  const page = await browser.newPage();
  try {
    await page.setContent(`<style>svg{width:16px;height:16px} #history{height:400px;overflow:auto}
      [role=button]{display:block;min-height:20px}</style><div id="history"><div data-testid="transcript-list">${html}</div></div>`);
    await page.addScriptTag({ content: definition });
    await page.evaluate(() => { window.counts = {}; });
    await page.evaluate(setup);
    return await page.evaluate(async options => {
      const frame = document.createElement('iframe');
      frame.style.cssText = 'position:fixed;left:-10000px;width:800px;height:600px';
      document.body.append(frame);
      const output = frame.contentWindow;
      let printed = 0, closed = false;
      output.print = () => { printed++; };
      output.focus = () => {};
      output.close = () => { closed = true; };
      window.open = () => output;
      const result = await printClaudePDF({ scan: false, copySiteStyles: false,
        captureArtifacts: false, imageWait: 0, printAutomatically: false,
        expandDelay: 0, expandWait: 80, ...options });
      const { window: ignored, ...data } = result;
      return { ...data, printed, closed, counts: window.counts,
        text: output.document.querySelector('#claude-pdf')?.textContent,
        openDetails: [...document.querySelectorAll('details')].filter(el => el.open).length,
        closedControls: document.querySelectorAll('[aria-expanded="false"]').length };
    }, options);
  } finally { await page.close(); }
}

test('opens all siblings and nested controls even when step keys and labels are identical', async () => {
  const result = await run(row(`<div data-step-key="shared">
    <button aria-expanded="false">Arbitrary heading</button><div hidden>
      <div role="button" aria-expanded="false">Same heading</div><p hidden>Nested payload</p>
      <details><summary>Native heading</summary><details><summary>Deeper</summary>Deep payload</details></details>
    </div><button aria-expanded="false">Arbitrary heading</button><p hidden>Sibling payload</p></div>`), () => {
    document.querySelectorAll('[aria-expanded]').forEach((button, index) => {
      button.addEventListener('click', () => {
        window.counts[index] = (window.counts[index] || 0) + 1;
        button.setAttribute('aria-expanded', 'true');
        button.nextElementSibling.hidden = false;
      });
    });
  });
  assert.equal(result.complete, true);
  assert.deepEqual(result.counts, { 0: 1, 1: 1, 2: 1 });
  assert.equal(result.openDetails, 2);
  assert.match(result.text, /Nested payload/);
  assert.match(result.text, /Sibling payload/);
  assert.match(result.text, /Deep payload/);
});

test('waits for delayed descendants and reacquires a React-style replaced row', async () => {
  const result = await run(row('<button id="parent" aria-expanded="false">Parent</button>'), () => {
    document.querySelector('#parent').onclick = event => {
      window.counts.parent = (window.counts.parent || 0) + 1;
      event.currentTarget.setAttribute('aria-expanded', 'true');
      setTimeout(() => {
        const old = document.querySelector('[data-testid="transcript-row"]');
        const replacement = old.cloneNode(true);
        old.replaceWith(replacement);
        const message = replacement.querySelector('[data-testid="assistant-message"]');
        message.insertAdjacentHTML('beforeend', '<div role="button" id="child" aria-expanded="false">Delayed</div><p hidden>Delayed payload</p>');
        document.querySelector('#child').onclick = event => {
          window.counts.child = (window.counts.child || 0) + 1;
          event.currentTarget.setAttribute('aria-expanded', 'true');
          event.currentTarget.nextElementSibling.hidden = false;
        };
      }, 1200);
    };
  }, { expandWait: 1500, expandDelay: 300 });
  assert.equal(result.complete, true);
  assert.deepEqual(result.counts, { parent: 1, child: 1 });
  assert.match(result.text, /Delayed payload/);
});

test('recognizes icon-only SVG/span chevrons and leaves rotated open ones alone', async () => {
  const result = await run(row(`<button id="svg"><span class="inline-flex text-secondary"><svg viewBox="0 0 16 16"><path d="M5 3 L10 8 L5 13"/></svg></span></button><p hidden>SVG payload</p>
    <div role="button" id="span"><span class="inline-flex text-secondary">›</span></div><p hidden>Span payload</p>
    <button id="open"><span style="display:inline-block;transform:rotate(90deg)">›</span></button>
    <button id="named"><span class="chevron-right" style="display:inline-block;width:12px;height:20px"></span></button><p hidden>Named payload</p>`), () => {
    ['svg', 'span', 'open', 'named'].forEach(id => {
      document.getElementById(id).onclick = event => {
        window.counts[id] = (window.counts[id] || 0) + 1;
        const button = event.currentTarget;
        button.querySelector('span').style.cssText = 'display:inline-block;transform:rotate(90deg)';
        if (id !== 'open') button.nextElementSibling.hidden = false;
      };
    });
  });
  assert.equal(result.complete, true);
  assert.deepEqual(result.counts, { svg: 1, span: 1, named: 1 });
  assert.match(result.text, /SVG payload/);
  assert.match(result.text, /Span payload/);
});

test('retries an ignored click without permanently suppressing the control', async () => {
  const result = await run(row('<button aria-expanded="false">Retry me</button><p hidden>Retry payload</p>'), () => {
    document.querySelector('button').onclick = event => {
      window.counts.retry = (window.counts.retry || 0) + 1;
      if (window.counts.retry < 2) return;
      event.currentTarget.setAttribute('aria-expanded', 'true');
      event.currentTarget.nextElementSibling.hidden = false;
    };
  });
  assert.equal(result.complete, true);
  assert.equal(result.counts.retry, 2);
});

test('reports stuck controls and blocks automatic printing after bounded retries', async () => {
  const result = await run(row('<button aria-expanded="false">Stuck</button>'), () => {
    document.querySelector('button').onclick = () => { window.counts.stuck = (window.counts.stuck || 0) + 1; };
  }, { printAutomatically: true, expandRetries: 2 });
  assert.equal(result.counts.stuck, 3);
  assert.equal(result.messagesComplete, true);
  assert.equal(result.complete, false);
  assert.equal(result.expansionsComplete, false);
  assert.equal(result.printed, 0);
  assert.equal(result.pendingExpansions[0].remaining, 1);
  assert.match(result.text, /Some sections could not be fully expanded/);
});

test('reports expansion budget exhaustion, including a zero-click budget', async () => {
  for (const budget of [0, 1]) {
    const result = await run(row('<button aria-expanded="false">One</button><button aria-expanded="false">Two</button>'), () => {
      document.querySelectorAll('button').forEach(button => {
        button.onclick = () => { button.setAttribute('aria-expanded', 'true'); };
      });
    }, { maxExpansionClicks: budget, printAutomatically: true });
    assert.equal(result.expanded, budget);
    assert.equal(result.complete, false);
    assert.equal(result.printed, 0);
    assert.match(result.pendingExpansions[0].reason, /click limit/);
  }
});

test('keeps loading show-more pages while each click reveals new content', async () => {
  const result = await run(row('<button>Show more</button><div id="items"></div>'), () => {
    document.querySelector('button').onclick = event => {
      window.counts.more = (window.counts.more || 0) + 1;
      document.getElementById('items').insertAdjacentHTML('beforeend', `<p>Page ${window.counts.more}</p>`);
      if (window.counts.more === 7) event.currentTarget.remove();
    };
  }, { expandRetries: 1 });
  assert.equal(result.complete, true);
  assert.equal(result.counts.more, 7);
  assert.match(result.text, /Page 7/);
});

test('refreshes a captured message if another message renders late nested controls', async () => {
  const result = await run(row('<p>First message</p>', 0, 2) + row('<button aria-expanded="false">Second message</button>', 1, 2), () => {
    document.querySelector('button').onclick = event => {
      event.currentTarget.setAttribute('aria-expanded', 'true');
      const first = document.querySelector('[data-rs-index="0"] [data-testid="assistant-message"]');
      first.insertAdjacentHTML('beforeend', '<button aria-expanded="false">Late first</button><p hidden>Recaptured payload</p>');
      first.querySelector('button').onclick = event => {
        window.counts.late = (window.counts.late || 0) + 1;
        event.currentTarget.setAttribute('aria-expanded', 'true');
        event.currentTarget.nextElementSibling.hidden = false;
      };
    };
  }, { scan: true, scrollDelay: 0, retries: 0 });
  assert.equal(result.complete, true);
  assert.equal(result.counts.late, 1);
  assert.match(result.text, /Recaptured payload/);
});

test('expands deeper than the previous 150-round cutoff', async () => {
  const result = await run(row('<div id="level"></div>'), () => {
    function add(parent, depth) {
      if (depth === 155) { parent.textContent = 'Deepest payload'; return; }
      const button = document.createElement('button');
      button.setAttribute('aria-expanded', 'false'); button.textContent = `Depth ${depth}`;
      const next = document.createElement('div'); parent.append(button, next);
      button.onclick = () => {
        window.counts.depth = (window.counts.depth || 0) + 1;
        button.setAttribute('aria-expanded', 'true'); add(next, depth + 1);
      };
    }
    add(document.getElementById('level'), 0);
  }, { expandWait: 0 });
  assert.equal(result.complete, true);
  assert.equal(result.counts.depth, 155);
  assert.match(result.text, /Deepest payload/);
});

test('ignores open disclosures, menus, file openers, navigation and hidden controls', async () => {
  const result = await run(row(`<button aria-expanded="true" aria-label="Show more">Already open</button>
    <button aria-expanded="false" aria-haspopup="menu">Menu</button>
    <button data-testid="file-card-open" aria-expanded="false">File</button>
    <a href="#"><span role="button" aria-expanded="false">Link</span></a>
    <div hidden><button aria-expanded="false">Hidden</button></div>
    <div data-testid="message-actions"><button aria-expanded="false">Actions</button></div>`), () => {
    document.querySelectorAll('button,[role="button"]').forEach(el => {
      el.onclick = () => { window.counts.unwanted = (window.counts.unwanted || 0) + 1; };
    });
  });
  assert.equal(result.complete, true);
  assert.deepEqual(result.counts, {});
});

test('handles rows indexed only with aria-posinset', async () => {
  const result = await run(row('<div role="button" aria-expanded="false">ARIA row</div><p hidden>ARIA payload</p>').replace(' data-rs-index="0"', ''), () => {
    document.querySelector('[role="button"]').onclick = event => {
      event.currentTarget.setAttribute('aria-expanded', 'true');
      event.currentTarget.nextElementSibling.hidden = false;
    };
  });
  assert.equal(result.complete, true);
  assert.match(result.text, /ARIA payload/);
});

test('keeps cancellation responsive while waiting for a busy message', async () => {
  const result = await run(row('<div aria-busy="true">Loading</div>'), () => {
    setTimeout(() => window.cancelClaudePDF?.(), 150);
  }, { expandWait: 1500 });
  assert.equal(result.canceled, true);
  assert.equal(result.closed, true);
});

test('prints automatically once all recognized sections are verified open', async () => {
  const result = await run(row('<details><summary>Open me</summary>Printable payload</details>'), () => {}, { printAutomatically: true });
  assert.equal(result.complete, true);
  assert.equal(result.printed, 1);
  assert.equal(result.openDetails, 1);
});
