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
            let isAnimating = true;
            let visibilityDetector;
            let lastFillColor = null;
            let lastOpacity = -1;
            
            // Store pre-calculated displacements for reuse
            let effectDisplacements = [];
            
            // Public API for effects to interact with the particle system
            sketch.particleSystem = {
                getParticles: () => particles,
                setParticles: (newParticles) => {
                    particles = newParticles;
                },
                getDensity: () => density,
                getPadding: () => padding,
                getParticleSize: () => particleSize
            };
            
            // Breakpoints for responsive particle sizing
            const BREAKPOINTS = {
                sm: 480,
                md: 768,
                lg: 1024
            };
            
            function calculateResponsiveScale() {
                const viewportWidth = window.innerWidth;
                
                if (viewportWidth <= BREAKPOINTS.sm) {
                    return { size: 1.25, density: 0.75 };
                } else if (viewportWidth <= BREAKPOINTS.md) {
                    return { size: 1.125, density: 0.875 };
                } else if (viewportWidth <= BREAKPOINTS.lg) {
                    return { size: 1, density: 1 };
                }  else {
                    return { size: 1, density: 1 };
                }
            }
            
            function calculateParticleSize() {
                const baseSize = parseInt(element.dataset.gridSize) || 1;
                const { size: scale } = calculateResponsiveScale();
                return 1 * baseSize * scale;
            }
            
            function calculateGridSize() {
                const baseDensity = parseInt(element.dataset.gridDensity) || 2;
                const { density: scale } = calculateResponsiveScale();
                // Make density differences more subtle by using a non-linear scale
                const normalizedDensity = 1 + ((baseDensity - 1) * 0.3);
                return 20 * normalizedDensity * scale;
            }
            
            // Function to resume animation
            function resumeAnimation() {
                if (!isAnimating) {
                    isAnimating = true;
                    sketch.loop();
                }
            }
            
            // Function to pause animation
            function pauseAnimation() {
                if (isAnimating) {
                    isAnimating = false;
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
                
                density = parseInt(element.dataset.gridDensity) || 2;
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
                const computedStyle = getComputedStyle(element);
                const dotColor = computedStyle.getPropertyValue('--theme--dot-color').trim();
                
                if (particles && particles.length > 0) {
                    // Reset particles to original positions and properties
                    particles.forEach(particle => {
                        particle.x = particle.origX;
                        particle.y = particle.origY;
                        particle.opacity = undefined; // Reset opacity
                        particle.size = undefined;    // Reset size
                    });

                    // Only apply effects if there are active effects
                    if (sketch.activeEffects && sketch.activeEffects.length > 0) {
                        // Get displacements from all active effects
                        let hasDisplacements = false;
                        
                        sketch.activeEffects.forEach((effect, effectIndex) => {
                            const displacements = effect.updateParticles(particles, effectDisplacements[effectIndex]);
                            if (displacements) {
                                effectDisplacements[effectIndex] = displacements;
                                hasDisplacements = true;
                            }
                        });

                        // Apply combined displacements
                        if (hasDisplacements) {
                            particles.forEach((particle, i) => {
                                let totalDx = 0;
                                let totalDy = 0;
                                let maxOpacity = parseFloat(element.dataset.gridOpacity) || 1;
                                let maxSize = 1;

                                effectDisplacements.forEach(effectDisplacements => {
                                    if (effectDisplacements && effectDisplacements[i]) {
                                        totalDx += effectDisplacements[i].dx;
                                        totalDy += effectDisplacements[i].dy;
                                        // Use the highest opacity value from all effects
                                        if (effectDisplacements[i].opacity !== undefined) {
                                            maxOpacity = Math.max(maxOpacity, effectDisplacements[i].opacity);
                                        }
                                        // Use the highest size value from all effects
                                        if (effectDisplacements[i].size !== undefined) {
                                            maxSize = Math.max(maxSize, effectDisplacements[i].size);
                                        }
                                    }
                                });

                                particle.x += totalDx;
                                particle.y += totalDy;
                                particle.opacity = maxOpacity;
                                particle.size = maxSize;
                            });
                        }
                    }

                    drawParticles(dotColor);
                }
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
            
            function drawParticles(color) {
                // Parse the color to get its components
                const col = sketch.color(color);
                const baseParticleSize = particleSize;
                
                // Get base opacity
                const baseOpacity = parseFloat(element.dataset.gridOpacity) || 1;
                
                particles.forEach(particle => {
                    // Get the current opacity and size for this particle
                    const currentOpacity = particle.opacity !== undefined ? particle.opacity : baseOpacity;
                    const currentSize = particle.size !== undefined ? baseParticleSize * particle.size : baseParticleSize;
                    
                    // Only set fill if opacity changed (optimization)
                    if (lastOpacity !== currentOpacity) {
                        sketch.fill(sketch.red(col), sketch.green(col), sketch.blue(col), 255 * currentOpacity);
                        lastOpacity = currentOpacity;
                    }
                    
                    // Draw diamond using quad() instead of beginShape/vertex/endShape
                    sketch.quad(
                        particle.x, particle.y - currentSize,
                        particle.x + currentSize, particle.y,
                        particle.x, particle.y + currentSize,
                        particle.x - currentSize, particle.y
                    );
                });
            }
            
            sketch.windowResized = () => {
                sketch.resizeCanvas(element.offsetWidth, element.offsetHeight);
                // Re-calculate particle size
                particleSize = calculateParticleSize();
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
