<img width="2545" height="313" alt="logo3" src="https://github.com/user-attachments/assets/cdf8b61e-a795-45d3-9752-0515d2229789" />

### About
Gemini Organizer is a browser extension for Chromium-based and Firefox browsers, enabling users to organize their Gemini chats.
A feature **still** missing from the vanilla experience, yet present in its competitors (ChatGPT).

### Features
- Add color coded folders for your Gemini chats
- Collapse folders to keep everything neat
- Sync all changes into your Google account

### How to use
[**Download**](https://github.com/bartlomiejcwiklak/GeminiOrganizer/releases) the extension for your desired browser type.
   
- **Chrome or Chromium-based browsers:** `chrome://extensions/` → Developer Mode → Load unpacked → `.output/chrome-mv3/`
- **Firefox or Firefox-based browsers:** `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → `.output/firefox-mv3/manifest.json`

### Build (using Bun)

1. Download the prerequisites
```bash
bun install
```

2. Build for Chrome
```bash
bun run build:chrome
```
3. Build for Firefox
```bash
bun run build:firefox
```
or build for both browsers
```bash
bun run build:all 
```
> Output: `.output/chrome-mv3/` and/or `.output/firefox-mv3/`

### Available Commands

- `bun run build:chrome` - create a Chrome/Chromium build
- `bun run build:firefox` - create a Firefox/Firefox-based build
- `bun run build:all` - build both browser targets
- `bun run dev:chrome` - watch the Chrome build target
- `bun run dev:firefox` - watch the Firefox build target
- `bun run zip:chrome` - package the Chrome build as a zip
- `bun run zip:firefox` - package the Firefox build as a zip
- `bun run clean` - remove build output directories


### Roadmap
- Preparing the extension for Chrome Web Store release: will make installation significantly easier

