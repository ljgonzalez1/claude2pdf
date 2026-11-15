# Claude2PDF

**[How to print a chat](./Claude%20printing%20script/README.md)** · **[Print script](./Claude%20printing%20script/print-cloud-chat.js)**

Export Claude conversations to multipage PDFs from the browser console, including visible messages, code blocks, images, file previews, and expandable sections where accessible.

## Quick start

1. Open a conversation on [Claude](https://claude.ai/).
2. Open [`print-cloud-chat.js`](./Claude%20printing%20script/print-cloud-chat.js) and, if needed, edit the **configuration call at the bottom**.
3. Open **Developer Tools → Console** (`F12` → **Console**, or `Ctrl+Shift+J`; on macOS `Cmd+Option+J`). Copy the **entire JavaScript file** into the console input (`>`) and press **Enter**.
4. In the print dialog choose **Save as PDF**, disable **Headers and footers**, and enable **Background graphics**.

The script starts automatically when pasted. By default, it uses **A4**, a **light theme**, and **5 mm margins**. It attempts to expand messages and capture visible artifacts; some protected or off-screen content may not be reproducible exactly.

Edit these example options at the end of the script:

```javascript
imprimirClaudePDF({
  page: "A4",
  margin: "5mm",
  theme: "light",
  scan: true,
  retries: 2,
  allowPartial: false,
  printAutomatically: true
});
```

See the [short printing guide](./Claude%20printing%20script/README.md) or [all supported parameters](./Claude%20printing%20script/PARAMETERS.md). Unknown or invalid options produce an error listing accepted values.

## License

MIT — see [LICENCE](./LICENCE).
