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
        if (element.dataset.gridType) {
            const effectTypes = element.dataset.gridType.split(' ');
            effectTypes.forEach(type => {
                const effectInitializer = effectRegistry.get(type);
                if (effectInitializer) {
                    // Initialize immediately after setup
                    effectInitializer(element, sketch);
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
                lg: 1024,
                xl: 1440
            };
            
            function calculateResponsiveScale() {
                const viewportWidth = window.innerWidth;
                
                if (viewportWidth <= BREAKPOINTS.sm) {
                    return { size: 0.5, density: 0.25 }; // 50% size, smallest grid (most particles)
                } else if (viewportWidth <= BREAKPOINTS.md) {
                    return { size: 0.75, density: 0.4 }; // 75% size, more particles
                } else if (viewportWidth <= BREAKPOINTS.lg) {
                    return { size: 1, density: 0.6 };    // 100% size, base density
                } else if (viewportWidth <= BREAKPOINTS.xl) {
                    return { size: 1.25, density: 0.8 }; // 125% size, fewer particles
                } else {
                    return { size: 1.5, density: 1 };    // 150% size, fewest particles
                }
            }
            
            function calculateParticleSize() {
                const baseSize = parseInt(element.dataset.gridSize) || 1;
                const { size: scale } = calculateResponsiveScale();
                // Calculate final size (3 is the original base particle size)
                return 2 * baseSize * scale;
            }
            
            function calculateGridSize() {
                const baseDensity = parseInt(element.dataset.density) || 2;
                const { density: scale } = calculateResponsiveScale();
                // Make density differences more subtle by using a non-linear scale
                const normalizedDensity = 1 + ((baseDensity - 1) * 0.3);
                return 20 * normalizedDensity * scale;
            }
            
            sketch.setup = () => {
                const canvas = sketch.createCanvas(element.offsetWidth, element.offsetHeight);
                canvas.parent(element);
                
                density = parseInt(element.dataset.density) || 2;
                padding = parseInt(element.dataset.padding) || 0;
                
                initializeParticles();
                
                // Initialize any effects for this element
                ParticleEffects.initializeEffects(element, sketch);
            };
            
            sketch.draw = () => {
                sketch.clear();
                const computedStyle = getComputedStyle(element);
                const dotColor = computedStyle.getPropertyValue('--theme--dot-color').trim();
                if (particles && particles.length > 0) {
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
                        particles.push({ x, y });
                    }
                }
                
                // Notify effects that particles were reinitialized
                element.dispatchEvent(new CustomEvent('particlesReinitialized'));
            }
            
            function drawParticles(color) {
                sketch.noStroke();
                sketch.fill(color);
                
                const particleSize = calculateParticleSize();
                
                particles.forEach(particle => {
                    sketch.beginShape();
                    sketch.vertex(particle.x, particle.y - particleSize);
                    sketch.vertex(particle.x + particleSize, particle.y);
                    sketch.vertex(particle.x, particle.y + particleSize);
                    sketch.vertex(particle.x - particleSize, particle.y);
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
