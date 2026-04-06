<img width="2545" height="313" alt="logo3" src="https://github.com/user-attachments/assets/cdf8b61e-a795-45d3-9752-0515d2229789" />

### About
Gemini Organizer is a browser extension for Chromium-based and Firefox browsers, enabling users to organize their Gemini chats.
A feature **still** missing from the vanilla experience, yet present in its competitors (ChatGPT).

### Features
- Add color coded folders for your Gemini chats
- Collapse folders to keep everything neat
- Sync all changes into your Google account

### How to use
**Chrome:** `chrome://extensions/` → Developer Mode → Load unpacked → `.output/chrome-mv3/`

**Firefox:** `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → `.output/firefox-mv3/manifest.json`

### Build (using Bun)

1. Download the prerequisites
```bash
bun install
```

2. Build for your specific platform
```bash
bun run build:chrome
```
```bash
bun run build:firefox
```
or build for both
```bash
bun run build:all 
```
> Output: `.output/chrome-mv3/` and/or `.output/firefox-mv3/`


### Roadmap
- Preparing the extension for Chrome Web Store release: will make installation significantly easier

