// Register the ripple effect
ParticleEffects.register('ripple', (element, sketch) => {
    // Configuration
    const config = {
        // Animation timing
        duration: 1.2,        // Total animation duration in seconds
        
        // Wave properties
        amplitude: 15,        // Maximum particle displacement
        thickness: 0.15,      // Thickness of the wave (0-1)
        
        // Animation curves
        easing: {
            // How the wave moves outward over time (0 to 1)
            expansion: t => {
                // Smooth ease-out
                return 1 - Math.pow(1 - t, 2);
            },
            // How the displacement strength changes over time (0 to 1)
            strength: t => {
                // Fade in and out smoothly
                return Math.sin(t * Math.PI);
            }
        }
    };

    let ripples = [];     // Array to store active ripples
    let canTrigger = true;  // Flag to prevent multiple ripples
    
    class Ripple {
        constructor() {
            this.x = sketch.width / 2;
            this.y = sketch.height / 2;
            this.startTime = sketch.millis() / 1000;
            this.progress = 0;
        }

        update() {
            this.progress = (sketch.millis() / 1000 - this.startTime) / config.duration;
            if (this.progress > 0.8) canTrigger = true;
            return this.progress <= 1;
        }

        getDisplacement(px, py) {
            const dx = px - this.x;
            const dy = py - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance === 0) return { x: 0, y: 0 };

            // Calculate the current radius of the wave
            const maxRadius = Math.max(sketch.width, sketch.height) * 0.75;
            const currentRadius = maxRadius * config.easing.expansion(this.progress);
            
            // Calculate how far this particle is from the wave ring
            const distanceFromWave = Math.abs(distance - currentRadius) / maxRadius;
            
            // Only affect particles near the wave ring
            if (distanceFromWave > config.thickness) return { x: 0, y: 0 };
            
            // Calculate wave strength based on distance from wave ring
            const waveStrength = 1 - (distanceFromWave / config.thickness);
            
            // Calculate final displacement
            const strength = config.easing.strength(this.progress);
            const magnitude = waveStrength * strength * config.amplitude;
            
            // Push outward from center
            return {
                x: (dx / distance) * magnitude,
                y: (dy / distance) * magnitude
            };
        }
    }

    function createRipple() {
        if (canTrigger) {
            ripples.push(new Ripple());
            canTrigger = false;
        }
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
            return null; // Return null if no displacement
        }

        ripples = ripples.filter(ripple => ripple.update());

        // Return displacement for each particle
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

    // Initialize effect as before...
    initializeParticles();
    element.addEventListener('particlesReinitialized', initializeParticles);

    // Handle both mouse and touch events
    element.addEventListener('mouseenter', createRipple);
    element.addEventListener('touchstart', (e) => {
        if (element === sketch.gridElement) {
            e.preventDefault();
            createRipple();
        }
    }, { passive: false });

    // Return the update function
    return {
        updateParticles
    };
});
