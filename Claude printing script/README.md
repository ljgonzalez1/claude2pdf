# Print a Claude chat

**Script location:** [`./print-cloud-chat.js`](./print-cloud-chat.js) (this folder).

1. Open your conversation on [Claude](https://claude.ai/).
2. Edit the `printClaudePDF({ ... })` call **at the end** of the script.
3. Copy the **whole script**, open **Developer Tools → Console** (`F12` → Console, `Ctrl+Shift+J`, or `Cmd+Option+J` on macOS), click the `>` prompt, paste, and press **Enter**.
4. A new tab displays **Loading…** while the original chat is scanned. The script then automatically opens the browser **Print** dialog. Select **Save as PDF**; disable **Headers and footers** and enable **Background graphics**.

The script works without screen sharing, screen recording, or permission prompts for artifacts. It runs automatically when pasted. Edit these options at the **end of the JavaScript file**:

```javascript
printClaudePDF({
  page: "A4",
  margin: "5mm",
  theme: "light",
  scan: true,
  retries: 2,
  expand: true,
  expandDelay: 150,
  expandWait: 170,
  expandRetries: 3,
  allowPartial: false,
  printAutomatically: true
}).catch(error => console.error("[Claude PDF] Export failed:", error));
```

## Options

All options are optional. Bad values or unknown names produce an error listing accepted values. You can also run `printClaudePDF.help()` or `printClaudePDF.validate({ page: "A4" })` in the console after loading the script.

| Option | Default | Accepted values / effect |
|---|---|---|
| `page` | `"A4"` | `"A3"`, `"A4"`, `"A5"`, `"Letter"`, `"Legal"` — paper size |
| `margin` | `"5mm"` | `"0"` or 1–4 nonnegative lengths (`mm`, `cm`, `pt`, `in`, `px`) |
| `landscape` | `false` | Boolean — horizontal paper |
| `theme` | `"light"` | `"light"`, `"dark"`, `"current"` |
| `title` | `true` | Boolean — add chat title as `<h1>` |
| `showMessageRoles` | `true` | Boolean — show You / Claude labels |
| `copySiteStyles` | `true` | Boolean — reuse Claude's CSS |
| `scan` | `true` | Boolean — collect virtualized messages by scrolling |
| `scrollDelay` | `250` | Integer `0–10000` — ms between scrolls |
| `retries` | `3` | Integer `0–6` — additional history passes |
| `maxScrollSteps` | `18000` | Integer `1–100000` — per-pass scroll limit |
| `expand` | `true` | Boolean — open recognized disclosures at every nesting level, including thoughts, tool steps, native details, and show-more sections |
| `expandDelay` | `150` | Integer `0–10000` — minimum ms after each expansion click |
| `expandWait` | `170` | Integer `0–60000` — ms of DOM quiet before looking for more descendants or capturing a message; increase for slow conversations |
| `expandRetries` | `3` | Integer `0–10` — additional attempts when a control stays closed without revealing content |
| `maxExpansionClicks` | `18000` | Integer `0–100000` — expansion click limit |
| `captureArtifacts` | `true` | Boolean — preserve accessible iframe DOM as currently rendered, without screen-sharing permissions |
| `artifactWait` | `850` | Integer `0–60000` — maximum wait for embedded frames to settle in the print tab |
| `maxArtifactPreviews` | `400` | Integer `0–5000` — maximum embedded frames to preserve |
| `allowPartial` | `false` | Boolean — allow automatic printing with missing messages, unfinished expansions, or interrupted capture |
| `printAutomatically` | `true` | Boolean — show print dialog when ready |
| `imageWait` | `14000` | Integer `0–120000` — image load wait in ms |
| `debug` | `false` | Boolean — verbose console logging |
| `light` | — | Deprecated Boolean alias for `theme`; avoid using both |

## Expansion behavior

Controls are opened **one at a time**, with a fresh search after each render. The script handles `aria-expanded`, Claude row toggles, `role="button"` controls, native `<details>`, show-more buttons, and recognizable right-facing SVG/span chevrons. Open controls are left open. Menus, navigation links, file openers, and message actions are excluded.

The default wait is deliberately conservative: **300 ms minimum after a click and 1500 ms without DOM changes** before continuing. Mutations restart the quiet timer; a continuously busy message is bounded by `max(10000, expandWait × 4, expandDelay × 2)` ms per wait. For slower rendering, try `expandDelay: 500, expandWait: 3000`. Keep the original tab available while it scans.

Messages are captured again if their DOM changes later. Repeated labels or shared step keys do not suppress nested or sibling controls, and failed clicks can be retried. There is no fixed nesting-depth cutoff; `maxExpansionClicks` still bounds the total work.

If recognized controls remain closed, a limit is reached, or rendering never settles, the preview reports the affected messages and **automatic printing is withheld unless `allowPartial: true`**. The returned result includes `messagesComplete`, `expansionsComplete`, and `pendingExpansions`; `complete` requires both message coverage and expansion completeness. Detection relies on Claude's rendered DOM; a future markup change or content arriving after the quiet window may require a longer wait or updated selectors.

To cancel a scan, run `cancelClaudePDF()` in the original tab. The script never calls the screen-capture API. Cross-origin or offscreen artifacts cannot always be printed exactly as displayed, but their embedded frames are retained for the browser to print. The browser owns the printer destination: **Save as PDF cannot be preselected through `window.print()`**. Browser-provided page numbers and headers/footers must be disabled manually.

## Regression tests

The browser tests run the real export function against fixtures with delayed and replaced DOM, nested controls, duplicate keys, icon-only chevrons, failed clicks, show-more pagination, and cancellation. They do not require a Claude account.

With Node.js and npm installed:

```sh
npm install --no-save --package-lock=false playwright@1.62.1
npx playwright install chromium
node --test tests/expansion.test.cjs
```

Run these commands from the repository root. If Chromium is already installed, set `CHROMIUM_PATH` to its executable instead of installing Playwright's browser. The GitHub Actions workflow runs the same checks for pull requests and pushes to `master`.

