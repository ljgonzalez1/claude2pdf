# Claude2PDF

### [Printing guide and all configuration options](./Claude%20printing%20script/README.md)

**[Open `print-cloud-chat.js`](./Claude%20printing%20script/print-cloud-chat.js)**

Export a Claude conversation to a multipage PDF from your browser console. The script attempts to preserve formatting, code, images, file cards, and expanded steps.

1. Open a chat on [claude.ai](https://claude.ai/).
2. Open the script above, edit its **configuration at the bottom**, and copy the **entire file**.
3. Open the browser's **Developer Tools → Console** (`F12` → Console, or `Ctrl+Shift+J`; macOS: `Cmd+Option+J`). Click the `>` input area, paste, and press **Enter**. The export starts automatically.
4. Choose **Save as PDF**. Disable **Headers and footers** and enable **Background graphics** in the browser's print settings.

Default output: **A4**, **light theme**, **5 mm margins**. Browser security and dynamically loaded content can prevent exact capture of some interactive artifacts.

## License

MIT — [LICENCE](./LICENCE).
