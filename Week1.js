(() => {
    const root = document.documentElement;
    const btn  = document.getElementById('themeToggle');
    const KEY  = 'cs5063-theme'; // 'light' | 'dark' | ''(跟随系统)

    const prefersDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;

    function apply(theme){               // theme: 'light' | 'dark' | ''(移除手动设置)
        if(theme) root.setAttribute('data-theme', theme);
        else root.removeAttribute('data-theme');
        localStorage.setItem(KEY, theme || '');
        updateBtn();
    }

    function currentTheme(){
        const t = root.getAttribute('data-theme');
        return t || (prefersDark() ? 'dark' : 'light');
    }

    function updateBtn(){
        const t = currentTheme();
        const isDark = (t === 'dark');
        btn.setAttribute('aria-pressed', String(isDark));
        btn.title = isDark ? '切换到亮色' : '切换到深色';
        btn.querySelector('.icon').textContent  = isDark ? '🌙' : '☀️';
        btn.querySelector('.label').textContent = isDark ? '深色' : '浅色';
    }

    // 初始化（加载上次选择）
    const saved = localStorage.getItem(KEY);
    if(saved === 'light' || saved === 'dark'){ root.setAttribute('data-theme', saved); }
    updateBtn();

    // 点击切换
    btn.addEventListener('click', () => {
        const next = currentTheme() === 'dark' ? 'light' : 'dark';
        apply(next);
    });

    // 若未手动设置，跟随系统变化时同步按钮显示（样式由 @media 自动生效）
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener?.('change', () => { if(!root.getAttribute('data-theme')) updateBtn(); });
    // 兼容旧浏览器（Safari 13-）
    mq.addListener?.(() => { if(!root.getAttribute('data-theme')) updateBtn(); });
})();


// ===== Sticky Header Anchor Fix + Active Link =====
(() => {
    const topbar = document.querySelector('.topbar');
    const navLinks = [...document.querySelectorAll('.nav a[href^="#"]')];
    const sections = navLinks
        .map(a => document.querySelector(a.getAttribute('href')))
        .filter(Boolean);

    // 1) 动态写入 --header-h，适配换行/缩放
    function setHeaderHeightVar(){
        const h = topbar.getBoundingClientRect().height;
        document.documentElement.style.setProperty('--header-h', `${Math.ceil(h)}px`);
    }
    setHeaderHeightVar();
    window.addEventListener('resize', () => {
        // 简易节流
        clearTimeout(setHeaderHeightVar._t);
        setHeaderHeightVar._t = setTimeout(setHeaderHeightVar, 120);
    });

    // 2) 拦截点击，使用 scrollIntoView（吃到 scroll-padding-top）
    navLinks.forEach(a => {
        a.addEventListener('click', (e) => {
            const id = a.getAttribute('href');
            if (!id || id === '#') return;
            const target = document.querySelector(id);
            if (!target) return;

            e.preventDefault();
            // 平滑滚动到目标（顶部对齐）
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });

            // 更新地址栏 hash（不触发瞬移）
            history.pushState(null, '', id);
        });
    });

    // 3) 自动高亮当前章节的导航
    // 观察靠近视口顶部的 20% 高度区域，谁进入谁高亮
    const io = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const id = `#${entry.target.id}`;
            const link = navLinks.find(a => a.getAttribute('href') === id);
            if (!link) return;
            if (entry.isIntersecting) {
                navLinks.forEach(l => { l.classList.remove('active'); l.removeAttribute('aria-current'); });
                link.classList.add('active');
                link.setAttribute('aria-current', 'location');
            }
        });
    }, {
        root: null,
        rootMargin: `-${Math.max(0, parseInt(getComputedStyle(document.documentElement)
            .getPropertyValue('--header-h')))}px 0px -80% 0px`,
        threshold: 0.01
    });

    sections.forEach(s => io.observe(s));
})();

