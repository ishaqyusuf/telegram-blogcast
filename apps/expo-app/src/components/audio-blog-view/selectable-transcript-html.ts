export const SELECTABLE_TRANSCRIPT_HTML = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';" />
  <style>
    html, body { margin: 0; min-height: 100%; background: transparent; }
    body { opacity: 0; overflow-y: auto; }
    #root {
      box-sizing: border-box; min-height: 100vh; padding: 120px 24px;
      color: rgba(255,255,255,.48); direction: rtl; text-align: right;
      unicode-bidi: plaintext; white-space: pre-wrap; word-break: normal;
      overflow-wrap: normal; hyphens: none; font-family: system-ui, sans-serif;
      font-size: 26px; line-height: 40px; font-weight: 700;
      -webkit-user-select: text; user-select: text;
    }
    .segment { color: rgba(255,255,255,.48); }
    .segment.active-segment { color: rgba(255,255,255,.86); }
    .run.active-word { color: #fff; background: rgba(255,255,255,.08); }
    ::selection { background: rgba(96,165,250,.42); color: #fff; }
  </style>
</head>
<body><main id="root" aria-label="Transcript"></main>
<script>
(() => {
  const root = document.getElementById('root');
  const state = {
    activeSegmentIndex: -1, activeWordIndex: -1, userScrolling: false,
    hydrating: false, fontScale: 1, presentation: 'read', selectionEnabled: true,
    longPressTriggered: false
  };
  let lastMessage = ''; let lastMessageAt = 0; let edgeTimer = 0;
  let selectionTimer = 0; let longPressTimer = 0;
  const post = (message) => window.ReactNativeWebView &&
    window.ReactNativeWebView.postMessage(JSON.stringify(message));
  const segmentSelector = (index) => '[data-segment-index="' + index + '"]';

  function setFontScale(value) {
    const scale = Number.isFinite(value) ? Math.max(.8, value) : 1;
    state.fontScale = scale;
    const fontSize = state.presentation === 'karaoke' ? 28 : 26;
    root.style.fontSize = (fontSize * scale) + 'px'; root.style.lineHeight = (40 * scale) + 'px';
  }

  function applyPresentation(message) {
    state.presentation = message.presentation === 'karaoke' ? 'karaoke' : 'read';
    const background = state.presentation === 'karaoke' ? 'transparent' : '#080807';
    document.documentElement.style.background = background;
    document.body.style.background = background;
    state.selectionEnabled = message.selectionEnabled !== false;
    const padding = Number.isFinite(message.contentPaddingVertical)
      ? Math.max(0, message.contentPaddingVertical) : 120;
    root.style.padding = padding + 'px 24px';
    root.style.userSelect = state.selectionEnabled ? 'text' : 'none';
    root.style.webkitUserSelect = state.selectionEnabled ? 'text' : 'none';
    setFontScale(message.fontScale);
  }

  function applyActive(segmentIndex, wordIndex) {
    root.querySelector('.active-segment')?.classList.remove('active-segment');
    root.querySelector('.active-word')?.classList.remove('active-word');
    state.activeSegmentIndex = segmentIndex; state.activeWordIndex = wordIndex;
    const segment = root.querySelector(segmentSelector(segmentIndex));
    segment?.classList.add('active-segment');
    segment?.querySelector('[data-word-index="' + wordIndex + '"]')?.classList.add('active-word');
  }

  function closestCenterKey() {
    const center = window.innerHeight / 2; let best = null; let distance = Infinity;
    root.querySelectorAll('[data-segment-key]').forEach((element) => {
      const rect = element.getBoundingClientRect();
      const nextDistance = Math.abs((rect.top + rect.bottom) / 2 - center);
      if (nextDistance < distance) { distance = nextDistance; best = element.dataset.segmentKey; }
    });
    return best;
  }

  function pointAtOffset(targetOffset) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let remaining = Math.max(0, targetOffset); let node = walker.nextNode(); let last = root;
    while (node) {
      last = node; const length = node.nodeValue?.length || 0;
      if (remaining <= length) return { node, offset: remaining };
      remaining -= length; node = walker.nextNode();
    }
    return { node: last, offset: last.nodeValue?.length || 0 };
  }

  function absoluteOffset(node, offset) {
    if (!node || !root.contains(node)) return null;
    const range = document.createRange(); range.selectNodeContents(root); range.setEnd(node, offset);
    return range.toString().length;
  }

  function restoreSelection(selection) {
    if (!selection) return;
    const start = pointAtOffset(selection.startOffset); const end = pointAtOffset(selection.endOffset);
    const anchor = pointAtOffset(selection.dragStartOffset);
    const focus = selection.dragStartOffset === selection.endOffset ? start : end;
    const range = document.createRange(); range.setStart(start.node, start.offset); range.setEnd(end.node, end.offset);
    const selected = window.getSelection(); selected.removeAllRanges();
    if (selected.setBaseAndExtent) selected.setBaseAndExtent(anchor.node, anchor.offset, focus.node, focus.offset);
    else selected.addRange(range);
  }

  function render(message) {
    state.hydrating = true;
    applyPresentation(message);
    const previousActiveSegmentIndex = state.activeSegmentIndex;
    const previousKey = closestCenterKey(); const fragment = document.createDocumentFragment();
    message.segments.forEach((segment) => {
      if (segment.separatorBefore)
        fragment.appendChild(document.createTextNode(segment.separatorBefore));
      const container = document.createElement('span'); container.className = 'segment';
      container.dataset.segmentIndex = String(segment.index); container.dataset.segmentKey = segment.key;
      container.dataset.startOffset = String(segment.startOffset); container.dataset.endOffset = String(segment.endOffset);
      segment.runs.forEach((run) => {
        const span = document.createElement('span'); span.className = 'run'; span.textContent = run.text;
        span.dataset.startOffset = String(run.startOffset); span.dataset.endOffset = String(run.endOffset);
        if (run.wordIndex !== null) span.dataset.wordIndex = String(run.wordIndex);
        container.appendChild(span);
      });
      fragment.appendChild(container);
    });
    root.replaceChildren(fragment); applyActive(message.activeSegmentIndex, message.activeWordIndex);
    requestAnimationFrame(() => {
      const shouldFollowActive = message.follow && previousActiveSegmentIndex !== message.activeSegmentIndex;
      const target = message.initial || shouldFollowActive
        ? root.querySelector(segmentSelector(message.activeSegmentIndex))
        : previousKey ? root.querySelector('[data-segment-key="' + CSS.escape(previousKey) + '"]') : null;
      target?.scrollIntoView({ block: 'center', behavior: 'auto' }); restoreSelection(message.selection);
      state.hydrating = false; document.body.style.opacity = '1'; post({ type: 'ready' });
    });
  }

  function sync(message) {
    const changed = state.activeSegmentIndex !== message.activeSegmentIndex;
    applyActive(message.activeSegmentIndex, message.activeWordIndex);
    if (message.follow && message.scrollToActive) {
      root.querySelector(segmentSelector(message.activeSegmentIndex))?.scrollIntoView({
        block: 'center', behavior: message.behavior === 'smooth' ? 'smooth' : 'auto'
      });
    }
  }

  function receive(event) {
    if (typeof event.data !== 'string') return;
    const now = Date.now(); if (event.data === lastMessage && now - lastMessageAt < 8) return;
    lastMessage = event.data; lastMessageAt = now;
    let message; try { message = JSON.parse(event.data); } catch { return; }
    if (message.type === 'hydrate') render(message);
    else if (message.type === 'sync') sync(message);
    else if (message.type === 'font-scale') setFontScale(message.fontScale);
    else if (message.type === 'clear-selection') window.getSelection()?.removeAllRanges();
  }
  window.addEventListener('message', receive); document.addEventListener('message', receive);

  function reportSelection() {
    clearTimeout(selectionTimer); selectionTimer = setTimeout(() => {
      if (state.hydrating || !state.selectionEnabled) return;
      const selected = window.getSelection();
      if (!selected || selected.isCollapsed || selected.rangeCount === 0) return post({ type: 'selection-cleared' });
      const range = selected.getRangeAt(0); const startOffset = absoluteOffset(range.startContainer, range.startOffset);
      const endOffset = absoluteOffset(range.endContainer, range.endOffset);
      const dragStartOffset = absoluteOffset(selected.anchorNode, selected.anchorOffset);
      if ([startOffset, endOffset, dragStartOffset].some((value) => value === null)) return;
      post({ type: 'selection', startOffset, endOffset, dragStartOffset });
    }, 30);
  }
  document.addEventListener('selectionchange', reportSelection);
  document.addEventListener('mouseup', reportSelection); document.addEventListener('touchend', reportSelection);
  function clearLongPress() { clearTimeout(longPressTimer); longPressTimer = 0; }
  document.addEventListener('pointerdown', (event) => {
    state.userScrolling = true; state.longPressTriggered = false; clearLongPress();
    if (state.presentation !== 'karaoke') return;
    const segment = event.target.closest?.('[data-segment-index]'); if (!segment) return;
    longPressTimer = setTimeout(() => {
      state.longPressTriggered = true;
      post({ type: 'long-press-segment', index: Number(segment.dataset.segmentIndex) });
    }, 500);
  });
  document.addEventListener('pointerup', clearLongPress);
  document.addEventListener('pointercancel', clearLongPress);
  document.addEventListener('touchstart', () => { state.userScrolling = true; }, { passive: true });
  document.addEventListener('wheel', () => { state.userScrolling = true; }, { passive: true });
  document.addEventListener('click', (event) => {
    if (state.longPressTriggered) { state.longPressTriggered = false; return; }
    if (!window.getSelection()?.isCollapsed) return;
    const segment = event.target.closest?.('[data-segment-index]'); if (!segment) return;
    post({ type: 'press-segment', index: Number(segment.dataset.segmentIndex), shouldPlay: event.detail > 1 });
  });
  window.addEventListener('scroll', () => {
    clearLongPress();
    if (state.userScrolling) { post({ type: 'manual-scroll' }); state.userScrolling = false; }
    clearTimeout(edgeTimer); edgeTimer = setTimeout(() => {
      if (window.scrollY < 160) post({ type: 'edge', edge: 'start' });
      if (window.scrollY + window.innerHeight > document.documentElement.scrollHeight - 260)
        post({ type: 'edge', edge: 'end' });
    }, 90);
  }, { passive: true });
})();
</script></body></html>`;
