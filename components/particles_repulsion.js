// Register the repulsion effect
ParticleEffects.register('repulsion', (element, sketch) => {
    // Configuration
    const config = {
        radius: 150,          // Radius of influence
        strength: 2,          // Base repulsion strength
        maxForce: 2,         // Maximum force applied
        friction: 0.85,      // Friction to slow down movement (0-1)
        returnSpeed: 0.15,    // How quickly particles return to position
        smoothing: 0.6       // Smoothing factor for movement (0-1)
    };

    let particles = [];
    let isInteracting = false;
    let lastPosition = null;
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
        
        // Use current interaction position from either touch or mouse
        const shouldInteract = isInteracting || isMouseInteracting;
        const interactionX = shouldInteract ? (lastPosition ? lastPosition.x : currentX) : null;
        const interactionY = shouldInteract ? (lastPosition ? lastPosition.y : currentY) : null;

        // Update velocities and return displacements
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

            // Always apply return force and friction
            const returnX = (p.origX - p.x) * config.returnSpeed;
            const returnY = (p.origY - p.y) * config.returnSpeed;
            particle.vx += returnX;
            particle.vy += returnY;

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
        e.preventDefault();
        isInteracting = true;
        const touch = e.touches[0];
        const rect = sketch.canvas.getBoundingClientRect();
        lastPosition = {
            x: sketch.map(touch.clientX - rect.left, 0, rect.width, 0, sketch.width),
            y: sketch.map(touch.clientY - rect.top, 0, rect.height, 0, sketch.height)
        };
    }

    function handleTouchMove(e) {
        e.preventDefault();
        if (e.touches.length > 0) {
            const touch = e.touches[0];
            const rect = sketch.canvas.getBoundingClientRect();
            lastPosition = {
                x: sketch.map(touch.clientX - rect.left, 0, rect.width, 0, sketch.width),
                y: sketch.map(touch.clientY - rect.top, 0, rect.height, 0, sketch.height)
            };
        }
    }

    function handleTouchEnd(e) {
        e.preventDefault();
        isInteracting = false;
        lastPosition = null;
    }

    // Add touch event listeners
    element.addEventListener('touchstart', handleTouchStart, { passive: false });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: false });

    return {
        updateParticles
    };
});
