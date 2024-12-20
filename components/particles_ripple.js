// Register the ripple effect
ParticleEffects.register('ripple', (element, sketch) => {
    // Configuration
    const config = {
        // Animation timing
        duration: 1.2,        // Total animation duration in seconds
        
        // Wave properties
        amplitude: 15,        // Maximum particle displacement
        thickness: 0.15,      // Thickness of the wave (0-1)
        maxRadius: 1.5,      // Maximum radius multiplier (relative to canvas size)
        
        // Animation curves
        easing: {
            expansion: t => {
                return 1 - Math.pow(1 - t, 2);
            },
            strength: t => {
                return Math.sin(t * Math.PI);
            }
        }
    };

    let ripples = [];     // Array to store active ripples
    
    class Ripple {
        constructor(x, y) {
            // Use provided coordinates or fall back to center
            this.x = x || sketch.width / 2;
            this.y = y || sketch.height / 2;
            this.startTime = sketch.millis() / 1000;
            this.progress = 0;
        }

        update() {
            this.progress = (sketch.millis() / 1000 - this.startTime) / config.duration;
            return this.progress <= 1;
        }

        getDisplacement(px, py) {
            const dx = px - this.x;
            const dy = py - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance === 0) return { x: 0, y: 0 };

            // Calculate the current radius of the wave
            const maxRadius = Math.max(sketch.width, sketch.height) * config.maxRadius;
            const currentRadius = maxRadius * config.easing.expansion(this.progress);
            
            const distanceFromWave = Math.abs(distance - currentRadius) / maxRadius;
            
            if (distanceFromWave > config.thickness) return { x: 0, y: 0 };
            
            const waveStrength = 1 - (distanceFromWave / config.thickness);
            const strength = config.easing.strength(this.progress);
            const magnitude = waveStrength * strength * config.amplitude;
            
            return {
                x: (dx / distance) * magnitude,
                y: (dy / distance) * magnitude
            };
        }
    }

    function createRipple(x, y) {
        ripples.push(new Ripple(x, y));
    }

    function getEventPosition(e) {
        const rect = element.getBoundingClientRect();
        if (e.touches) {
            return {
                x: sketch.map(e.touches[0].clientX - rect.left, 0, rect.width, 0, sketch.width),
                y: sketch.map(e.touches[0].clientY - rect.top, 0, rect.height, 0, sketch.height)
            };
        }
        return {
            x: sketch.map(e.clientX - rect.left, 0, rect.width, 0, sketch.width),
            y: sketch.map(e.clientY - rect.top, 0, rect.height, 0, sketch.height)
        };
    }

    function initializeParticles() {
        const particles = sketch.particleSystem.getParticles();
        if (!particles) return;
        particles.forEach(p => {
            p.origX = p.x;
            p.origY = p.y;
        });
    }

    function updateParticles(particles) {
        if (!particles || ripples.length === 0) {
            return null;
        }

        ripples = ripples.filter(ripple => ripple.update());

        return particles.map(p => {
            let totalDx = 0;
            let totalDy = 0;

            ripples.forEach(ripple => {
                const displacement = ripple.getDisplacement(p.origX, p.origY);
                totalDx += displacement.x;
                totalDy += displacement.y;
            });

            return { dx: totalDx, dy: totalDy };
        });
    }

    initializeParticles();
    element.addEventListener('particlesReinitialized', initializeParticles);

    // Handle mouse events
    element.addEventListener('mouseenter', (e) => {
        const pos = getEventPosition(e);
        createRipple(pos.x, pos.y);
    });

    element.addEventListener('click', (e) => {
        const pos = getEventPosition(e);
        createRipple(pos.x, pos.y);
    });

    // Handle touch events
    element.addEventListener('touchstart', (e) => {
        if (element === sketch.gridElement) {
            e.preventDefault();
            const pos = getEventPosition(e);
            createRipple(pos.x, pos.y);
        }
    }, { passive: false });

    return {
        updateParticles
    };
});
