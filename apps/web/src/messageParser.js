export function parseMessage(text) {
    if (!text) return '';
    
    let html = text;
    
    // Экранируем HTML
    html = html.replace(/&/g, '&amp;')
               .replace(/</g, '&lt;')
               .replace(/>/g, '&gt;');
    
    // rain / stoprain — просто показываем метку
    html = html.replace(/^rain$/i, '<span style="opacity:0.6;font-size:11px;">🌧 дождь</span>');
    html = html.replace(/^stoprain$/i, '<span style="opacity:0.6;font-size:11px;">☀ дождь выключен</span>');
    
    // #тема цифра
    html = html.replace(
        /#(\w+)\s+(\d+)/g,
        '<span style="opacity:0.6;font-size:11px;">🎨 тема: $1/$2</span>'
    );
    
    // >///< или >/< или >//<
    html = html.replace(
        /&gt;(\/+?)&lt;/g,
        '<span class="shake-strong pink">$&</span>'
    );
    
    // ><
    html = html.replace(
        /&gt;&lt;/g,
        '<span class="shake-light">><</span>'
    );
    
    // **жирный синий**
    html = html.replace(
        /\*\*(.+?)\*\*/g,
        '<strong style="color: #4a9eff; font-style: italic;">$1</strong>'
    );
    
    // *наклоненный синий*
    html = html.replace(
        /\*(.+?)\*/g,
        '<em style="color: #4a9eff;">$1</em>'
    );
    
    // (полупрозрачный наклоненный)
    html = html.replace(
        /\((.+?)\)/g,
        '<span style="opacity: 0.5; font-style: italic;">($1)</span>'
    );
    
    // Дрожание
    if (/!{3,}|!\?/.test(text)) {
        html = `<span class="shake-hard">${html}</span>`;
    } else if (/!/.test(text)) {
        html = `<span class="shake-soft">${html}</span>`;
    }
    
    return html;
}
