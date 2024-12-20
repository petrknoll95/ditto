// Register the repulsion effect
ParticleEffects.register('repulsion', (element, sketch) => {
    // Configuration
    const config = {
        radius: 200,
        strength: 2,
        returnSpeed: 0.1,
        damping: 0.7
    };

    let isTouching = false;

    function initializeParticles() {
        const particles = sketch.particleSystem.getParticles();
        if (!particles) return;
        
        particles.forEach(p => {
            p.origX = p.x;
            p.origY = p.y;
            p.vx = 0;
            p.vy = 0;
        });
    }

    initializeParticles();
    element.addEventListener('particlesReinitialized', initializeParticles);

    // Simplified mouse position check
    function isMouseInBounds() {
        return sketch.mouseX >= 0 && sketch.mouseX <= sketch.width && 
               sketch.mouseY >= 0 && sketch.mouseY <= sketch.height;
    }

    // Get touch position relative to canvas
    function getTouchPosition(touch) {
        const rect = sketch.canvas.getBoundingClientRect();
        return {
            x: sketch.map(touch.clientX - rect.left, 0, rect.width, 0, sketch.width),
            y: sketch.map(touch.clientY - rect.top, 0, rect.height, 0, sketch.height)
        };
    }

    const originalDraw = sketch.draw;
    sketch.draw = function() {
        updateParticles();
        originalDraw.call(sketch);
    };

    function updateParticles() {
        if (element !== sketch.gridElement) return;
        
        const particles = sketch.particleSystem.getParticles();
        if (!particles) return;

        let interactionX, interactionY, isInteracting = false;

        const isTouchDevice = ('ontouchstart' in window) || 
                            (navigator.maxTouchPoints > 0) || 
                            (navigator.msMaxTouchPoints > 0);

        if (isTouchDevice && isTouching && sketch.touches.length > 0) {
            const touchPos = getTouchPosition(sketch.touches[0]);
            interactionX = touchPos.x;
            interactionY = touchPos.y;
            isInteracting = true;
        } else if (!isTouchDevice && isMouseInBounds()) {
            interactionX = sketch.mouseX;
            interactionY = sketch.mouseY;
            isInteracting = true;
        }

        particles.forEach(p => {
            if (isInteracting) {
                const dx = p.x - interactionX;
                const dy = p.y - interactionY;
                const distSq = dx * dx + dy * dy;

                if (distSq < config.radius * config.radius && distSq > 0) {
                    const dist = Math.sqrt(distSq);
                    const force = (1 - dist / config.radius) * config.strength;
                    p.vx += (dx / dist) * force;
                    p.vy += (dy / dist) * force;
                }
            }

            const dx = p.origX - p.x;
            const dy = p.origY - p.y;
            p.vx += dx * config.returnSpeed;
            p.vy += dy * config.returnSpeed;

            p.vx *= config.damping;
            p.vy *= config.damping;
            p.x += p.vx;
            p.y += p.vy;
        });
    }

    // Event handlers
    sketch.touchStarted = () => {
        if (element === sketch.gridElement) {
            isTouching = true;
        }
        return false;
    };

    sketch.touchEnded = () => {
        if (element === sketch.gridElement) {
            isTouching = false;
        }
        return false;
    };

    sketch.touchMoved = () => false;
    sketch.mousePressed = () => false;
    sketch.mouseDragged = () => false;
    sketch.mouseReleased = () => false;
});
