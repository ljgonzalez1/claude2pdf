# Claude2PDF

Repository: https://github.com/ljgonzalez1/claude2pdf

Print a [Claude](https://claude.ai/) conversation as a multipage PDF directly from your browser's developer console. The script aims to preserve chat styling, syntax highlighting, images, file previews, and expanded reasoning/tool steps while collecting messages loaded through scrolling.

## Quick start

1. Open **claude.ai** and select the conversation you want to export. Wait for it to finish loading.
2. Open the browser's **Developer Tools** console:
   - **Windows/Linux (Chrome, Chromium, Edge):** press `Ctrl + Shift + J`, or press `F12` and select the **Console** tab.
   - **macOS (Chrome/Chromium/Edge):** press `Cmd + Option + J`, or open Developer Tools and select **Console**.
   - If Chrome blocks pasting, read the warning and follow the browser's instructions only if you trust and have reviewed the script.
3. In the Console tab, click the input line beside the `>` prompt. Copy **the entire contents of [`print-cloud-chat.js`](./print-cloud-chat.js)**, paste it there, and press `Enter`.
4. On a new console line, run:

   ```javascript
   imprimirClaudePDF();
   ```

5. If asked for permission to capture an artifact, choose the **Claude browser tab**. The request is optional, but denying it can prevent some artifact previews from being exported.
6. When the print dialog opens, choose **Save as PDF**. Select **A4**, turn **Headers and footers OFF**, and turn **Background graphics ON**.

**Note:** You paste the JavaScript file's *contents* into the console; you do not paste its filename or URL. The script runs locally in your browser session.

## Configuration

```javascript
imprimirClaudePDF({
  page: "A4",
  margin: "5mm",
  theme: "light",
  scan: true,
  retries: 2,
  expand: true,
  captureArtifacts: true,
  allowPartial: false,
  printAutomatically: true
});
```

Defaults are portrait A4, 5 mm margins, a light theme, an H1 conversation title, and automatic printing only when capture appears complete. There is no script-imposed page count limit.

Show all available options, types, defaults, and explanations:

```javascript
imprimirClaudePDF.help();
```

Validate an options object without opening a window or printing:

```javascript
imprimirClaudePDF.validate({ page: "A4", margin: "5mm", retries: 2 });
```

Invalid or unknown options throw a `TypeError` naming the parameter, its accepted values, and its default when applicable. See [PARAMETERS.md](./PARAMETERS.md) for the full reference.

To cancel a running scan, execute `cancelarImpresionClaudePDF()` while it is active.

## Limitations

- Browser-generated page numbers, headers, and footers must be disabled in the **browser print dialog**; page CSS cannot reliably override them.
- A browser-console script **cannot guarantee pixel-perfect export** of every interactive artifact, cross-origin iframe, hidden state, or unloaded conversation branch. Screenshots capture *visible* pixels only and may omit off-screen or internally scrollable content.
- Claude can change its HTML structure. If the conversation appears incomplete, the script warns and does not print automatically unless `allowPartial: true`.
- The script only captures conversation content that your authenticated browser has rendered or made accessible during scrolling; it does not retrieve Claude's private server data or hidden reasoning.
