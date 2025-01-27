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
            
            // Public API for effects to interact with the particle system
            sketch.particleSystem = {
                getParticles: () => particles,
                setParticles: (newParticles) => {
                    particles = newParticles;
                },
                getDensity: () => density,
                getPadding: () => padding,
                getParticleSize: () => calculateParticleSize()
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
            
            sketch.setup = () => {
                const canvas = sketch.createCanvas(element.offsetWidth, element.offsetHeight);
                canvas.parent(element);
                
                density = parseInt(element.dataset.gridDensity) || 2;
                padding = parseInt(element.dataset.gridPadding) || 0;
                
                initializeParticles();
                
                // Initialize any effects for this element
                ParticleEffects.initializeEffects(element, sketch);
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
                        const displacements = sketch.activeEffects
                            .map(effect => effect.updateParticles(particles))
                            .filter(d => d !== null);

                        // Apply combined displacements
                        particles.forEach((particle, i) => {
                            let totalDx = 0;
                            let totalDy = 0;
                            let maxOpacity = parseFloat(element.dataset.gridOpacity) || 1;
                            let maxSize = 1;

                            displacements.forEach(effectDisplacements => {
                                if (effectDisplacements[i]) {
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
            }
            
            function drawParticles(color) {
                sketch.noStroke();
                
                // Parse the color to get its components
                const col = sketch.color(color);
                const baseParticleSize = calculateParticleSize();
                
                particles.forEach(particle => {
                    // Get the current opacity and size for this particle
                    const baseOpacity = parseFloat(element.dataset.gridOpacity) || 1;
                    const currentOpacity = particle.opacity !== undefined ? particle.opacity : baseOpacity;
                    const currentSize = particle.size !== undefined ? baseParticleSize * particle.size : baseParticleSize;
                    
                    // Set the color with the current opacity
                    sketch.fill(sketch.red(col), sketch.green(col), sketch.blue(col), 255 * currentOpacity);
                    
                    sketch.beginShape();
                    sketch.vertex(particle.x, particle.y - currentSize);
                    sketch.vertex(particle.x + currentSize, particle.y);
                    sketch.vertex(particle.x, particle.y + currentSize);
                    sketch.vertex(particle.x - currentSize, particle.y);
                    sketch.endShape(sketch.CLOSE);
                });
            }
            
            sketch.windowResized = () => {
                sketch.resizeCanvas(element.offsetWidth, element.offsetHeight);
                initializeParticles();
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
