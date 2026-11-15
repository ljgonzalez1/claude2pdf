# `imprimirClaudePDF()` options

All options are optional. Unknown names, unsupported values, incorrect types, and conflicting aliases produce an explicit `TypeError`. The function validates options **before** it opens a print tab or requests screen-capture permission.

| Option | Default | Accepted values | Purpose |
|---|---|---|---|
| `page` | `"A4"` | `"A3"`, `"A4"`, `"A5"`, `"Letter"`, `"Legal"` | Paper size. |
| `margin` | `"5mm"` | `"0"`, or 1–4 nonnegative CSS lengths with `mm`, `cm`, `pt`, `in`, `px` (e.g. `"5mm 8mm"`) | Print margins, in CSS top/right/bottom/left order. |
| `landscape` | `false` | `true`, `false` | Use landscape orientation. |
| `theme` | `"light"` | `"light"`, `"dark"`, `"current"` | Output theme; `current` follows Claude's selected theme when detectable. |
| `title` | `true` | Boolean | Add an `<h1>` containing the conversation title before the chat. |
| `showMessageRoles` | `true` | Boolean | Show **You** and **Claude** above messages. |
| `copySiteStyles` | `true` | Boolean | Reuse Claude's CSS where possible, preserving file cards and visual styling. |
| `scan` | `true` | Boolean | Scroll to collect virtualized (not initially rendered) messages. |
| `scrollDelay` | `125` | Integer `0..10000` | Milliseconds to wait between scroll steps. |
| `retries` | `3` | Integer `0..6` | Additional full scroll passes after the first. |
| `maxScrollSteps` | `18000` | Integer `1..100000` | Maximum scroll steps per pass. |
| `expand` | `true` | Boolean | Expand recognized reasoning, tool steps, and show-more sections. |
| `expandDelay` | `75` | Integer `0..10000` | Milliseconds to wait after each expansion. |
| `maxExpansionClicks` | `18000` | Integer `0..100000` | Maximum expansion clicks overall. |
| `captureArtifacts` | `true` | Boolean | Request permission for screenshots of visible artifact previews. |
| `artifactWait` | `850` | Integer `0..60000` | Milliseconds to wait after opening an artifact preview. |
| `maxArtifactPreviews` | `400` | Integer `0..5000` | Maximum artifact previews attempted. |
| `allowPartial` | `false` | Boolean | Permit automatic printing even when content is missing. |
| `printAutomatically` | `true` | Boolean | Automatically open the print dialog after a successful capture. |
| `imageWait` | `14000` | Integer `0..120000` | Maximum wait for image resources in print preview (milliseconds). |
| `debug` | `false` | Boolean | Enable more console output. |
| `light` | Not set (legacy alias) | Boolean | Deprecated alias: `true` means `theme: "light"`; `false` means `theme: "dark"`. Do not provide conflicting `light` and `theme`. |

**Boolean** means a real JavaScript `true` or `false`, not a string such as `"true"`.

## Example

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

## Help and validation

```javascript
imprimirClaudePDF.help();
imprimirClaudePDF.validate({ page: "A4", margin: "5mm" });
```

Invalid options are rejected together, for example:

```javascript
imprimirClaudePDF.validate({
  page: "A0",
  retries: -1,
  scna: true
});
```

The error identifies `page` as invalid and lists accepted paper sizes; identifies the allowed range for `retries`; and reports `scna` as unknown, listing supported option names. **No print tab opens.**

## Print-dialog settings and browser limitations

Page CSS specifies A4 and 5 mm margins by default. Disable **Headers and footers** manually in your browser's print dialog, and enable **Background graphics**. Interactive artifacts and cross-origin frames can only be captured when visible and authorized; a complete, pixel-perfect snapshot of all of their internal states cannot be guaranteed.

For backwards compatibility, the previous `.ayuda()` and `.validar()` methods still work, but `.help()` and `.validate()` are preferred.
