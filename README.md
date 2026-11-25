# Claude2PDF

### [Printing guide and options](./Claude%20printing%20script/README.md)

**[Open `print-cloud-chat.js`](./Claude%20printing%20script/print-cloud-chat.js)**

Export the full Claude chat to a multipage PDF, using a white A4 layout and 5 mm margins by default.

1. Open the conversation at [claude.ai](https://claude.ai/).
2. Open **Developer Tools → Console** (`F12` → Console, or `Ctrl+Shift+J`; macOS: `⌘+Option+J`). Click the `>` input, paste.
3. Edit the `printClaudePDF({ ... })` options **at the bottom** of the script, then copy the entire file.
4. Press **Enter**
5. The script automatically opens a **loading tab**, reads the original conversation, and opens the browser **Print** dialog. Choose **Save as PDF**.

In print settings, disable **Headers and footers** and enable **Background graphics**.

## License

[MIT - LICENCE](./LICENCE).
