// Connect effect - highlights random lines in square groups
ParticleEffects.register('connect', (element, sketch) => {
    // Internal configuration
    const config = {
        groupSize: 10,           // Size of square groups (both width and height)
        baseOpacity: 0,          // Base opacity for non-highlighted particles
        highlightOpacity: 1.0,   // Opacity for highlighted middle line
        animation: {
            particleDelay: 0.1,  // Delay between each particle animation (seconds)
            duration: 1.0,       // Duration of each particle's fade animation (seconds)
            fadeOutStart: 0.7,   // When to start fading out (0-1 progress)
            cycleDelay: 1.0,     // Delay before starting a new cycle
            groupOffsetRange: {  // Random delay range for each group's start time
                min: 0.75,        // Minimum offset in seconds
                max: 2           // Maximum offset in seconds
            }
        }
    };

    // Store state
    let connectedIndices = new Set();  // Stores indices of highlighted particles
    let particleStates = new Map();    // Stores animation state for each particle
    let lastFrameTime = 0;             // Last frame timestamp
    let cycleStartTime = 0;            // When the current cycle started
    let groupStartTimes = new Map();   // Stores the start time for each group

    function getCurrentTime() {
        return sketch.millis() / 1000;  // Convert to seconds
    }

    function calculateGridGroups() {
        const particles = sketch.particleSystem.getParticles();
        if (!particles || particles.length === 0) return;

        // First, determine the grid dimensions
        const xPositions = new Set();
        const yPositions = new Set();
        const positionMap = new Map(); // Maps x,y to particle index
        
        particles.forEach((p, index) => {
            xPositions.add(p.origX);
            yPositions.add(p.origY);
            positionMap.set(`${p.origX},${p.origY}`, index);
        });

        // Convert to sorted arrays for consistent ordering
        const xArray = Array.from(xPositions).sort((a, b) => a - b);
        const yArray = Array.from(yPositions).sort((a, b) => a - b);
        const cols = xArray.length;
        const rows = yArray.length;

        // Calculate number of groups needed to cover the grid
        const numGroupsX = Math.ceil(cols / config.groupSize);
        const numGroupsY = Math.ceil(rows / config.groupSize);

        // Clear previous state
        connectedIndices.clear();
        particleStates.clear();
        groupStartTimes.clear();

        // Process each group
        for (let groupY = 0; groupY < numGroupsY; groupY++) {
            for (let groupX = 0; groupX < numGroupsX; groupX++) {
                // Calculate actual group dimensions for this position
                const startX = groupX * config.groupSize;
                const startY = groupY * config.groupSize;
                const endX = Math.min(startX + config.groupSize, cols);
                const endY = Math.min(startY + config.groupSize, rows);
                const currentGroupWidth = endX - startX;
                const currentGroupHeight = endY - startY;

                // Only process groups that have enough particles for a line
                if (currentGroupWidth < 3 || currentGroupHeight < 3) continue;

                // Get random row or column
                const isHorizontal = Math.random() < 0.5;
                const groupIndices = [];

                if (isHorizontal) {
                    // Highlight random row within the group
                    const randomY = startY + Math.floor(Math.random() * currentGroupHeight);
                    for (let x = startX; x < endX; x++) {
                        const xPos = xArray[x];
                        const yPos = yArray[randomY];
                        const index = positionMap.get(`${xPos},${yPos}`);
                        if (index !== undefined) {
                            connectedIndices.add(index);
                            groupIndices.push(index);
                        }
                    }
                } else {
                    // Highlight random column within the group
                    const randomX = startX + Math.floor(Math.random() * currentGroupWidth);
                    for (let y = startY; y < endY; y++) {
                        const xPos = xArray[randomX];
                        const yPos = yArray[y];
                        const index = positionMap.get(`${xPos},${yPos}`);
                        if (index !== undefined) {
                            connectedIndices.add(index);
                            groupIndices.push(index);
                        }
                    }
                }

                // Initialize animation states for this group's particles
                const groupOffset = config.animation.groupOffsetRange.min + 
                    Math.random() * (config.animation.groupOffsetRange.max - config.animation.groupOffsetRange.min);
                const groupId = `${groupX},${groupY}`;
                groupStartTimes.set(groupId, cycleStartTime + groupOffset);

                groupIndices.forEach((index, position) => {
                    particleStates.set(index, {
                        position,
                        progress: 0,
                        groupId,
                        startTime: groupStartTimes.get(groupId) + position * config.animation.particleDelay
                    });
                });
            }
        }
    }

    function updateAnimations(currentTime) {
        // Update animation progress for each particle
        particleStates.forEach((state, index) => {
            if (currentTime < state.startTime) {
                state.progress = 0;
                return;
            }

            const elapsed = currentTime - state.startTime;
            state.progress = Math.min(elapsed / config.animation.duration, 1);
        });

        // Check if all animations are complete
        const allComplete = Array.from(particleStates.values()).every(state => state.progress >= 1);
        
        if (allComplete && (currentTime - cycleStartTime) > config.animation.cycleDelay) {
            // Start new cycle
            cycleStartTime = currentTime;
            calculateGridGroups();
        }
    }

    // Initialize on setup
    cycleStartTime = getCurrentTime();
    calculateGridGroups();

    // Listen for particle reinitialization
    element.addEventListener('particlesReinitialized', () => {
        cycleStartTime = getCurrentTime();
        calculateGridGroups();
    });

    return {
        updateParticles: (particles) => {
            if (!particles || particles.length === 0) {
                return null;
            }

            // Update animations
            updateAnimations(getCurrentTime());

            // Return opacity values for each particle
            return particles.map((particle, index) => {
                if (!connectedIndices.has(index)) {
                    return { dx: 0, dy: 0, opacity: config.baseOpacity };
                }

                const state = particleStates.get(index);
                const progress = state ? state.progress : 0;
                
                // Smooth easing function for fade in/out
                const easeInOutCubic = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
                
                // Calculate opacity based on fade in/out phases
                let fadeProgress;
                if (progress < config.animation.fadeOutStart) {
                    // Fade in phase
                    fadeProgress = progress / config.animation.fadeOutStart;
                } else {
                    // Fade out phase
                    fadeProgress = 1 - ((progress - config.animation.fadeOutStart) / (1 - config.animation.fadeOutStart));
                }
                
                const opacity = config.baseOpacity + (config.highlightOpacity - config.baseOpacity) * easeInOutCubic(fadeProgress);

                return {
                    dx: 0,
                    dy: 0,
                    opacity
                };
            });
        }
    };
});
