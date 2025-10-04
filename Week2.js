// Week2.js — 内嵌编辑器 + 答案按钮 + 轻量自动完成

// ================== 1) 可编辑 Playground ==================
(() => {
    function buildPlayground(el){
        const title = el.getAttribute('data-title') || 'Playground';
        const initHTML = el.getAttribute('data-init-html') || '<p>Hello</p>';
        const initCSS  = el.getAttribute('data-init-css')  || 'p{color: black}';

        el.innerHTML = `
      <div class="pg-bar">
        <div class="pg-title">${title}</div>
        <div class="pg-actions">
          <button class="pg-btn" data-act="reset">重置</button>
          <button class="pg-btn" data-act="copy">复制代码</button>
          <button class="pg-btn primary" data-act="run">运行 ▶</button>
        </div>
      </div>

      <div class="pg-grid">
        <div class="pg-edit">
          <header>HTML</header>
          <textarea class="pg-html" spellcheck="false">${initHTML}</textarea>
          <header>CSS（仅用命名色，如 purple、lightgray）</header>
          <textarea class="pg-css" spellcheck="false">${initCSS}</textarea>
        </div>
        <div class="pg-preview">
          <header>预览</header>
          <iframe class="pg-frame" title="${title} — 预览" sandbox="allow-same-origin"></iframe>
        </div>
      </div>
    `;

        const taHTML = el.querySelector('.pg-html');
        const taCSS  = el.querySelector('.pg-css');
        const frame  = el.querySelector('.pg-frame');

        function render(){
            const doc = `
<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  html,body{margin:12px;font-family:system-ui, -apple-system, Segoe UI, Roboto, Arial}
  ${taCSS.value || ''}
</style>
</head>
<body>
${taHTML.value || '<p>（请在左侧输入 HTML）</p>'}
</body>
</html>`;
            const blob = new Blob([doc], {type: 'text/html;charset=utf-8'});
            const url = URL.createObjectURL(blob);
            frame.src = url;
            frame.addEventListener('load', () => {
                setTimeout(() => URL.revokeObjectURL(url), 500);
            }, { once: true });
        }

        // 初始渲染
        render();

        // 操作按钮
        el.addEventListener('click', async (e) => {
            const btn = e.target.closest('[data-act]');
            if(!btn) return;
            const act = btn.getAttribute('data-act');
            if(act === 'run'){ render(); }
            if(act === 'reset'){
                taHTML.value = initHTML;
                taCSS.value  = initCSS;
                render();
            }
            if(act === 'copy'){
                const content = `/* HTML */\n${taHTML.value}\n\n/* CSS */\n${taCSS.value}`;
                try{
                    await navigator.clipboard.writeText(content);
                    btn.textContent = '已复制';
                    setTimeout(() => btn.textContent = '复制代码', 1000);
                }catch{
                    const ta = document.createElement('textarea');
                    ta.value = content; document.body.appendChild(ta);
                    ta.select(); document.execCommand('copy'); ta.remove();
                }
            }
        });

        // 快捷键：Cmd/Ctrl + Enter 运行
        el.addEventListener('keydown', (e) => {
            if((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'enter'){
                e.preventDefault(); render();
            }
        });
    }

    document.querySelectorAll('.playground').forEach(buildPlayground);
})();

// ================== 2) 显示/隐藏答案按钮 ==================
(() => {
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.ans-btn');
        if(!btn) return;
        const sel = btn.getAttribute('data-ans-target');
        const panel = document.querySelector(sel);
        if(!panel) return;
        const open = panel.classList.toggle('open');
        btn.textContent = open ? '隐藏答案' : '显示答案';
    });
})();

// ================== 3) 轻量自动完成（HTML/CSS） ==================
(() => {
    const HTML_TAGS = [
        'div','span','p','a','img','ul','ol','li','h1','h2','h3','h4','h5','h6',
        'button','input','label','form','section','article','nav','header','footer',
        'table','thead','tbody','tr','th','td','main','small','strong','em','br','hr'
    ];
    const HTML_ATTRS = ['class','id','href','src','alt','title','style','type','value','placeholder','for','target','rel','role','aria-label'];

    const CSS_PROPS = [
        'color','background','background-color','background-image','border','border-radius',
        'margin','margin-top','margin-right','margin-bottom','margin-left',
        'padding','padding-top','padding-right','padding-bottom','padding-left',
        'width','height','max-width','min-width','display','position','top','right','bottom','left','z-index',
        'font-family','font-size','font-weight','line-height','letter-spacing',
        'text-align','text-decoration','box-shadow','opacity','overflow','gap','justify-content','align-items','flex','flex-direction','flex-wrap'
    ];
    const CSS_VALUES = {
        display: ['block','inline','inline-block','flex','grid','none'],
        position: ['static','relative','absolute','fixed','sticky'],
        'flex-direction': ['row','row-reverse','column','column-reverse'],
        'justify-content': ['flex-start','center','flex-end','space-between','space-around','space-evenly'],
        'align-items': ['stretch','flex-start','center','flex-end','baseline'],
        'text-align': ['left','center','right','justify'],
        'font-weight': ['300','400','500','600','700','bold'],
        color: ['black','white','red','blue','green','purple','orange','gray','lightgray','lightyellow','rebeccapurple'],
        'background-color': ['white','lightgray','lightyellow','transparent'],
        'border-style': ['solid','dashed','dotted','double','none'],
    };

    let menu = null, items = [], activeIndex = -1, currentTA = null;

    function ensureMenu(){
        if(menu) return menu;
        menu = document.createElement('div');
        menu.className = 'ac-menu';
        menu.style.display = 'none';
        document.body.appendChild(menu);
        return menu;
    }
    function closeMenu(){
        if(menu){ menu.style.display = 'none'; menu.innerHTML = ''; }
        items = []; activeIndex = -1; currentTA = null;
    }
    function setActive(i){
        if(items.length === 0) return;
        if(activeIndex >= 0) items[activeIndex].classList.remove('is-active');
        activeIndex = (i + items.length) % items.length;
        items[activeIndex].classList.add('is-active');
    }
    function insertCompletion(ta, replacement, tokenRange){
        const {start, end} = tokenRange;
        const v = ta.value;
        ta.value = v.slice(0, start) + replacement + v.slice(end);
        const caret = start + replacement.length;
        ta.setSelectionRange(caret, caret);
        ta.focus();
        ta.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function getContext(ta){
        const pos = ta.selectionStart;
        const before = ta.value.slice(0, pos);
        const lineStart = before.lastIndexOf('\n') + 1;
        const line = before.slice(lineStart);
        const m = line.match(/([a-zA-Z\-#\.][a-zA-Z0-9\-\_]*)$/);
        const token = m ? m[1] : '';
        const tokenRange = { start: pos - token.length, end: pos };
        const isHTML = ta.classList.contains('pg-html');
        const isCSS  = ta.classList.contains('pg-css');

        let wantValues = false, propName = '';
        if(isCSS){
            const colonIdx = line.indexOf(':');
            if(colonIdx !== -1 && colonIdx < line.length - token.length){
                wantValues = true;
                propName = line.slice(0, colonIdx).trim();
            }
        }
        return { token, tokenRange, isHTML, isCSS, wantValues, propName, line };
    }

    function buildSuggestions(ctx){
        const t = ctx.token.toLowerCase();
        let list = [];
        if(ctx.isHTML){
            const inTag = /<[^>]*$/.test(ctx.line);
            const pool = inTag ? HTML_TAGS : HTML_ATTRS;
            list = pool.filter(x => x.toLowerCase().startsWith(t));
        }else if(ctx.isCSS){
            if(ctx.wantValues && CSS_VALUES[ctx.propName]){
                list = CSS_VALUES[ctx.propName].filter(x => x.toLowerCase().startsWith(t));
            }else if(ctx.wantValues){
                const generic = ['initial','inherit','unset','revert','auto','none','0','1rem','2px','flex','block'];
                list = generic.filter(x => x.toLowerCase().startsWith(t));
            }else{
                list = CSS_PROPS.filter(x => x.toLowerCase().startsWith(t));
            }
        }
        return list.slice(0, 50);
    }

    function showMenu(ta){
        const ctx = getContext(ta);
        if(!ctx.token){ closeMenu(); return; }
        const suggestions = buildSuggestions(ctx);
        if(suggestions.length === 0){ closeMenu(); return; }

        const m = ensureMenu();
        m.innerHTML = '';
        items = suggestions.map((s) => {
            const el = document.createElement('div');
            el.className = 'ac-item';
            if(ctx.isCSS && !ctx.wantValues){
                el.innerHTML = `<span>${s}</span><span class="ac-meta">prop</span>`;
            }else if(ctx.isCSS && ctx.wantValues){
                el.innerHTML = `<span>${s}</span><span class="ac-meta">value</span>`;
            }else{
                const meta = HTML_TAGS.includes(s) ? 'tag' : 'attr';
                el.innerHTML = `<span>${s}</span><span class="ac-meta">${meta}</span>`;
            }
            el.addEventListener('mousedown', (e) => {
                e.preventDefault();
                insertCompletion(ta, s, ctx.tokenRange);
                closeMenu();
            });
            m.appendChild(el);
            return el;
        });

        setActive(0);

        const r = ta.getBoundingClientRect();
        m.style.left = `${window.scrollX + r.left + 8}px`;
        m.style.top  = `${window.scrollY + r.bottom + 6}px`;
        m.style.display = 'block';
        currentTA = ta;
    }

    document.addEventListener('keydown', (e) => {
        const ta = e.target;
        if(!(ta instanceof HTMLTextAreaElement)) return;
        const isOpen = menu && menu.style.display === 'block' && currentTA === ta;

        if((e.ctrlKey || e.metaKey) && e.key === ' '){
            e.preventDefault();
            showMenu(ta);
            return;
        }
        if(isOpen){
            if(e.key === 'ArrowDown'){ e.preventDefault(); setActive(activeIndex + 1); }
            else if(e.key === 'ArrowUp'){ e.preventDefault(); setActive(activeIndex - 1); }
            else if(e.key === 'Enter' || e.key === 'Tab'){
                e.preventDefault();
                const ctx = getContext(ta);
                const choice = items[activeIndex];
                if(choice){
                    const text = choice.querySelector('span').textContent;
                    insertCompletion(ta, text, ctx.tokenRange);
                }
                closeMenu();
            }else if(e.key === 'Escape'){ e.preventDefault(); closeMenu(); }
        }
    });

    document.addEventListener('input', (e) => {
        const ta = e.target;
        if(!(ta instanceof HTMLTextAreaElement)) return;
        const ctx = getContext(ta);
        if(ctx.token && /^[a-zA-Z\-#\.]+$/.test(ctx.token)){
            showMenu(ta);
        }else{
            closeMenu();
        }
    });

    document.addEventListener('mousedown', (e) => {
        if(menu && !menu.contains(e.target)) closeMenu();
    });
    window.addEventListener('scroll', closeMenu, true);
    window.addEventListener('resize', closeMenu);
})();

// ================== 4) 可选：顶栏高度自适应（与 Week1.js 兼容） ==================
(() => {
    const root   = document.documentElement;
    const topbar = document.querySelector('.topbar');
    if(!topbar) return;
    const update = () => {
        const h = Math.ceil(topbar.getBoundingClientRect().height);
        root.style.setProperty('--header-h', `${h}px`);
    };
    update();
    window.addEventListener('resize', () => { clearTimeout(update._t); update._t = setTimeout(update, 120); });
})();
