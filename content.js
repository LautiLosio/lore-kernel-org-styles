/* Lore Kernel UI+ — content script */
(function() {
  try {
    if (!location.hostname.endsWith('lore.kernel.org')) return;

    // Skip Anubis proof-of-work challenge pages to avoid breaking them
    const titleNode = document.querySelector('head > title');
    const bodyText = (document.body && document.body.textContent || '').slice(0, 2000);
    if ((titleNode && /Making sure you're not a bot!/i.test(titleNode.textContent || '')) || /This website is running Anubis/i.test(bodyText)) {
      return;
    }

    // Prevent double-injection
    if (document.getElementById('lkui-app')) return;

    const body = document.body;

    // Build shell
    const app = document.createElement('div');
    app.id = 'lkui-app';

    const header = document.createElement('header');
    header.className = 'lkui-header';

    const brand = document.createElement('a');
    brand.className = 'lkui-brand';
    brand.href = '/';
    brand.innerHTML = '<span class="emoji">🧵</span> Lore UI+';

    // Pull the existing search form to keep all functionality
    const searchForm = document.querySelector('body > form');
    if (searchForm) {
      // Tidy form fields
      const q = searchForm.querySelector('input[name="q"]');
      if (q && !q.getAttribute('placeholder')) q.setAttribute('placeholder', 'Search lore.kernel.org…');
      header.append(brand, searchForm);
    } else {
      header.append(brand);
    }

    const layout = document.createElement('div');
    layout.className = 'lkui-layout';

    const sidebar = document.createElement('aside');
    sidebar.className = 'lkui-sidebar';

    const main = document.createElement('main');
    main.className = 'lkui-main';

    // Create a resizer between main and sidebar
    const resizer = document.createElement('div');
    resizer.className = 'lkui-resizer';
    resizer.setAttribute('title', 'Drag to resize thread overview');

    // Find thread overview block: it usually has <b id="t">Thread overview:</b> inside a <pre>
    const overviewLabel = document.querySelector('b#t');
    const overviewPre = overviewLabel ? overviewLabel.closest('pre') : null;

    if (overviewPre) {
      const cloned = overviewPre.cloneNode(true);
      sidebar.appendChild(cloned);
    }

    // If no sidebar content (e.g., landing page), switch to single-column mode
    if (sidebar.childElementCount === 0) {
      layout.classList.add('lkui-single');
    }

    // Move the rest of the page into main, excluding the moved elements
    const toMove = [];
    for (const n of Array.from(body.childNodes)) {
      if (n === app) continue;
      if (n === searchForm) continue;
      // Drop stray whitespace at top-level
      if (n.nodeType === Node.TEXT_NODE && !n.textContent.trim()) continue;
      toMove.push(n);
    }
    toMove.forEach(n => main.appendChild(n));

    // Elevate the title (u > b) if present
    const titleEl = document.querySelector('u > b') || document.querySelector('title');
    if (titleEl) {
      const h1 = document.createElement('h1');
      h1.className = 'lkui-title';
      h1.textContent = titleEl.textContent || '';
      main.prepend(h1);
    }

    // Add card styling to pre blocks in main
    main.querySelectorAll('pre').forEach(pre => pre.classList.add('lkui-pre'));

    // Enhance listing pages (no sidebar => lkui-single)
    if (layout.classList.contains('lkui-single')) {
      const listingPres = Array.from(main.querySelectorAll('pre'));
      listingPres.forEach(pre => {
        // Heuristic: only transform if it contains anchors (likely listing)
        if (!pre.querySelector('a')) return;

        const entries = [];
        let current = null;
        for (const node of Array.from(pre.childNodes)) {
          if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'A') {
            const anchor = node;
            const prev = anchor.previousSibling && anchor.previousSibling.nodeType === Node.TEXT_NODE ? anchor.previousSibling.textContent || '' : '';
            const isChild = /`\s*$/.test(prev);
            if (isChild && current) {
              (current.children || (current.children = [])).push({ title: anchor.textContent || '', href: anchor.getAttribute('href') || anchor.href });
            } else {
              current = { title: anchor.textContent || '', href: anchor.getAttribute('href') || anchor.href, date: '', count: '', children: [] };
              entries.push(current);
            }
          } else if (node.nodeType === Node.TEXT_NODE) {
            const txt = (node.textContent || '').replace(/\s+/g, ' ').trim();
            if (!txt) continue;
            // Match a line like: 2025-08-21 19:48 UTC  (5+ messages)
            const m = txt.match(/(\d{4}-\d{2}-\d{2}[^U]*UTC)(?:\s*\(([^)]+)\))?/i);
            if (m && current) {
              current.date = m[1].trim();
              current.count = (m[2] || '').trim();
            }
          }
        }
        if (!entries.length) return;

        // Extract kind/tags + counts
        entries.forEach(e => {
          const m = (e.title || '').match(/^\s*\[([^\]]+)\]/);
          const inside = m ? (m[1] || '').toUpperCase() : '';
          let kind = 'OTHER';
          if (/GIT\s*PULL/.test(inside)) kind = 'GITPULL';
          else if (/PATCH/.test(inside)) kind = 'PATCH';
          else if (/RFC/.test(inside)) kind = 'RFC';
          const v = (inside.match(/\bV(\d+)\b/) || [])[1] || '';
          const countNum = (() => { const n = (e.count.match(/(\d+)/)||[])[1]; const num = n? parseInt(n,10):0; return Number.isNaN(num)?0:num; })();
          e.kind = kind;
          e.version = v;
          e.countNum = countNum;
        });

        // Build visual list + filters
        const wrap = document.createElement('div');
        wrap.className = 'lkui-list-wrap';

        const filterBar = document.createElement('div');
        filterBar.className = 'lkui-filterbar';

        const filters = [
          { key: 'PATCH', label: 'PATCH' },
          { key: 'GITPULL', label: 'GIT PULL' },
          { key: 'RFC', label: 'RFC' },
          { key: 'OTHER', label: 'Other' },
        ];
        const toggles = {};
        filters.forEach(f => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.textContent = f.label;
          btn.className = 'lkui-filter';
          btn.addEventListener('click', () => {
            btn.classList.toggle('is-active');
            toggles[f.key] = btn.classList.contains('is-active');
            applyFilter();
          });
          filterBar.appendChild(btn);
        });

        const extraFilters = [
          { key: 'HAS_REPLIES', label: 'Has replies 💬' },
          { key: 'HAS_SUBPATCHES', label: 'Has subpatches ⛓️' },
        ];
        extraFilters.forEach(f => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.textContent = f.label;
          btn.className = 'lkui-filter';
          btn.addEventListener('click', () => {
            btn.classList.toggle('is-active');
            toggles[f.key] = btn.classList.contains('is-active');
            applyFilter();
          });
          filterBar.appendChild(btn);
        });

        const list = document.createElement('div');
        list.className = 'lkui-list';

        const cards = entries.map(e => {
          const card = document.createElement('article');
          card.className = 'lkui-item';
          card.dataset.kind = e.kind;
          card.dataset.hasChildren = (e.children && e.children.length ? '1' : '0');
          card.dataset.count = String(e.countNum || 0);

          const title = document.createElement('h3');
          title.className = 'lkui-item-title';
          const icon = e.kind === 'PATCH' ? '🧩' : e.kind === 'GITPULL' ? '⬇️' : e.kind === 'RFC' ? '🧪' : '🧵';
          title.innerHTML = `<a href="${e.href}">${icon} ${e.title}</a>`;

          const tags = document.createElement('div');
          tags.className = 'lkui-tags';
          const tag = document.createElement('span');
          tag.className = 'lkui-tag ' + (e.kind === 'PATCH' ? 'is-patch' : e.kind === 'GITPULL' ? 'is-gitpull' : e.kind === 'RFC' ? 'is-rfc' : '');
          tag.textContent = e.kind === 'GITPULL' ? 'GIT PULL' : e.kind;
          tags.appendChild(tag);
          if (e.version) {
            const vtag = document.createElement('span');
            vtag.className = 'lkui-tag';
            vtag.textContent = `v${e.version}`;
            tags.appendChild(vtag);
          }

          const meta = document.createElement('div');
          meta.className = 'lkui-meta';
          const dateSpan = document.createElement('span');
          if (e.date) dateSpan.textContent = `⏰ ${e.date}`;
          const countSpan = document.createElement('span');
          if (e.count) {
            countSpan.className = 'lkui-badge';
            countSpan.textContent = `💬 ${e.count}`;
          }
          if (dateSpan.textContent) meta.appendChild(dateSpan);
          if (countSpan.textContent) meta.appendChild(countSpan);

          const chips = document.createElement('div');
          chips.className = 'lkui-chips';
          (e.children || []).forEach(c => {
            const chip = document.createElement('a');
            chip.href = c.href;
            chip.textContent = c.title;
            chip.className = 'lkui-chip';
            chips.appendChild(chip);
          });

          card.append(title, tags, meta, chips);
          list.appendChild(card);
          return card;
        });

        const applyFilter = () => {
          const activeKinds = Object.entries(toggles).filter(([k,v]) => v && (k==='PATCH'||k==='GITPULL'||k==='RFC'||k==='OTHER')).map(([k])=>k);
          const reqReplies = !!toggles.HAS_REPLIES;
          const reqSubs = !!toggles.HAS_SUBPATCHES;
          cards.forEach(card => {
            const kind = card.dataset.kind || 'OTHER';
            const count = parseInt(card.dataset.count||'0', 10) || 0;
            const hasChildren = card.dataset.hasChildren === '1';
            let ok = true;
            if (activeKinds.length && !activeKinds.includes(kind)) ok = false;
            if (reqReplies && !(count > 0)) ok = false;
            if (reqSubs && !hasChildren) ok = false;
            card.style.display = ok ? '' : 'none';
          });
        };

        // Insert visual list + filters before pre and keep original toggleable
        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'lkui-toggle-original';
        toggle.textContent = 'Show original list';
        let shown = false;
        toggle.addEventListener('click', () => {
          shown = !shown;
          pre.style.display = shown ? '' : 'none';
          toggle.textContent = shown ? 'Hide original list' : 'Show original list';
        });

        wrap.appendChild(filterBar);
        wrap.appendChild(list);

        pre.style.display = 'none';
        pre.parentNode.insertBefore(toggle, pre);
        pre.parentNode.insertBefore(wrap, toggle);
      });
    }

    // Load saved sidebar width (persisted across pages)
    const savedW = localStorage.getItem('lkui:sidebarW');
    if (savedW) {
      const val = parseInt(savedW, 10);
      if (!Number.isNaN(val)) document.documentElement.style.setProperty('--lkui-sidebar-w', Math.max(200, Math.min(560, val)) + 'px');
    }

    // Compose and attach app (main | resizer | sidebar => sidebar on the right)
    layout.append(main, resizer, sidebar);
    app.append(header, layout);
    body.appendChild(app);

    // Resizing logic
    let dragging = false;
    const onMove = e => {
      if (!dragging) return;
      const rect = layout.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const newW = Math.round(rect.right - clientX);
      const clamped = Math.max(200, Math.min(560, newW));
      document.documentElement.style.setProperty('--lkui-sidebar-w', clamped + 'px');
      e.preventDefault();
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      const current = getComputedStyle(document.documentElement).getPropertyValue('--lkui-sidebar-w').trim();
      const num = parseInt(current, 10);
      if (!Number.isNaN(num)) localStorage.setItem('lkui:sidebarW', String(num));
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
    };
    resizer.addEventListener('mousedown', e => {
      dragging = true;
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      e.preventDefault();
    });
    resizer.addEventListener('touchstart', e => {
      dragging = true;
      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('touchend', onUp);
      e.preventDefault();
    });

    // Optional: small footer note to clarify extension involvement
    const note = document.createElement('div');
    note.className = 'lkui-footer-note';
    note.textContent = 'UI improved by Lore UI+ (client-side). All original content and links preserved.';
    main.appendChild(note);
  } catch (e) {
    // Fail safe: never break the site
    console.warn('Lore UI+ content script error', e);
  }
})();