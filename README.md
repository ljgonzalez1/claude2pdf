# Claude2PDF

### [Printing guide and options](./Claude%20printing%20script/README.md)

**[Open `print-cloud-chat.js`](./Claude%20printing%20script/print-cloud-chat.js)**

Export the full Claude chat to a multipage PDF, using a white A4 layout and 5 mm margins by default.

1. (Optional but recommended) Read the repo JS code if you can, have the time and understand what's happening before continuing. Just good practice.
2. Open the conversation at [claude.ai](https://claude.ai/).
3. Open **Developer Tools → Console** (`F12` → Console, or `Ctrl + Shift + J`; macOS: `⌘ + Option + J`)
4. Click the `>` input and write `allow pasting`. Press Enter. Chrome sometimes won't let you paste random code (for safety reasons).
5. Click the `>` input and paste the code from the javascript file.
7. Edit the `printClaudePDF({ ... })` options **at the bottom** of the script you just pasted.
8. Press **Enter**
9. The script automatically opens a **loading tab**, reads the original conversation (it will take a while, it's functional not necessarily efficient), and opens the browser **Print** dialog.
10. Choose **Save as PDF**.
11. In print settings, disable **Headers and footers** and enable **Background graphics**.
12. Print 😄

## Other stuff...

Please, feel free to read, audit and point out bugs, errors, etc.

Sorry, this code was made mainly by AI. Too lazy for this task. 

## License

[MIT - LICENCE](./LICENCE).
