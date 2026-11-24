# Lowe's Lumber Unit Price

Edge/Chrome extension (Manifest V3, content script only) that adds unit-price badges on lowes.com. See README.md.

- **Verify:** load unpacked in `edge://extensions`, then reload a lowes.com lumber or sheet-goods page and check the badges and the "Best value" badge.
- **Version:** bump `version` in `manifest.json` for every build the user will load.
- Lowe's changes its page markup often. When badges disappear, check the selectors in `content.js` first.
