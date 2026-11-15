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
| `scrollDelay` | `125` | Integer `0–10000` — ms between scrolls |
| `retries` | `3` | Integer `0–6` — additional history passes |
| `maxScrollSteps` | `18000` | Integer `1–100000` — per-pass scroll limit |
| `expand` | `true` | Boolean — open supported thoughts, steps, and show-more sections |
| `expandDelay` | `75` | Integer `0–10000` — ms after expansion |
| `maxExpansionClicks` | `18000` | Integer `0–100000` — expansion click limit |
| `captureArtifacts` | `true` | Boolean — preserve accessible iframe DOM as currently rendered, without screen-sharing permissions |
| `artifactWait` | `850` | Integer `0–60000` — maximum wait for embedded frames to settle in the print tab |
| `maxArtifactPreviews` | `400` | Integer `0–5000` — maximum embedded frames to preserve |
| `allowPartial` | `false` | Boolean — allow automatic printing with missing content |
| `printAutomatically` | `true` | Boolean — show print dialog when ready |
| `imageWait` | `14000` | Integer `0–120000` — image load wait in ms |
| `debug` | `false` | Boolean — verbose console logging |
| `light` | — | Deprecated Boolean alias for `theme`; avoid using both |

To cancel a scan, run `cancelClaudePDF()` in the original tab. The script never calls the screen-capture API. Cross-origin or offscreen artifacts cannot always be printed exactly as displayed, but their embedded frames are retained for the browser to print. The browser owns the printer destination: **Save as PDF cannot be preselected through `window.print()`**. Browser-provided page numbers and headers/footers must be disabled manually.
