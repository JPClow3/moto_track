# Moto Track launch kit

Campaign: **Cada quilômetro conta.** Language: pt-BR.

The three photographs were generated for this project. They show fictional scenes, people and an unbranded motorcycle. They are campaign photography, not evidence of a real customer, mechanic or product endorsement. Optimized copies are integrated into the app; full PNG masters are under `photos/`.

## Files

- `apple/`: four 1320 × 2868 opaque promotional panels and a 1024 × 1024 icon.
- `google/`: four 1080 × 1920 promotional panels, a 1024 × 500 feature graphic and a 512 × 512 icon.
- `microsoft/`: 1920 × 1080 hero, a 300 × 300 tile and a capture of the web demonstration.
- `social/`: square 1080 × 1080 launch creative.
- `motion/`: three silent 6-second H.264 videos, 1080 × 1920, 24 fps, and PNG posters.
- `captures/`: real captures of the public demonstration, with fictional data visibly identified.
- `source/`: editable, deterministic rendering scripts.
- `inventory.json`: dimensions and intended role of exported artwork.

The portrait panels are **promotional drafts using the web demonstration**, not proof of native-device rendering. Capture the signed native builds before filling screenshot slots in App Store Connect, Play Console or Partner Center. Microsoft screenshots must remain free of added marketing copy; the hero is a separate promotional asset. No official availability badge is used because there are no published listings.

## Rebuild

Run `npm ci`, then `npm run assets:photos` to regenerate optimized photos from the masters.
Start `npm run dev -- --port 5194` and run `npm run assets:render`.
Chromium (`npx playwright install chromium`) and FFmpeg on PATH are required.
Use `LAUNCH_BASE_URL` for a different local origin, `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` for an existing Chromium, or `FFMPEG_PATH` for a custom encoder.
`npm run assets:render -- --stills-only` exports the static assets only.

Sources checked during preparation:

- [Apple screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)
- [Google Play preview assets](https://support.google.com/googleplay/android-developer/answer/9866151?hl=en-GB)
- [Microsoft images and screenshots](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/screenshots-and-images)

Artwork dimensions do not establish store approval, native compatibility, subscription compliance, or permission to publish.
