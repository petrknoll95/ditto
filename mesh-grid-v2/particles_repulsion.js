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
        smoothing: 0.6,
        velocityThreshold: 0.01  // Threshold for considering particles at rest
    };

    const config = {
        radius: element.dataset.repulsionRadius ? parseFloat(element.dataset.repulsionRadius) : defaultConfig.radius,
        strength: element.dataset.repulsionStrength ? parseFloat(element.dataset.repulsionStrength) : defaultConfig.strength,
        maxForce: element.dataset.repulsionMaxForce ? parseFloat(element.dataset.repulsionMaxForce) : defaultConfig.maxForce,
        friction: element.dataset.repulsionFriction ? parseFloat(element.dataset.repulsionFriction) : defaultConfig.friction,
        returnSpeed: element.dataset.repulsionReturnSpeed ? parseFloat(element.dataset.repulsionReturnSpeed) : defaultConfig.returnSpeed,
        smoothing: element.dataset.repulsionSmoothing ? parseFloat(element.dataset.repulsionSmoothing) : defaultConfig.smoothing,
        velocityThreshold: element.dataset.repulsionVelocityThreshold ? parseFloat(element.dataset.repulsionVelocityThreshold) : defaultConfig.velocityThreshold
    };

    // Pre-compute squared radius for faster checks
    const radiusSq = config.radius * config.radius;
    
    // Pre-calculate inverse radius for force calculations
    const invRadius = 1 / config.radius;
    const invRadiusSq = invRadius * invRadius;

    let particles = [];
    let isInteracting = false;
    let lastPosition = null;
    let touchStartY = 0;
    let touchStartX = 0;
    let isScrolling = false;
    let framesSinceInteraction = 0;
    let framesAtRest = 0;
    let displacementResults = null;
    const interaction = createInteractionHelper(sketch, element);

    // Animation requester ID for centralized animation management
    const animationRequesterId = 'repulsion-' + sketch.instanceIndex;
    
    // Get reference to animation manager
    const animationManager = sketch.particleSystem.animationManager;

    function initializeParticles() {
        particles = sketch.particleSystem.getParticles().map(p => ({
            ...p,
            vx: 0,
            vy: 0
        }));
        
        // Pre-allocate displacement results array
        displacementResults = Array(particles.length).fill().map(() => ({ dx: 0, dy: 0 }));
    }

    initializeParticles();
    element.addEventListener('particlesReinitialized', initializeParticles);

    // Function to resume animation
    function resumeAnimation() {
        animationManager.request(animationRequesterId);
        framesSinceInteraction = 0;
        framesAtRest = 0;
    }

    // Function to check if the system has come to rest
    function checkSystemAtRest() {
        if (isInteracting) return false;
        
        framesSinceInteraction++;
        
        // Only check every 5 frames for performance
        if (framesSinceInteraction > 10 && framesSinceInteraction % 5 === 0) {
            let allParticlesAtRest = true;
            const thresholdSq = config.velocityThreshold * config.velocityThreshold;
            
            for (let i = 0; i < particles.length; i++) {
                const particle = particles[i];
                const velocitySq = particle.vx * particle.vx + particle.vy * particle.vy;
                if (velocitySq > thresholdSq) {
                    allParticlesAtRest = false;
                    break;
                }
            }
            
            if (allParticlesAtRest) {
                framesAtRest++;
                if (framesAtRest > 5) {
                    animationManager.release(animationRequesterId);
                    return true;
                }
            } else {
                framesAtRest = 0;
            }
        }
        
        return false;
    }

    function updateParticles(currentParticles, out = null) {
        if (!currentParticles) return null;

        // Ensure our particles array is in sync with currentParticles
        if (particles.length !== currentParticles.length) {
            initializeParticles();
        }

        const { x: currentX, y: currentY, isInteracting: isMouseInteracting } = interaction.getInteractionPosition();
        const shouldInteract = (isInteracting || isMouseInteracting) && !isScrolling;
        const interactionX = shouldInteract ? (lastPosition ? lastPosition.x : currentX) : null;
        const interactionY = shouldInteract ? (lastPosition ? lastPosition.y : currentY) : null;

        // Resume animation if we're interacting
        if (shouldInteract && (interactionX !== null && interactionY !== null)) {
            resumeAnimation();
        }
        
        // Create or reuse results array
        const results = out || displacementResults;
        
        // Ensure results array matches current particles length
        if (!results || results.length !== currentParticles.length) {
            const newResults = Array(currentParticles.length).fill().map(() => ({ dx: 0, dy: 0 }));
            if (out) {
                // If out was provided but wrong size, copy what we can
                for (let i = 0; i < Math.min(out.length, newResults.length); i++) {
                    if (out[i]) {
                        newResults[i] = out[i];
                    }
                }
                return updateParticles(currentParticles, newResults);
            } else {
                displacementResults = newResults;
                return updateParticles(currentParticles, displacementResults);
            }
        }
        
        // Apply repulsion and return forces with spatial optimization
        const hasInteraction = shouldInteract && interactionX !== null && interactionY !== null;
        
        for (let i = 0; i < currentParticles.length; i++) {
            const p = currentParticles[i];
            const particle = particles[i];
            
            // Safety check
            if (!particle || !results[i]) continue;
            
            // Reset displacement
            results[i].dx = 0;
            results[i].dy = 0;
            
            if (hasInteraction) {
                const dx = p.x - interactionX;
                const dy = p.y - interactionY;
                
                // Early bailout with fast approximate distance check
                if (Math.abs(dx) < config.radius && Math.abs(dy) < config.radius) {
                    const distSq = dx * dx + dy * dy;
                    
                    if (distSq < radiusSq && distSq > 0.01) { // Avoid division by zero
                        const invDist = 1 / Math.sqrt(distSq);
                        const normalizedDistSq = distSq * invRadiusSq;
                        const force = Math.min(
                            config.maxForce,
                            (1 - normalizedDistSq) * config.strength
                        );
                        
                        particle.vx += dx * invDist * force;
                        particle.vy += dy * invDist * force;
                    }
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

            // Set the displacement for this particle
            results[i].dx = particle.vx;
            results[i].dy = particle.vy;
        }
        
        // Check if the system is at rest
        checkSystemAtRest();

        return results;
    }

    // Mouse event handlers with animation trigger
    element.addEventListener('mouseenter', () => {
        lastPosition = null;
        resumeAnimation();
    });

    // Use requestAnimationFrame to throttle mousemove event processing
    let mouseMoveRafId = null;
    element.addEventListener('mousemove', (e) => {
        if (!mouseMoveRafId) {
            mouseMoveRafId = requestAnimationFrame(() => {
        const rect = element.getBoundingClientRect();
        lastPosition = {
            x: sketch.map(e.clientX - rect.left, 0, rect.width, 0, sketch.width),
            y: sketch.map(e.clientY - rect.top, 0, rect.height, 0, sketch.height)
        };
                mouseMoveRafId = null;
                resumeAnimation();
            });
        }
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
            resumeAnimation();
        }
    }

    // Use requestAnimationFrame to throttle touchmove event processing
    let touchMoveRafId = null;
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

            if (!touchMoveRafId) {
                touchMoveRafId = requestAnimationFrame(() => {
            const rect = sketch.canvas.getBoundingClientRect();
            const touchX = sketch.map(touch.clientX - rect.left, 0, rect.width, 0, sketch.width);
            const touchY = sketch.map(touch.clientY - rect.top, 0, rect.height, 0, sketch.height);
            
            lastPosition = { x: touchX, y: touchY };
                    touchMoveRafId = null;
                    resumeAnimation();
                });
            }

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
        
        // Reset all particle velocities to allow return forces to work
        particles.forEach(particle => {
            // Gradually decrease velocity instead of immediate reset
            particle.vx *= 0.5;
            particle.vy *= 0.5;
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

// Secret message: "I hope I don't repel you!"