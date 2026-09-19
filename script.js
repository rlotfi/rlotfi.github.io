// Shared behaviour for every page: header, mobile menu, section highlighting,
// scroll reveals, case study modals and the contact-form toast.
(function () {
    'use strict';

    document.documentElement.classList.add('js');

    // ---------------------------------------------------------------------
    // Header: shadow once the page scrolls + highlight the current section
    // ---------------------------------------------------------------------
    const header = document.querySelector('.site-header');
    const nav = document.getElementById('site-nav');
    const toggle = document.querySelector('.nav-toggle');

    const spyLinks = nav ? Array.from(nav.querySelectorAll('a[href^="#"]')) : [];
    const spySections = spyLinks
        .map(link => document.getElementById(link.getAttribute('href').slice(1)))
        .filter(Boolean);

    function updateHeader() {
        if (header) header.classList.toggle('is-scrolled', window.scrollY > 8);
        if (!spySections.length) return;

        const line = window.innerHeight * 0.35;
        let current = null;
        spySections.forEach(section => {
            if (section.getBoundingClientRect().top <= line) current = section;
        });
        const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
        if (atBottom) current = spySections[spySections.length - 1];

        spyLinks.forEach(link => {
            link.classList.toggle('is-active', !!current && link.getAttribute('href') === '#' + current.id);
        });
    }

    let ticking = false;
    window.addEventListener('scroll', () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
            updateHeader();
            ticking = false;
        });
    }, { passive: true });
    window.addEventListener('resize', updateHeader, { passive: true });
    updateHeader();

    // ---------------------------------------------------------------------
    // Mobile menu
    // ---------------------------------------------------------------------
    function setMenu(open) {
        if (!header || !toggle) return;
        header.classList.toggle('nav-open', open);
        toggle.setAttribute('aria-expanded', String(open));
        toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    }

    if (toggle && nav) {
        toggle.addEventListener('click', () => setMenu(!header.classList.contains('nav-open')));
        nav.addEventListener('click', event => {
            if (event.target.closest('a')) setMenu(false);
        });
        document.addEventListener('click', event => {
            if (!header.contains(event.target)) setMenu(false);
        });
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape') setMenu(false);
        });
        window.matchMedia('(min-width: 861px)').addEventListener('change', event => {
            if (event.matches) setMenu(false);
        });
    }

    // ---------------------------------------------------------------------
    // Scroll reveal
    // ---------------------------------------------------------------------
    document.querySelectorAll('[data-stagger]').forEach(group => {
        Array.from(group.children).forEach((child, i) => {
            child.classList.add('reveal');
            child.style.setProperty('--delay', (i * 80) + 'ms');
        });
    });

    const revealItems = document.querySelectorAll('.reveal');
    if ('IntersectionObserver' in window) {
        const revealObserver = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('is-visible');
                revealObserver.unobserve(entry.target);
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
        revealItems.forEach(item => revealObserver.observe(item));
    } else {
        revealItems.forEach(item => item.classList.add('is-visible'));
    }

    // ---------------------------------------------------------------------
    // Case study modals
    // ---------------------------------------------------------------------
    let instagramScript;
    function loadInstagram() {
        if (window.instgrm) return Promise.resolve();
        if (!instagramScript) {
            instagramScript = new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://www.instagram.com/embed.js';
                script.async = true;
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }
        return instagramScript;
    }

    // Instagram posts are plain links until their case study is opened, so the
    // page doesn't load a dozen embeds up front.
    function loadEmbeds(dialog) {
        const links = dialog.querySelectorAll('a.ig-embed');
        if (!links.length) return;

        links.forEach(link => {
            const quote = document.createElement('blockquote');
            quote.className = 'instagram-media';
            quote.setAttribute('data-instgrm-permalink', link.href);
            quote.setAttribute('data-instgrm-version', '14');
            link.classList.remove('ig-embed');
            link.replaceWith(quote);
            quote.appendChild(link);
        });

        loadInstagram()
            .then(() => window.instgrm && window.instgrm.Embeds.process())
            .catch(() => { /* blocked: the fallback links stay visible */ });
    }

    function openCase(id, updateUrl) {
        const dialog = document.getElementById(id);
        if (!dialog || typeof dialog.showModal !== 'function') return false;
        if (!dialog.open) dialog.showModal();
        dialog.scrollTop = 0;
        loadEmbeds(dialog);
        if (updateUrl) history.replaceState(null, '', '#' + id);
        return true;
    }

    document.querySelectorAll('dialog.case-modal').forEach(dialog => {
        const close = dialog.querySelector('.modal-close');
        if (close) close.addEventListener('click', () => dialog.close());

        // Clicking the dimmed backdrop closes the modal
        dialog.addEventListener('click', event => {
            if (event.target === dialog) dialog.close();
        });

        dialog.addEventListener('close', () => {
            if (location.hash === '#' + dialog.id) {
                history.replaceState(null, '', location.pathname + location.search + '#work');
            }
        });
    });

    document.querySelectorAll('[data-case]').forEach(card => {
        card.addEventListener('click', event => {
            if (openCase(card.dataset.case, true)) event.preventDefault();
        });
    });

    function openFromHash() {
        const id = location.hash.slice(1);
        if (!id.startsWith('case-') || !document.getElementById(id)) return;
        const work = document.getElementById('work');
        if (work) {
            window.scrollTo({ top: work.getBoundingClientRect().top + window.scrollY, behavior: 'instant' });
        }
        openCase(id, false);
    }
    openFromHash();
    window.addEventListener('hashchange', openFromHash);

    // ---------------------------------------------------------------------
    // Follower counts on the case study tiles. The numbers in the HTML are a
    // fallback; data/followers.json is refreshed daily by a GitHub Action.
    // ---------------------------------------------------------------------
    const followerCounts = document.querySelectorAll('[data-followers]');
    if (followerCounts.length) {
        const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumSignificantDigits: 3 });
        fetch('data/followers.json', { cache: 'no-cache' })
            .then(response => (response.ok ? response.json() : Promise.reject(response.status)))
            .then(data => {
                followerCounts.forEach(el => {
                    const [account, platform] = el.dataset.followers.split('.');
                    const count = data.accounts && data.accounts[account] && data.accounts[account][platform];
                    if (count) el.textContent = compact.format(count);
                });
            })
            .catch(() => { /* keep the numbers already in the page */ });
    }

    // ---------------------------------------------------------------------
    // Contact form: FormSubmit redirects back with ?sent=1
    // ---------------------------------------------------------------------
    const toast = document.getElementById('toast');
    if (toast) {
        const hideToast = () => toast.classList.remove('show');
        const closeButton = toast.querySelector('.toast-close');
        if (closeButton) closeButton.addEventListener('click', hideToast);

        const params = new URLSearchParams(location.search);
        if (params.has('sent')) {
            params.delete('sent');
            const query = params.toString();
            history.replaceState(null, '', location.pathname + (query ? '?' + query : '') + location.hash);
            requestAnimationFrame(() => toast.classList.add('show'));
            setTimeout(hideToast, 6000);
        }
    }
})();
