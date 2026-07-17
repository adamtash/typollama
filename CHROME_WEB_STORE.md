# Chrome Web Store release kit

This file is the source of truth for the Chrome Web Store listing. Keep it consistent with the extension's behavior and [Privacy Policy](PRIVACY.md).

## Listing copy

**Name**

Typollama – AI Writing Assistant

**Short description**

AI writing help for any text field: spellcheck, proofread, rewrite, and custom edits with your chosen provider.

**Detailed description**

Typollama brings AI-powered writing assistance to the text fields you already use. Select text or focus an editable field, then spellcheck, proofread and rewrite, or run a custom writing instruction from the context menu or a shortcut.

Choose the AI setup that fits your workflow: a supported hosted service, a local AI server, Chrome built-in AI (preview), or a compatible endpoint you control. Model names are editable, and custom endpoint access is requested only for the endpoint you save.

Typollama processes text only when you invoke a writing tool. It has no account, analytics, advertising, or Typollama-operated processing server. Hosted requests go directly to the service you choose; local requests go to the server you configure. Some rich-text editors block safe programmatic updates; on those sites Typollama copies the completed result for you to paste instead.

## Upload assets

Use these current, non-distorted PNG files:

- `images/store-01-writing.png`
- `images/store-02-providers.png`
- `images/store-03-tools.png`
- `images/store-04-privacy.png`
- `images/store-promo-small.png` (440 × 280)
- `images/store-promo-marquee.png` (1400 × 560)

## Privacy dashboard answers

Use the actual final behavior, not aspirational claims:

- **Single purpose:** Improve user-selected or active-editor text with user-invoked AI writing tools.
- **Permissions:** `storage` saves settings and encrypted API keys; `contextMenus` exposes the three user-invoked writing actions; `clipboardWrite` copies a completed result when direct replacement is unsafe; host access is needed to inject the tool into editable web pages and to call only the selected supported or user-approved provider endpoint.
- **Remote code:** No. All executable code is packaged with the extension; API responses are treated as text, not code.
- **Data handled:** Website content/form text, user-generated content, and authentication information (API keys). All are necessary to perform the writing request the user starts.
- **Data use:** Text and instructions are sent only to the selected provider or local endpoint for the requested transformation. API keys stay in encrypted trusted local storage. Typollama does not sell data, use it for ads, or send it to a Typollama-operated backend.
- **Privacy-policy URL:** Publish [PRIVACY.md](PRIVACY.md) at a stable public HTTPS URL before submission, then use that URL in the dashboard.

## Release checklist

- [ ] Update `version` in `manifest.json` and `package.json` together.
- [ ] Run `npm test`, `npm run check`, and `npm run package` from a clean checkout.
- [ ] Load the unpacked build in Chrome and test spellcheck, proofread, custom prompt, clipboard-only mode, and an editor that rejects direct edits.
- [ ] Verify each provider you advertise using an account and model you are authorized to use.
- [ ] Host the privacy policy at a stable public HTTPS URL; add that exact URL in the Chrome Web Store dashboard.
- [ ] Upload the archive from `dist/`, current screenshots, and the promotional images.
- [ ] Complete the Privacy practices section using the answers above, then verify every disclosure matches the final build.
- [ ] Review the store listing for accurate claims, current pricing references, and working links.

Chrome requires listing and privacy disclosures to accurately reflect the extension and encourages minimum permissions. See the official [privacy dashboard guidance](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy) and [listing requirements](https://developer.chrome.com/docs/webstore/program-policies/listing-requirements).
