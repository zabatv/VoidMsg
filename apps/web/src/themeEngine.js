let currentTheme = null;

export async function applyTheme(themeName, num) {
    try {
        const res = await fetch(`/themes/${themeName}/${num}/theme.json`);
        if (!res.ok) throw new Error('Тема не найдена');
        
        const theme = await res.json();
        const root = document.documentElement;
        
        root.style.setProperty('--bg', theme.bg);
        root.style.setProperty('--surface', theme.surface);
        root.style.setProperty('--surface-hover', theme.surfaceHover);
        root.style.setProperty('--border', theme.border);
        root.style.setProperty('--text', theme.text);
        root.style.setProperty('--text-secondary', theme.textSecondary);
        root.style.setProperty('--primary', theme.primary);
        root.style.setProperty('--primary-text', theme.primaryText);
        root.style.setProperty('--msg-other', theme.msgOther);
        root.style.setProperty('--msg-other-text', theme.msgOtherText);
        root.style.setProperty('--msg-mine', theme.msgMine);
        root.style.setProperty('--msg-mine-text', theme.msgMineText);
        
        if (theme.radius) {
            root.style.setProperty('--radius', theme.radius + 'px');
        }
        
        if (theme.wallpaper) {
            const ext = await detectWallpaperExt(themeName, num);
            if (ext) {
                document.body.style.backgroundImage = `url(/themes/${themeName}/${num}/wallpaper.${ext})`;
                document.body.style.backgroundSize = 'cover';
                document.body.style.backgroundPosition = 'center';
                document.body.style.backgroundAttachment = 'fixed';
            }
        } else {
            document.body.style.backgroundImage = '';
        }
        
        currentTheme = { name: themeName, num, theme };
        localStorage.setItem('customTheme', JSON.stringify({ name: themeName, num }));
        
        return theme;
    } catch (e) {
        console.error('Ошибка загрузки темы:', e);
        return null;
    }
}

async function detectWallpaperExt(themeName, num) {
    const exts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    for (const ext of exts) {
        try {
            const res = await fetch(`/themes/${themeName}/${num}/wallpaper.${ext}`, { method: 'HEAD' });
            if (res.ok) return ext;
        } catch (e) {}
    }
    return null;
}

export function resetTheme() {
    document.documentElement.removeAttribute('style');
    document.body.style.backgroundImage = '';
    document.body.style.backgroundSize = '';
    document.body.style.backgroundPosition = '';
    document.body.style.backgroundAttachment = '';
    currentTheme = null;
    localStorage.removeItem('customTheme');
}

export function getCurrentTheme() {
    return currentTheme;
}
