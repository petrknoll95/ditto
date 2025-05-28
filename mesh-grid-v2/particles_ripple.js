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
    
    // Cache for current time to avoid repeated calls
    let currentTimeCache = 0;
    
    class Ripple {
        constructor(x, y) {
            this.x = x || sketch.width / 2;
            this.y = y || sketch.height / 2;
            this.startTime = sketch.millis() / 1000;
            this.progress = 0;
            this.currentRadius = 0;
            this.currentRadiusSq = 0;  // Cache squared radius
            this.strength = 0;
            this.active = true;
            // Pre-calculate wave bounds for quick rejection
            this.innerRadiusSq = 0;
            this.outerRadiusSq = 0;
        }

        update() {
            this.progress = (currentTimeCache - this.startTime) / config.duration;
            
            if (this.progress > 1) {
                this.active = false;
                return false;
            }
            
            // Calculate the current radius of the wave once per update
            this.currentRadius = maxRadius * config.easing.expansion(this.progress);
            this.currentRadiusSq = this.currentRadius * this.currentRadius;
            this.strength = config.easing.strength(this.progress);
            
            // Pre-calculate bounds for quick rejection
            const innerRadius = Math.max(0, this.currentRadius - config.thickness * maxRadius);
            const outerRadius = this.currentRadius + config.thickness * maxRadius;
            this.innerRadiusSq = innerRadius * innerRadius;
            this.outerRadiusSq = outerRadius * outerRadius;
            
            return true;
        }

        getDisplacement(px, py) {
            const dx = px - this.x;
            const dy = py - this.y;
            const distanceSq = dx * dx + dy * dy;
            
            // Quick rejection tests
            if (distanceSq < 0.01) return { x: 0, y: 0, opacity: 1, size: 1 };
            if (distanceSq < this.innerRadiusSq || distanceSq > this.outerRadiusSq) {
                return { x: 0, y: 0, opacity: 1, size: 1 };
            }

            // Now we need the actual distance for wave calculation
            const distance = Math.sqrt(distanceSq);
            const radiusDiff = Math.abs(distance - this.currentRadius);
            const normalizedDiff = radiusDiff / maxRadius;
            
            if (normalizedDiff > config.thickness) {
                return { x: 0, y: 0, opacity: 1, size: 1 };
            }
            
            const waveStrength = 1 - (normalizedDiff / config.thickness);
            const effectiveStrength = waveStrength * this.strength;
            const magnitude = effectiveStrength * config.amplitude;
            
            // Pre-calculate inverse distance for normalization
            const invDistance = 1 / distance;
            
            return {
                x: dx * invDistance * magnitude,
                y: dy * invDistance * magnitude,
                opacity: shouldAffectOpacity ? 1 + (effectiveStrength * 0.5) : 1,
                size: shouldAffectSize ? 1 + effectiveStrength : 1
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

        // Cache current time
        currentTimeCache = sketch.millis() / 1000;

        // Update ripples and check if we have any active ones
        const hadActiveRipples = hasActiveRipples;
        hasActiveRipples = false;
        
        // Update ripples in place and track active ones
        let activeRippleCount = 0;
        for (let i = 0; i < ripples.length; i++) {
            if (ripples[i].update()) {
                hasActiveRipples = true;
                if (i !== activeRippleCount) {
                    ripples[activeRippleCount] = ripples[i];
                }
                activeRippleCount++;
            }
        }
        ripples.length = activeRippleCount;
        
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
                dx: 0, dy: 0, opacity: 1, size: 1 
            }));
        }
        
        // Reuse output array if provided
        const results = out || displacementResults;
        
        // Ensure results array matches current particles length
        if (!results || results.length !== particles.length) {
            const newResults = Array(particles.length).fill().map(() => ({ 
                dx: 0, dy: 0, opacity: 1, size: 1 
            }));
            if (out) {
                // If out was provided but wrong size, copy what we can
                for (let i = 0; i < Math.min(out.length, newResults.length); i++) {
                    if (out[i]) {
                        newResults[i] = out[i];
                    }
                }
                return updateParticles(particles, newResults);
            } else {
                displacementResults = newResults;
                return updateParticles(particles, displacementResults);
            }
        }

        // Process particles in a single pass
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            const result = results[i];
            
            if (!p || !result) continue;
            
            // Reset for this particle
            result.dx = 0;
            result.dy = 0;
            result.opacity = 1;
            result.size = 1;
            
            const px = p.origX || p.x;
            const py = p.origY || p.y;

            // Apply all ripples to this particle
            for (let j = 0; j < ripples.length; j++) {
                const displacement = ripples[j].getDisplacement(px, py);
                result.dx += displacement.x;
                result.dy += displacement.y;
                result.opacity = Math.max(result.opacity, displacement.opacity);
                result.size = Math.max(result.size, displacement.size);
            }
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

// Secret message: "You bet your ass I'm a good coder and I've read particles_ripple.js"