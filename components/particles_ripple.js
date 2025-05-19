// Register the ripple effect
ParticleEffects.register('ripple', (element, sketch) => {
    // Default configuration
    const defaultConfig = {
        duration: 1.2,
        amplitude: 15,
        thickness: 0.15,
        maxRadius: 1.5,
        easing: {
            expansion: t => 1 - Math.pow(1 - t, 2),
            strength: t => Math.sin(t * Math.PI)
        }
    };

    // Read configuration from data attributes
    const config = {
        duration: element.dataset.rippleDuration ? parseFloat(element.dataset.rippleDuration) : defaultConfig.duration,
        amplitude: element.dataset.rippleAmplitude ? parseFloat(element.dataset.rippleAmplitude) : defaultConfig.amplitude,
        thickness: element.dataset.rippleThickness ? parseFloat(element.dataset.rippleThickness) : defaultConfig.thickness,
        maxRadius: element.dataset.rippleMaxRadius ? parseFloat(element.dataset.rippleMaxRadius) : defaultConfig.maxRadius,
        easing: defaultConfig.easing
    };

    // Parse affect settings
    const affects = (element.dataset.rippleAffect || '').split(' ').filter(Boolean);
    const shouldAffectOpacity = affects.includes('opacity');
    const shouldAffectSize = affects.includes('size');

    // Get base opacity from grid settings
    const baseOpacity = parseFloat(element.dataset.gridOpacity) || 1;

    // Calculate maximum radius once
    const maxRadius = Math.max(sketch.width, sketch.height) * config.maxRadius;
    
    // Pre-compute squared thickness for faster distance checks
    const thicknessSq = config.thickness * config.thickness;

    let ripples = [];
    let hasActiveRipples = false;
    
    class Ripple {
        constructor(x, y) {
            this.x = x || sketch.width / 2;
            this.y = y || sketch.height / 2;
            this.startTime = sketch.millis() / 1000;
            this.progress = 0;
            this.currentRadius = 0;
            this.active = true;
        }

        update() {
            this.progress = (sketch.millis() / 1000 - this.startTime) / config.duration;
            // Calculate the current radius of the wave once per update
            this.currentRadius = maxRadius * config.easing.expansion(this.progress);
            this.strength = config.easing.strength(this.progress);
            
            if (this.progress > 1) {
                this.active = false;
            }
            
            return this.active;
        }

        getDisplacement(px, py) {
            const dx = px - this.x;
            const dy = py - this.y;
            const distanceSq = dx * dx + dy * dy;
            
            if (distanceSq === 0) return { x: 0, y: 0, opacity: baseOpacity, size: 1 };

            // Fast path: Skip sqrt calculation if clearly outside effect range
            const radiusDiff = Math.sqrt(distanceSq) - this.currentRadius;
            const distanceFromWave = Math.abs(radiusDiff) / maxRadius;
            
            if (distanceFromWave > config.thickness) {
                return { x: 0, y: 0, opacity: baseOpacity, size: 1 };
            }
            
            const waveStrength = 1 - (distanceFromWave / config.thickness);
            const magnitude = waveStrength * this.strength * config.amplitude;
            
            // Only compute values if needed
            let opacityBoost = baseOpacity;
            if (shouldAffectOpacity) {
                opacityBoost = Math.min(1, baseOpacity + (waveStrength * this.strength * (1 - baseOpacity)));
            }
            
            let sizeBoost = 1;
            if (shouldAffectSize) {
                sizeBoost = 1 + (waveStrength * this.strength);
            }
            
            // Need sqrt for direction normalization
            const distance = Math.sqrt(distanceSq);
            
            return {
                x: (dx / distance) * magnitude,
                y: (dy / distance) * magnitude,
                opacity: opacityBoost,
                size: sizeBoost
            };
        }
    }

    function createRipple(x, y) {
        ripples.push(new Ripple(x, y));
        hasActiveRipples = true;
        
        // Resume animation in core
        if (typeof sketch.loop === 'function') {
            sketch.loop();
        }
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

    // Pre-allocate displacement array
    let displacementResults = null;

    function updateParticles(particles, out = null) {
        if (!particles || ripples.length === 0) {
            hasActiveRipples = false;
            return null;
        }

        // Update ripples and check if we have any active ones
        const hadActiveRipples = hasActiveRipples;
        hasActiveRipples = false;
        
        ripples = ripples.filter(ripple => {
            const isActive = ripple.update();
            if (isActive) hasActiveRipples = true;
            return isActive;
        });
        
        // If we don't have active ripples anymore, allow animation to pause
        if (hadActiveRipples && !hasActiveRipples && typeof sketch.noLoop === 'function') {
            // Allow a few more frames before stopping
            setTimeout(() => {
                if (!hasActiveRipples) sketch.noLoop();
            }, 100);
        }

        // If no ripples left, return null
        if (ripples.length === 0) {
            return null;
        }

        // Create or reuse the displacement results array
        if (!displacementResults || displacementResults.length !== particles.length) {
            displacementResults = Array(particles.length).fill().map(() => ({ 
                dx: 0, dy: 0, opacity: baseOpacity, size: 1 
            }));
        }
        
        // Reuse output array if provided
        const results = out || displacementResults;

        // Reset all displacements
        for (let i = 0; i < particles.length; i++) {
            results[i].dx = 0;
            results[i].dy = 0;
            results[i].opacity = baseOpacity;
            results[i].size = 1;
        }

        // Apply all ripples
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            
            ripples.forEach(ripple => {
                const displacement = ripple.getDisplacement(p.origX, p.origY);
                results[i].dx += displacement.x;
                results[i].dy += displacement.y;
                results[i].opacity = Math.max(results[i].opacity, displacement.opacity);
                results[i].size = Math.max(results[i].size, displacement.size);
            });
        }

        return results;
    }

    initializeParticles();
    element.addEventListener('particlesReinitialized', initializeParticles);

    // Handle mouse click event
    element.addEventListener('click', (e) => {
        const pos = getEventPosition(e);
        createRipple(pos.x, pos.y);
    });

    // Handle touch events - using click event instead of touchstart
    // This ensures better compatibility with scroll and other touch gestures
    element.addEventListener('touchend', (e) => {
        // Only handle single touch that hasn't moved much (indicating a tap)
        if (e.changedTouches.length === 1) {
            const touch = e.changedTouches[0];
            const target = document.elementFromPoint(touch.clientX, touch.clientY);
            
            // Only create ripple if the touch ended on our element
            if (target === element || element.contains(target)) {
                const pos = getEventPosition(touch);
                createRipple(pos.x, pos.y);
            }
        }
    }, { passive: true });

    return {
        updateParticles
    };
});
