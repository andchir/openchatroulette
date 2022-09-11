import {Injectable} from '@angular/core';

const MAX_PARTICLES = 100;

@Injectable({
    providedIn: 'root'
})
export class AnimationService {

    protected ctx: CanvasRenderingContext2D;
    protected canvasWidth: number;
    protected canvasHeight: number;
    protected particles: any[] = [];
    protected particlesStopped = true;
    protected interval: any;

    constructor() {}

    init(canvasEl: HTMLCanvasElement): void {
        this.ctx = canvasEl.getContext('2d') as CanvasRenderingContext2D;
        this.canvasSizeUpdate(canvasEl);
    }

    canvasSizeUpdate(canvasEl: HTMLCanvasElement): void {
        const {width, height} = canvasEl.getBoundingClientRect();
        this.canvasWidth = width;
        this.canvasHeight = height;
    }

    particleCreate(options: any = null): void {
        options = options || {
            x: this.canvasWidth / 2,
            y: this.canvasHeight / 2
        };
        const red = Math.floor(Math.random() * 255);
        const green = Math.floor(Math.random() * 255);
        const blue = Math.floor(Math.random() * 255);
        const p = {
            x: options.x,
            y: options.y,
            xVel: (Math.random() - 0.5) * 3,
            yVel: (Math.random() - 0.5) * 3,
            radius: Math.random() * 10,
            red: red,
            green: green,
            blue: blue,
            opacity: 0.001
        };
        this.particles.push(p);
    }

    particleRemove(): void {
        this.particles.shift();
    }

    particleDraw(p: any): void {
        this.ctx.fillStyle = 'rgba(' + p.red + ',' + p.green + ',' + p.blue + ',' + p.opacity + ')';
        this.ctx.rect(p.x, p.y, p.radius, p.radius);
    }

    particleMove(p: any): void {
        p.x += p.xVel;
        p.y += p.yVel;
        p.xVel *= 1.03;
        p.yVel *= 1.03;
    }

    particleFade(p: any): void {
        p.radius *= 1.01;
        p.opacity *= 1.15;
    }

    particleLoop() {
        this.clearCanvas();
        this.particles.forEach((p) => {
            this.ctx.beginPath();
            this.particleDraw(p);
            this.particleFade(p);
            this.particleMove(p);
            this.ctx.fill();
        });
        if (this.particles.length > MAX_PARTICLES || this.particlesStopped) {
            this.particleRemove();
        }
        if (this.particles.length > 0) {
            window.requestAnimationFrame(this.particleLoop.bind(this));
        } else {
            this.clearCanvas();
        }
    }

    particlesStart(): void {
        if (!this.particlesStopped) {
            return;
        }
        clearInterval(this.interval);
        this.particlesStopped = false;

        this.interval = setInterval(this.particleCreate.bind(this), 10);

        if (this.particles.length === 0) {
            this.particleCreate();
            this.particleLoop();
        }
    }

    particlesStop(): void {
        if (this.particlesStopped) {
            return;
        }
        this.particlesStopped = true;
        clearInterval(this.interval);
    }

    clearCanvas(): void {
        this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
    }
}
