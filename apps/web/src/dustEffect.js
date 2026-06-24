let dustActive = false;
let canvas = null;
let ctx = null;
let animationId = null;
let particles = [];
let chatElement = null;
let composerElement = null;
let dustIntensity = 0;
let maxIntensity = 1;
let intensitySpeed = 0.002;

const DUST_COLOR = '#fec8a4';

class Particle {
    constructor(x, y, intensity) {
        this.x = x;
        this.y = y;
        this.size = Math.random() * 3 + 1;
        this.speedX = (Math.random() - 0.5) * 0.3;
        this.speedY = -(Math.random() * 0.2 + 0.05);
        this.opacity = Math.random() * 0.5 + 0.1;
        this.alive = true;
        this.intensity = intensity || 0;
        this.wobbleSpeed = Math.random() * 0.02 + 0.005;
        this.wobbleAmp = Math.random() * 0.3 + 0.1;
        this.wobbleOffset = Math.random() * Math.PI * 2;
        this.life = 1;
        this.decay = Math.random() * 0.002 + 0.001;
    }

    update() {
        if (!this.alive) return;
        this.life -= this.decay;

        this.speedX += (Math.random() - 0.5) * 0.02;
        this.speedX = Math.max(-0.5, Math.min(0.5, this.speedX));

        this.x += this.speedX + Math.sin(Date.now() * this.wobbleSpeed + this.wobbleOffset) * this.wobbleAmp;
        this.y += this.speedY;

        this.speedY = Math.max(-0.3, this.speedY + 0.0005);

        if (this.life <= 0 || this.y < -20 || this.x < -20 || this.x > (canvas?.width || window.innerWidth) + 20) {
            this.alive = false;
            return;
        }

        if (chatElement) {
            const messages = chatElement.querySelectorAll('.msg');
            for (const msg of messages) {
                const rect = msg.getBoundingClientRect();
                if (
                    this.x > rect.left &&
                    this.x < rect.right &&
                    this.y > rect.top &&
                    this.y < rect.bottom
                ) {
                    this.bounce(rect);
                }
            }
        }

        if (composerElement) {
            const rect = composerElement.getBoundingClientRect();
            if (
                this.x > rect.left &&
                this.x < rect.right &&
                this.y > rect.top &&
                this.y < rect.bottom
            ) {
                this.bounce(rect);
            }
        }
    }

    bounce(rect) {
        if (this.y < rect.top + rect.height / 2) {
            this.speedY = Math.abs(this.speedY) * 0.3;
        } else {
            this.speedY = -Math.abs(this.speedY) * 0.3;
        }
        this.speedX += (Math.random() - 0.5) * 0.1;
    }

    draw() {
        if (!this.alive) return;
        const alpha = this.opacity * this.life * (0.5 + this.intensity * 0.5);
        ctx.fillStyle = `rgba(254, 200, 164, ${alpha})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * this.life, 0, Math.PI * 2);
        ctx.fill();
    }
}

export function startDust() {
    if (dustActive) return;
    dustActive = true;
    dustIntensity = 0;

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

    particles = [];
    animate();
}

export function stopDust() {
    dustActive = false;
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
    if (canvas) {
        canvas.remove();
        canvas = null;
        ctx = null;
    }
    particles = [];
    dustIntensity = 0;
    window.removeEventListener('resize', resize);
}

function resize() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function animate() {
    if (!dustActive) return;

    if (dustIntensity < maxIntensity) {
        dustIntensity = Math.min(dustIntensity + intensitySpeed, maxIntensity);
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const maxParticles = Math.floor(30 + dustIntensity * 120);
    const spawnChance = 0.1 + dustIntensity * 0.4;

    if (particles.length < maxParticles && Math.random() < spawnChance) {
        particles.push(new Particle(
            Math.random() * canvas.width,
            canvas.height + Math.random() * 20,
            dustIntensity
        ));
    }

    for (const p of particles) {
        p.update();
        p.draw();
    }

    particles = particles.filter(p => p.alive);

    animationId = requestAnimationFrame(animate);
}
