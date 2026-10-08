# Lore Kernel UI+ (Chrome MV3 Extension)

Transforms lore.kernel.org pages into a modern, thread-focused interface with enhanced code/diff presentation — without breaking existing functionality.

## What it does
- Activates only on lore.kernel.org.
- Preserves all content and links, including the native search form and navigation.
- Adds a two-column layout: message content on the right, thread overview on the left.
- Improves readability with a clean, responsive design supporting light and dark modes.
- Highlights patch/diff elements already marked by the server (e.g., `.add`, `.del`, `.hunk`, `.head`).

## Files
- manifest.json — MV3 config, restricts to lore.kernel.org, injects scripts/styles at document_end.
- content.js — Minimal DOM transformation and enhancements.
- content.css — Responsive styling and diff highlighting.

## How the DOM is modified (documentation)
The extension executes after the page loads and performs the following safe, reversible transformations:

1) Header consolidation
- Moves the existing top-level search `<form>` into a sticky header for constant access.
- Adds a small brand label “Lore UI+” for user clarity.

2) Layout creation
- Creates an app shell with:
  - `<header class="lkui-header">` (sticky, contains search form)
  - `<div class="lkui-layout">`
    - `<aside class="lkui-sidebar">` (thread overview)
    - `<main class="lkui-main">` (message content)

3) Thread overview extraction
- Locates the `Thread overview:` block by finding `b#t` and cloning its closest `<pre>` container into the sidebar.
- The original overview remains in the page content if present; a cloned copy sits in the sidebar for easier navigation.

4) Title elevation
- If a `<u><b>…</b></u>` title exists, a separate `<h1 class="lkui-title">…</h1>` is added to the top of the main content for better hierarchy.

5) Content preservation
- All other existing top-level nodes (including `<pre>` blocks with message text, links like `permalink`, `raw`, `reply`, `related`, etc.) are moved into `<main>` as-is to preserve behavior.
- Every `<pre>` within main gets a `lkui-pre` class to receive “card” styling without altering its inner content or anchors.

6) Diff/code presentation
- The site already emits spans within diffs (e.g., `<span class="add">…</span>`, `<span class="hunk">…</span>`, `<span class="head">…</span>`). The stylesheet colors and emphasizes these for immediate, low-risk syntax highlighting without parsing text or modifying anchors.

7) Responsiveness
- On narrow screens (<= 1000px), the layout collapses to a single column, placing the sidebar under the main content to maintain readability.

## Maintainability
- All new DOM nodes/classes are namespaced with `lkui-` to avoid collisions with site classes.
- No removal of original elements; nodes are reordered or cloned while preserving IDs and anchors.
- Styling uses CSS variables and respects the user’s color scheme preference.
- The logic avoids brittle text parsing and relies on structural cues (e.g., `b#t` for thread overview) that are stable across lore pages.

## Installation (developer)
1. Visit chrome://extensions in Chrome.
2. Enable Developer Mode.
3. Click “Load unpacked” and select this folder.
4. Navigate to any lore.kernel.org page to see the enhanced UI.

## Notes
- If lore.kernel.org changes markup significantly, the sidebar extraction (based on `b#t`) may need to be adjusted.
- All features are client-side; disabling the extension reverts to the original site immediately.