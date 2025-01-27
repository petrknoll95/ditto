// Register the repulsion effect
ParticleEffects.register('repulsion', (element, sketch) => {
    // More robust touch device detection
    const isTouchDevice = () => {
        // Check for touch capability
        if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
            return true;
        }
        // Check for touch-only device (no mouse)
        if (window.matchMedia('(hover: none)').matches) {
            return true;
        }
        return false;
    };

    // If it's a touch device, return null to disable the effect
    if (isTouchDevice()) {
        console.log('Touch device detected - disabling repulsion effect');
        return null;
    }

    // Configuration
    const defaultConfig = {
        radius: 150,
        strength: 2,
        maxForce: 2,
        friction: 0.85,
        returnSpeed: 0.15,
        smoothing: 0.6
    };

    const config = {
        radius: element.dataset.repulsionRadius ? parseFloat(element.dataset.repulsionRadius) : defaultConfig.radius,
        strength: element.dataset.repulsionStrength ? parseFloat(element.dataset.repulsionStrength) : defaultConfig.strength,
        maxForce: element.dataset.repulsionMaxForce ? parseFloat(element.dataset.repulsionMaxForce) : defaultConfig.maxForce,
        friction: element.dataset.repulsionFriction ? parseFloat(element.dataset.repulsionFriction) : defaultConfig.friction,
        returnSpeed: element.dataset.repulsionReturnSpeed ? parseFloat(element.dataset.repulsionReturnSpeed) : defaultConfig.returnSpeed,
        smoothing: element.dataset.repulsionSmoothing ? parseFloat(element.dataset.repulsionSmoothing) : defaultConfig.smoothing
    };

    let particles = [];
    let isInteracting = false;
    let lastPosition = null;
    let touchStartY = 0;
    let touchStartX = 0;
    let isScrolling = false;
    const interaction = createInteractionHelper(sketch, element);

    function initializeParticles() {
        particles = sketch.particleSystem.getParticles().map(p => ({
            ...p,
            vx: 0,
            vy: 0
        }));
    }

    initializeParticles();
    element.addEventListener('particlesReinitialized', initializeParticles);

    function updateParticles(currentParticles) {
        if (!currentParticles) return null;

        const { x: currentX, y: currentY, isInteracting: isMouseInteracting } = interaction.getInteractionPosition();
        const shouldInteract = (isInteracting || isMouseInteracting) && !isScrolling;
        const interactionX = shouldInteract ? (lastPosition ? lastPosition.x : currentX) : null;
        const interactionY = shouldInteract ? (lastPosition ? lastPosition.y : currentY) : null;

        return currentParticles.map((p, i) => {
            let particle = particles[i];
            
            if (shouldInteract && interactionX !== null && interactionY !== null) {
                const dx = p.x - interactionX;
                const dy = p.y - interactionY;
                const distSq = dx * dx + dy * dy;
                
                if (distSq < config.radius * config.radius && distSq > 0) {
                    const dist = Math.sqrt(distSq);
                    const force = Math.min(
                        config.maxForce,
                        (1 - Math.pow(dist / config.radius, 2)) * config.strength
                    );
                    
                    particle.vx += (dx / dist) * force;
                    particle.vy += (dy / dist) * force;
                }
            }

            // Always apply return force
            const returnX = (p.origX - p.x) * config.returnSpeed;
            const returnY = (p.origY - p.y) * config.returnSpeed;
            particle.vx += returnX;
            particle.vy += returnY;

            // Apply consistent friction whether interacting or returning
            particle.vx *= config.friction;
            particle.vy *= config.friction;

            return { 
                dx: particle.vx, 
                dy: particle.vy 
            };
        });
    }

    // Mouse event handlers
    element.addEventListener('mouseenter', () => {
        lastPosition = null;
    });

    element.addEventListener('mousemove', (e) => {
        const rect = element.getBoundingClientRect();
        lastPosition = {
            x: sketch.map(e.clientX - rect.left, 0, rect.width, 0, sketch.width),
            y: sketch.map(e.clientY - rect.top, 0, rect.height, 0, sketch.height)
        };
    });

    element.addEventListener('mouseleave', () => {
        lastPosition = null;
    });

    // Touch event handlers
    function handleTouchStart(e) {
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            touchStartY = touch.clientY;
            touchStartX = touch.clientX;
            isScrolling = false;

            const rect = sketch.canvas.getBoundingClientRect();
            const touchX = sketch.map(touch.clientX - rect.left, 0, rect.width, 0, sketch.width);
            const touchY = sketch.map(touch.clientY - rect.top, 0, rect.height, 0, sketch.height);
            
            lastPosition = { x: touchX, y: touchY };
            isInteracting = true;
        }
    }

    function handleTouchMove(e) {
        if (e.touches.length === 1 && isInteracting) {
            const touch = e.touches[0];
            
            // Calculate movement
            const deltaY = touch.clientY - touchStartY;
            const deltaX = touch.clientX - touchStartX;

            // If vertical movement is greater than horizontal, it's likely a scroll
            if (!isScrolling && Math.abs(deltaY) > Math.abs(deltaX)) {
                isScrolling = true;
                isInteracting = false;
                lastPosition = null;
                return;
            }

            // If we've determined this is a scroll, don't process the repulsion
            if (isScrolling) return;

            const rect = sketch.canvas.getBoundingClientRect();
            const touchX = sketch.map(touch.clientX - rect.left, 0, rect.width, 0, sketch.width);
            const touchY = sketch.map(touch.clientY - rect.top, 0, rect.height, 0, sketch.height);
            
            lastPosition = { x: touchX, y: touchY };

            // Only prevent default if we're not scrolling and there's significant horizontal movement
            if (!isScrolling && Math.abs(deltaX) > 10) {
                e.preventDefault();
            }
        }
    }

    function handleTouchEnd(e) {
        isInteracting = false;
        isScrolling = false;
        lastPosition = null;
        
        // Reset all particle velocities
        particles.forEach(particle => {
            particle.vx = 0;
            particle.vy = 0;
        });
    }

    // Add touch event listeners with passive option where possible
    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return {
        updateParticles
    };
});
