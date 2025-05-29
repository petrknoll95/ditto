// Core particle system and effect management
let gridElements = [];
let sketches = [];
let effectRegistry = new Map(); // Store effect initializers by type

// Effect registration system
const ParticleEffects = {
    register: function(effectType, initializerFn) {
        effectRegistry.set(effectType, initializerFn);
    },
    
    // Initialize effects for an element
    initializeEffects: function(element, sketch) {
        // Create an array to store active effects
        sketch.activeEffects = [];
        
        if (element.dataset.gridEffect) {
            const effectTypes = element.dataset.gridEffect.split(' ');
            effectTypes.forEach(type => {
                const effectInitializer = effectRegistry.get(type);
                if (effectInitializer) {
                    // Initialize the effect
                    const effect = effectInitializer(element, sketch);
                    // Only add the effect if it's not null and has an updateParticles method
                    if (effect && effect.updateParticles) {
                        sketch.activeEffects.push(effect);
                    }
                }
            });
        }
    }
};

// Visibility detection utility
function createVisibilityDetector(element, onVisible, onHidden) {
    // Create intersection observer to detect when element is in viewport
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                onVisible();
            } else {
                onHidden();
            }
        });
    }, { threshold: 0.1 });
    
    observer.observe(element);
    
    // Also listen for tab visibility changes
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            // Only call onVisible if element is also in viewport
            const rect = element.getBoundingClientRect();
            const isInViewport = (
                rect.top < window.innerHeight &&
                rect.bottom > 0 &&
                rect.left < window.innerWidth &&
                rect.right > 0
            );
            if (isInViewport) onVisible();
        } else {
            onHidden();
        }
    });
    
    return {
        disconnect: () => observer.disconnect()
    };
}

// Core particle system
document.addEventListener('DOMContentLoaded', () => {
    gridElements = Array.from(document.querySelectorAll('[data-grid-bg="true"]'));
    
    gridElements.forEach((element, index) => {
        const p5Instance = new p5(sketch => {
            // Store reference to the element and index
            sketch.gridElement = element;
            sketch.instanceIndex = index;
            
            let particles = [];
            let density;
            let padding;
            let particleSize;
            let visibilityDetector;
            let lastFillColor = null;
            let lastOpacity = -1;
            
            // Store pre-calculated displacements for reuse
            let effectDisplacements = [];
            
            // Cache computed style and color to avoid repeated DOM access
            let cachedDotColor = null;
            let cachedColorComponents = null;
            
            // Cache base opacity to avoid repeated parsing
            let cachedBaseOpacity = null;
            
            // Centralized animation state management
            let animationRequesters = new Set(); // Track which systems need animation
            let animationCheckInterval = null;
            let isCurrentlyAnimating = true;
            
            // Animation state manager
            const animationManager = {
                request: function(requesterId) {
                    animationRequesters.add(requesterId);
                    if (!isCurrentlyAnimating) {
                        isCurrentlyAnimating = true;
                        sketch.loop();
                    }
                },
                
                release: function(requesterId) {
                    animationRequesters.delete(requesterId);
                    // Use a small delay to prevent rapid start/stop cycling
                    if (animationRequesters.size === 0) {
                        clearTimeout(animationCheckInterval);
                        animationCheckInterval = setTimeout(() => {
                            if (animationRequesters.size === 0 && isCurrentlyAnimating) {
                                isCurrentlyAnimating = false;
                                sketch.noLoop();
                            }
                        }, 150); // 150ms delay to prevent flicker
                    }
                },
                
                forceResume: function() {
                    clearTimeout(animationCheckInterval);
                    if (!isCurrentlyAnimating) {
                        isCurrentlyAnimating = true;
                        sketch.loop();
                    }
                },
                
                isAnimating: function() {
                    return isCurrentlyAnimating;
                }
            };
            
            // Public API for effects to interact with the particle system
            sketch.particleSystem = {
                getParticles: () => particles,
                setParticles: (newParticles) => {
                    particles = newParticles;
                },
                getDensity: () => density,
                getPadding: () => padding,
                getParticleSize: () => particleSize,
                // Add method to invalidate caches when needed
                invalidateCaches: () => {
                    cachedDotColor = null;
                    cachedColorComponents = null;
                    cachedBaseOpacity = null;
                },
                // Expose animation manager to effects
                animationManager: animationManager
            };
            
            // Breakpoints for responsive particle sizing
            const BREAKPOINTS = {
                xs: 400,   // Extra small - 0.8x
                sm: 600,   // Small - 0.85x
                md: 900,   // Medium - 0.9x
                lg: 1200,  // Large - 0.95x
                xl: 1600   // Extra large - 1x
            };
            
            function calculateResponsiveScale() {
                const viewportWidth = window.innerWidth;
                
                if (viewportWidth <= BREAKPOINTS.xs) {
                    return { size: 0.8, density: 0.9 };  // Smaller particles, higher density changed from 1.2 to 1.25
                } else if (viewportWidth <= BREAKPOINTS.sm) {
                    return { size: 0.85, density: 0.925 };
                } else if (viewportWidth <= BREAKPOINTS.md) {
                    return { size: 0.9, density: 0.95 };
                } else if (viewportWidth <= BREAKPOINTS.lg) {
                    return { size: 0.95, density: 0.975 };
                } else {
                    return { size: 1, density: 1 };  // Full size at 1600px and above
                }
            }
            
            function calculateParticleSize() {
                const baseSize = parseFloat(element.dataset.gridSize) || 1;
                const { size: scale } = calculateResponsiveScale();
                return 1 * baseSize * scale;
            }
            
            function calculateGridSize() {
                const baseDensity = parseFloat(element.dataset.gridDensity) || 2;
                const { density: scale } = calculateResponsiveScale();
                // Make density differences more subtle by using a non-linear scale
                const normalizedDensity = 1 + ((baseDensity - 1) * 0.3);
                return 20 * normalizedDensity * scale;
            }
            
            // Function to resume animation
            function resumeAnimation() {
                animationManager.forceResume();
            }
            
            // Function to pause animation
            function pauseAnimation() {
                // Clear all animation requesters to allow pause
                animationRequesters.clear();
                clearTimeout(animationCheckInterval);
                if (isCurrentlyAnimating) {
                    isCurrentlyAnimating = false;
                    sketch.noLoop();
                }
            }
            
            sketch.setup = () => {
                const canvas = sketch.createCanvas(element.offsetWidth, element.offsetHeight);
                canvas.parent(element);
                
                // Set frame rate from data attribute or default to 45
                const frameRateValue = parseInt(element.dataset.gridFrameRate) || 45;
                sketch.frameRate(frameRateValue);
                
                // Set pixel density optimization
                sketch.pixelDensity(window.devicePixelRatio > 1 ? 1.5 : 1);
                
                density = parseFloat(element.dataset.gridDensity) || 2;
                padding = parseInt(element.dataset.gridPadding) || 0;
                
                // Pre-calculate values
                particleSize = calculateParticleSize();
                
                initializeParticles();
                
                // Initialize any effects for this element
                ParticleEffects.initializeEffects(element, sketch);
                
                // Initialize visibility detector
                visibilityDetector = createVisibilityDetector(
                    element,
                    resumeAnimation,
                    pauseAnimation
                );
                
                // Pre-allocate displacement arrays for each effect
                if (sketch.activeEffects) {
                    effectDisplacements = sketch.activeEffects.map(() => []);
                }
                
                // Add interaction listeners to resume animation
                element.addEventListener('mousemove', resumeAnimation);
                element.addEventListener('click', resumeAnimation);
                element.addEventListener('touchstart', resumeAnimation, { passive: true });
            };
            
            sketch.draw = () => {
                sketch.clear();
                
                if (!particles || particles.length === 0) return;
                
                // Cache color lookup - only update if changed
                if (!cachedDotColor) {
                    const computedStyle = getComputedStyle(element);
                    const dotColor = computedStyle.getPropertyValue('--theme--dot-color').trim();
                    if (dotColor !== cachedDotColor) {
                        cachedDotColor = dotColor;
                        const col = sketch.color(dotColor);
                        cachedColorComponents = {
                            r: sketch.red(col),
                            g: sketch.green(col),
                            b: sketch.blue(col)
                        };
                    }
                }
                
                // Cache base opacity
                if (cachedBaseOpacity === null) {
                    cachedBaseOpacity = parseFloat(element.dataset.gridOpacity) || 1;
                }
                
                const baseOpacity = cachedBaseOpacity;
                
                // Reset particles to original positions and properties
                for (let i = 0; i < particles.length; i++) {
                    const particle = particles[i];
                    particle.x = particle.origX;
                    particle.y = particle.origY;
                    particle.opacity = baseOpacity;
                    particle.size = 1;
                }

                // Only apply effects if there are active effects
                if (sketch.activeEffects && sketch.activeEffects.length > 0) {
                    // Get displacements from all active effects
                    let hasDisplacements = false;
                    
                    for (let effectIndex = 0; effectIndex < sketch.activeEffects.length; effectIndex++) {
                        const effect = sketch.activeEffects[effectIndex];
                        const displacements = effect.updateParticles(particles, effectDisplacements[effectIndex]);
                        if (displacements) {
                            effectDisplacements[effectIndex] = displacements;
                            hasDisplacements = true;
                        }
                    }

                    // Apply combined displacements
                    if (hasDisplacements) {
                        for (let i = 0; i < particles.length; i++) {
                            const particle = particles[i];
                            let totalDx = 0;
                            let totalDy = 0;
                            let effectOpacity = 1;
                            let maxSize = 1;

                            for (let j = 0; j < effectDisplacements.length; j++) {
                                const displacement = effectDisplacements[j];
                                if (displacement && displacement[i]) {
                                    totalDx += displacement[i].dx;
                                    totalDy += displacement[i].dy;
                                    if (displacement[i].opacity !== undefined) {
                                        effectOpacity = Math.max(effectOpacity, displacement[i].opacity);
                                    }
                                    if (displacement[i].size !== undefined) {
                                        maxSize = Math.max(maxSize, displacement[i].size);
                                    }
                                }
                            }

                            particle.x += totalDx;
                            particle.y += totalDy;
                            particle.opacity = baseOpacity * effectOpacity;
                            particle.size = maxSize;
                        }
                    }
                }

                drawParticles();
            };
            
            function initializeParticles() {
                particles = [];
                const gridSize = calculateGridSize();
                const availableWidth = sketch.width - (padding * 2);
                const availableHeight = sketch.height - (padding * 2);
                
                let cols = Math.floor(availableWidth / gridSize);
                let rows = Math.floor(availableHeight / gridSize);
                
                if (cols < 1) cols = 1;
                if (rows < 1) rows = 1;
                
                const spacingX = (cols > 1) ? availableWidth / (cols - 1) : 0;
                const spacingY = (rows > 1) ? availableHeight / (rows - 1) : 0;
                
                for (let i = 0; i < cols; i++) {
                    for (let j = 0; j < rows; j++) {
                        const x = padding + ((cols > 1) ? i * spacingX : availableWidth / 2);
                        const y = padding + ((rows > 1) ? j * spacingY : availableHeight / 2);
                        // Store both current and original positions
                        particles.push({ 
                            x, 
                            y,
                            origX: x,
                            origY: y
                        });
                    }
                }
                
                // Notify effects that particles were reinitialized
                element.dispatchEvent(new CustomEvent('particlesReinitialized'));
                
                // Pre-allocate displacement arrays
                if (sketch.activeEffects) {
                    effectDisplacements = sketch.activeEffects.map(() => 
                        Array(particles.length).fill().map(() => ({ dx: 0, dy: 0 }))
                    );
                }
                
                // Resume animation when particles are initialized
                resumeAnimation();
            }
            
            function drawParticles() {
                const baseParticleSize = particleSize;
                
                // Disable stroke for clean shapes
                sketch.noStroke();
                
                // Batch similar opacity draws together
                let currentBatchOpacity = -1;
                
                for (let i = 0; i < particles.length; i++) {
                    const particle = particles[i];
                    const currentOpacity = particle.opacity;
                    const currentSize = particle.size * baseParticleSize;
                    
                    // Only set fill if opacity changed
                    if (currentBatchOpacity !== currentOpacity) {
                        currentBatchOpacity = currentOpacity;
                        sketch.fill(
                            cachedColorComponents.r,
                            cachedColorComponents.g,
                            cachedColorComponents.b,
                            255 * currentOpacity
                        );
                    }
                    
                    // Draw diamond using quad
                    sketch.quad(
                        particle.x, particle.y - currentSize,
                        particle.x + currentSize, particle.y,
                        particle.x, particle.y + currentSize,
                        particle.x - currentSize, particle.y
                    );
                }
            }
            
            sketch.windowResized = () => {
                sketch.resizeCanvas(element.offsetWidth, element.offsetHeight);
                // Re-calculate particle size
                particleSize = calculateParticleSize();
                // Invalidate caches
                sketch.particleSystem.invalidateCaches();
                initializeParticles();
                resumeAnimation();
            };
            
            // Clean up when the sketch is removed
            sketch.remove = () => {
                if (visibilityDetector) {
                    visibilityDetector.disconnect();
                }
                element.removeEventListener('mousemove', resumeAnimation);
                element.removeEventListener('click', resumeAnimation);
                element.removeEventListener('touchstart', resumeAnimation);
            };
        });
        
        sketches.push(p5Instance);
    });
});

// Export the effect registration system
window.ParticleEffects = ParticleEffects;

// Add this at the top with other utility functions
function createInteractionHelper(sketch, element) {
    return {
        getInteractionPosition() {
            const isTouchDevice = ('ontouchstart' in window) || 
                                (navigator.maxTouchPoints > 0) || 
                                (navigator.msMaxTouchPoints > 0);
            
            // Check for touch first
            if (isTouchDevice && sketch.touches && sketch.touches.length > 0) {
                const rect = sketch.canvas.getBoundingClientRect();
                const touch = sketch.touches[0];
                return {
                    x: sketch.map(touch.clientX - rect.left, 0, rect.width, 0, sketch.width),
                    y: sketch.map(touch.clientY - rect.top, 0, rect.height, 0, sketch.height),
                    isInteracting: true
                };
            }
            
            // Fall back to mouse
            const isMouseInBounds = sketch.mouseX >= 0 && sketch.mouseX <= sketch.width && 
                                  sketch.mouseY >= 0 && sketch.mouseY <= sketch.height;
            
            return {
                x: sketch.mouseX,
                y: sketch.mouseY,
                isInteracting: isMouseInBounds
            };
        }
    };
}

// Secret message: "I love you and I've read particles_core.js"