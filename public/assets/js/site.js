(() => {
  'use strict';

  const NAV_ITEMS = [
    { href: '/', label: '首頁' },
    { href: '/introduction/', label: '系統介紹' },
    { href: '/student-manual/', label: '學生手冊' },
    { href: '/admin-manual/', label: '管理手冊' },
    { href: '/legal/', label: '條款與隱私' },
    { href: '/release-notes/', label: '發布紀錄' }
  ];

  const CONTACT_ITEM = {
    href: 'https://brid.pw/mailme',
    label: '聯絡我們'
  };

  const normalizePath = (value) => {
    const path = (value || '/').split('?')[0].split('#')[0];
    return path === '/' ? '/' : `${path.replace(/\/+$/, '')}/`;
  };

  const currentPath = normalizePath(window.location.pathname);

  const isActive = (href) => {
    const target = normalizePath(href);
    if (target === '/') return currentPath === '/';
    return currentPath.startsWith(target);
  };

  const injectGlobalStyles = () => {
    if (document.getElementById('docs-global-ui-styles')) return;

    const style = document.createElement('style');
    style.id = 'docs-global-ui-styles';
    style.textContent = `
      :root{--docs-page-width:1180px}
      .docs-navbar{position:sticky;top:0;z-index:10000;border-bottom:1px solid #d9e2de;background:rgba(255,255,255,.96);box-shadow:0 5px 18px rgba(19,37,31,.07);backdrop-filter:blur(14px);font-family:Arial,"Noto Sans TC","Microsoft JhengHei","PingFang TC",sans-serif}
      .docs-navbar__inner{width:min(100% - 24px,var(--docs-page-width));min-height:62px;margin:0 auto;display:flex;align-items:center;gap:24px}
      .docs-navbar__brand{flex:0 0 auto;color:#14364a!important;font-size:15px;font-weight:900;line-height:1.25;text-decoration:none!important;white-space:nowrap}
      .docs-navbar__links{display:flex;align-items:center;gap:4px;min-width:0;margin-left:auto;overflow-x:auto;scrollbar-width:none}
      .docs-navbar__links::-webkit-scrollbar{display:none}
      .docs-navbar__link{position:relative;display:inline-flex;align-items:center;min-height:42px;padding:8px 12px;border-radius:9px;color:#43545c!important;font-size:14px;font-weight:750;text-decoration:none!important;white-space:nowrap}
      .docs-navbar__link:hover{background:#eef5f2;color:#145340!important}
      .docs-navbar__link[aria-current="page"]{background:#e4f3ec;color:#145340!important}
      .docs-navbar__link[aria-current="page"]::after{content:"";position:absolute;left:12px;right:12px;bottom:5px;height:2px;border-radius:999px;background:#1b6f58}
      .docs-navbar__contact{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:8px 16px;border:1px solid #8f3212;border-radius:999px;background:#a63d17;color:#fff!important;box-shadow:0 5px 14px rgba(166,61,23,.28);font-size:14px;font-weight:900;letter-spacing:.02em;text-decoration:none!important;white-space:nowrap}
      .docs-navbar__contact:hover{background:#8f3212;color:#fff!important;box-shadow:0 7px 18px rgba(143,50,18,.34);transform:translateY(-1px)}
      .docs-navbar__contact:focus-visible{outline:3px solid #f4b28f;outline-offset:3px}
      .shell,.hero-inner{width:min(100% - 24px,var(--docs-page-width))!important;margin-left:auto!important;margin-right:auto!important}
      .layout,.intro-layout{width:min(100% - 24px,var(--docs-page-width))!important;margin-left:auto!important;margin-right:auto!important}
      .docs-global-dialog{width:min(96vw,1600px);max-height:96vh;padding:0;border:0;border-radius:16px;background:#f1f5f3;box-shadow:0 24px 80px rgba(0,0,0,.4)}
      .docs-global-dialog::backdrop{background:rgba(11,18,20,.76)}
      .docs-global-dialog__wrap{position:relative;max-height:96vh;overflow:auto}
      .docs-global-dialog__image{display:block;width:100%;height:auto}
      .docs-global-dialog__close{position:sticky;top:12px;z-index:3;float:right;margin:12px 12px -50px 0;padding:8px 13px;border:1px solid #c8d4cf;border-radius:999px;background:rgba(255,255,255,.96);color:#2a3d43;font-weight:800;cursor:pointer}
      @media(max-width:720px){.docs-navbar__inner{min-height:56px;gap:12px}.docs-navbar__brand{font-size:13px}.docs-navbar__link{padding:7px 10px;font-size:13px}.docs-navbar__contact{min-height:38px;padding:7px 13px;font-size:13px}}
      @media(max-width:640px){.shell,.hero-inner,.layout,.intro-layout{width:min(100% - 14px,var(--docs-page-width))!important}}
      @media(max-width:470px){.docs-navbar__inner{width:100%;padding:0 10px 7px;display:grid;grid-template-columns:minmax(0,1fr) 88px;gap:4px 10px}.docs-navbar__brand{grid-column:1/-1;display:block;padding:9px 4px 2px}.docs-navbar__links{min-width:0;margin:0 -2px;padding:0}.docs-navbar__link{min-height:36px}.docs-navbar__contact{width:88px;padding:7px 8px;align-self:center}}
      @media print{.docs-navbar,.docs-global-dialog{display:none!important}.shell,.hero-inner,.layout,.intro-layout{width:100%!important;margin-left:0!important;margin-right:0!important}}
    `;
    document.head.appendChild(style);
  };

  const removeAdHocNavigation = () => {
    document.querySelectorAll('.page-nav').forEach((node) => node.remove());

    if (currentPath === '/introduction/') {
      document.querySelectorAll('.hero-actions').forEach((group) => {
        const links = [...group.querySelectorAll('a[href]')];
        const onlyDocumentationLinks = links.length > 0 && links.every((link) => {
          const href = normalizePath(link.getAttribute('href'));
          return NAV_ITEMS.some((item) => normalizePath(item.href) === href);
        });
        if (onlyDocumentationLinks) group.remove();
      });
    }
  };

  const injectNavbar = () => {
    if (!document.body || document.querySelector('.docs-navbar')) return;

    const nav = document.createElement('nav');
    nav.className = 'docs-navbar';
    nav.setAttribute('aria-label', '全站文件導覽');

    const inner = document.createElement('div');
    inner.className = 'docs-navbar__inner';

    const brand = document.createElement('a');
    brand.className = 'docs-navbar__brand';
    brand.href = '/';
    brand.textContent = 'AI 英語面試練習系統';
    inner.appendChild(brand);

    const links = document.createElement('div');
    links.className = 'docs-navbar__links';

    NAV_ITEMS.forEach((item) => {
      const link = document.createElement('a');
      link.className = 'docs-navbar__link';
      link.href = item.href;
      link.textContent = item.label;
      if (isActive(item.href)) link.setAttribute('aria-current', 'page');
      links.appendChild(link);
    });

    inner.appendChild(links);
    const currentLink = links.querySelector('[aria-current="page"]');
    if (currentLink) {
      requestAnimationFrame(() => {
        const currentLeft = currentLink.offsetLeft - links.offsetLeft;
        links.scrollLeft = Math.max(0, currentLeft - ((links.clientWidth - currentLink.clientWidth) / 2));
      });
    }

    const contact = document.createElement('a');
    contact.className = 'docs-navbar__contact';
    contact.href = CONTACT_ITEM.href;
    contact.target = '_blank';
    contact.rel = 'noopener noreferrer';
    contact.textContent = CONTACT_ITEM.label;
    contact.setAttribute('aria-label', `${CONTACT_ITEM.label}（另開新分頁）`);
    inner.appendChild(contact);

    nav.appendChild(inner);
    document.body.insertBefore(nav, document.body.firstChild);
  };

  const ensureFallbackDialog = () => {
    let dialog = document.getElementById('docsGlobalImageDialog');
    if (dialog) return dialog;

    dialog = document.createElement('dialog');
    dialog.id = 'docsGlobalImageDialog';
    dialog.className = 'docs-global-dialog';
    dialog.innerHTML = `
      <div class="docs-global-dialog__wrap">
        <button class="docs-global-dialog__close" type="button" aria-label="關閉放大圖片">✕ 關閉</button>
        <img class="docs-global-dialog__image" alt="放大圖片">
      </div>
    `;
    document.body.appendChild(dialog);

    dialog.querySelector('.docs-global-dialog__close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
    return dialog;
  };

  const openImage = (source, altText = '放大圖片') => {
    if (!source) return;

    const standardDialog = document.getElementById('imageModal');
    const standardImage = document.getElementById('modalImage');
    if (standardDialog && standardImage && typeof standardDialog.showModal === 'function') {
      standardImage.src = source;
      standardImage.alt = altText;
      if (!standardDialog.open) standardDialog.showModal();
      return;
    }

    const adminDialog = document.getElementById('modal');
    const adminImage = document.getElementById('modalImg');
    if (adminDialog && adminImage && typeof adminDialog.showModal === 'function') {
      adminImage.src = source;
      adminImage.alt = altText;
      if (!adminDialog.open) adminDialog.showModal();
      return;
    }

    const dialog = ensureFallbackDialog();
    const image = dialog.querySelector('.docs-global-dialog__image');
    image.src = source;
    image.alt = altText;
    if (!dialog.open) dialog.showModal();
  };

  const bindImageZoom = () => {
    document.addEventListener('click', (event) => {
      const trigger = event.target.closest('[data-zoom-src],.figure-card button,.shot-btn,.screen-button');
      if (!trigger) return;

      const image = trigger.querySelector('img');
      const source = trigger.dataset.zoomSrc || trigger.dataset.img || image?.currentSrc || image?.src;
      if (!source) return;

      event.preventDefault();
      openImage(source, trigger.dataset.zoomAlt || image?.alt || trigger.getAttribute('aria-label') || '放大圖片');
    });

    document.querySelectorAll('[data-dialog-close],.modal-close,.close').forEach((button) => {
      if (button.dataset.docsCloseBound) return;
      button.dataset.docsCloseBound = 'true';
      button.addEventListener('click', () => button.closest('dialog')?.close());
    });
  };

  const bindSectionSpy = () => {
    const navigation = document.querySelectorAll('[data-spy-nav] a[href^="#"],.sidebar a[href^="#"]');
    if (!navigation.length || !('IntersectionObserver' in window)) return;

    const sections = [...navigation]
      .map((link) => document.querySelector(link.getAttribute('href')))
      .filter(Boolean);

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        navigation.forEach((link) => {
          link.classList.toggle('active', link.getAttribute('href') === `#${entry.target.id}`);
        });
      });
    }, { rootMargin: '-18% 0px -66% 0px' });

    sections.forEach((section) => observer.observe(section));
  };

  injectGlobalStyles();
  removeAdHocNavigation();
  injectNavbar();
  bindImageZoom();
  bindSectionSpy();
})();
