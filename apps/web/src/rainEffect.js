let rainActive = false;
let canvas = null;
let ctx = null;
let animationId = null;
let drops = [];
let chatElement = null;
let composerElement = null;
let rainIntensity = 0; // 0 - 1
let maxIntensity = 1;
let intensitySpeed = 0.002; // скорость нарастания

class Drop {
    constructor(x, y, speed, intensity) {
        this.x = x;
        this.y = y;
        this.speed = speed;
        this.length = Math.random() * 15 + 5;
        this.alive = true;
        this.intensity = intensity || 0;
    }

    getColor() {
        // Переход от синего к серому в зависимости от интенсивности
        const r = Math.round(100 + 65 * this.intensity);
        const g = Math.round(150 + 15 * this.intensity);
        const b = Math.round(255 - 90 * this.intensity);
        const alpha = 0.3 + 0.4 * this.intensity;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    update() {
        if (!this.alive) return;
        const prevY = this.y;
        this.y += this.speed;

        // Проверка столкновения с сообщениями
        const messages = chatElement?.querySelectorAll('.msg');
        if (messages) {
            for (const msg of messages) {
                const rect = msg.getBoundingClientRect();
                if (
                    this.x > rect.left &&
                    this.x < rect.right &&
                    this.y + this.length > rect.top &&
                    prevY < rect.bottom
                ) {
                    this.splash(msg, rect);
                    this.alive = false;
                    return;
                }
            }
        }

        // Проверка столкновения с композером
        if (composerElement) {
            const rect = composerElement.getBoundingClientRect();
            if (
                this.x > rect.left &&
                this.x < rect.right &&
                this.y + this.length > rect.top &&
                prevY < rect.bottom
            ) {
                this.splash(composerElement, rect);
                this.alive = false;
                return;
            }
        }

        // Вышла за экран
        if (this.y > window.innerHeight) {
            this.alive = false;
        }
    }

    splash(element, rect) {
        const splashDrops = [];
        const splashCount = Math.floor(2 + this.intensity * 4);
        const intensity = this.intensity;
        for (let i = 0; i < splashCount; i++) {
            splashDrops.push({
                x: this.x + (Math.random() - 0.5) * 10,
                y: rect.top + Math.random() * 10,
                vx: (Math.random() - 0.5) * (6 + intensity * 6),
                vy: -(Math.random() * (4 + intensity * 6) + 2),
                life: 0.8 + Math.random() * 0.4,
                size: Math.random() * (1 + intensity * 3) + 1,
                intensity: intensity
            });
        }
        splashes.push(...splashDrops);
    }

    draw() {
        if (!this.alive) return;
        ctx.strokeStyle = this.getColor();
        ctx.lineWidth = 1 + this.intensity * 0.5;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x, this.y + this.length);
        ctx.stroke();
    }
}

let splashes = [];

export function startRain() {
    if (rainActive) return;
    rainActive = true;
    rainIntensity = 0;

    chatElement = document.querySelector('.messages');
    composerElement = document.querySelector('.composer');

    canvas = document.createElement('canvas');
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '9999';
    document.body.appendChild(canvas);

    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);

    drops = [];
    splashes = [];
    animate();
}

export function stopRain() {
    rainActive = false;
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
    if (canvas) {
        canvas.remove();
        canvas = null;
        ctx = null;
    }
    drops = [];
    splashes = [];
    rainIntensity = 0;
    window.removeEventListener('resize', resize);
}

function resize() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function animate() {
    if (!rainActive) return;

    // Плавно увеличиваем интенсивность до максимума
    if (rainIntensity < maxIntensity) {
        rainIntensity = Math.min(rainIntensity + intensitySpeed, maxIntensity);
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Количество капель зависит от интенсивности (от 20 до 200)
    const maxDrops = Math.floor(20 + rainIntensity * 180);
    const spawnChance = 0.2 + rainIntensity * 0.7;

    // Создаём новые капли
    if (drops.length < maxDrops && Math.random() < spawnChance) {
        const speed = 6 + rainIntensity * 14 + Math.random() * 4;
        drops.push(new Drop(
            Math.random() * canvas.width,
            -10 - Math.random() * 30,
            speed,
            rainIntensity
        ));
    }

    // Обновляем и рисуем капли
    for (const drop of drops) {
        drop.update();
        drop.draw();
    }

    // Обновляем и рисуем брызги
    for (let i = splashes.length - 1; i >= 0; i--) {
        const s = splashes[i];
        s.x += s.vx;
        s.y += s.vy;
        s.vy += 0.2 + s.intensity * 0.2;
        s.life -= 0.03 + s.intensity * 0.02;

        if (s.life <= 0) {
            splashes.splice(i, 1);
            continue;
        }

        // Цвет брызг тоже меняется
        const r = Math.round(100 + 65 * s.intensity);
        const g = Math.round(150 + 15 * s.intensity);
        const b = Math.round(255 - 90 * s.intensity);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${s.life * 0.7})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size * (0.5 + s.life * 0.5), 0, Math.PI * 2);
        ctx.fill();
    }

    // Удаляем мёртвые капли
    drops = drops.filter(d => d.alive);

    animationId = requestAnimationFrame(animate);
}
