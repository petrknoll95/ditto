// Connect effect - randomly selects particles in evenly distributed groups
ParticleEffects.register('connect', (element, sketch) => {
    // Internal configuration
    const config = {
        connectedRatio: 0.2,      // Target ratio of particles to be connected
        baseOpacity: 0.2,         // Base opacity for non-connected
        connectedOpacity: 1.0,    // Full opacity for connected
        groupSize: 6,             // Number of particles in a row/column
        minSpacing: 2,            // Minimum particles between groups
        regions: 3,               // Divide canvas into regions
        maxAttempts: 10,          // Maximum attempts to place a group
        animation: {
            particleDelay: 0.15,  // Delay between particles in sequence
            duration: 1.2,        // Duration of each particle animation
            cycleDelay: 1.0       // Delay before starting new cycle
        }
    };

    // Store connected particles indices and group positions
    let connectedIndices = new Set();
    let placedGroups = [];  // Store info about placed groups
    let particleAnimations = new Map(); // Store animation state for each particle
    let isTransitioning = false;  // Flag to track when we're between cycles
    let transitionEndTime = 0;    // Time when transition should end
    let cycleStartTime = 0;       // Time when current cycle started

    // Animation state tracking
    let lastFrameTime = 0;
    
    function getCurrentTime() {
        return sketch.millis() / 1000; // Convert to seconds
    }

    // Initialize connected particles with even distribution
    function initializeConnectedParticles() {
        const particles = sketch.particleSystem.getParticles();
        if (!particles || particles.length === 0) return;

        // Reset all states
        connectedIndices.clear();
        placedGroups = [];
        particleAnimations.clear();
        lastFrameTime = getCurrentTime();

        // Calculate grid dimensions
        const gridSize = calculateGridSize();
        const cols = gridSize.cols;
        const rows = gridSize.rows;

        // Divide the grid into regions
        const regionWidth = Math.ceil(cols / config.regions);
        const regionHeight = Math.ceil(rows / config.regions);

        // Create regions array
        const regions = [];
        for (let i = 0; i < config.regions; i++) {
            for (let j = 0; j < config.regions; j++) {
                regions.push({
                    startCol: j * regionWidth,
                    endCol: Math.min((j + 1) * regionWidth, cols),
                    startRow: i * regionHeight,
                    endRow: Math.min((i + 1) * regionHeight, rows),
                    used: false
                });
            }
        }

        // Shuffle regions for random selection
        shuffleArray(regions);

        // Calculate target groups per region
        const totalParticles = particles.length;
        const targetGroupCount = Math.floor((totalParticles * config.connectedRatio) / config.groupSize);
        const groupsPerRegion = Math.ceil(targetGroupCount / regions.length);

        // Place groups in each region
        regions.forEach(region => {
            if (connectedIndices.size >= totalParticles * config.connectedRatio) return;

            for (let attempt = 0; attempt < groupsPerRegion; attempt++) {
                // Randomly decide between row or column
                const isRow = Math.random() < 0.5;
                
                if (isRow && (region.endRow - region.startRow) > config.minSpacing * 2) {
                    tryPlaceRowInRegion(region, cols, rows);
                } else if (!isRow && (region.endCol - region.startCol) > config.minSpacing * 2) {
                    tryPlaceColumnInRegion(region, cols, rows);
                }
            }
        });

        // After placing groups, initialize their animation states
        placedGroups.forEach(group => {
            const nextAnimationTime = getCurrentTime() + 
                Math.random() * (config.animation.maxGroupDelay - config.animation.minGroupDelay) + 
                config.animation.minGroupDelay;
            
            group.nextAnimationTime = nextAnimationTime;
            group.isAnimating = false;
            
            // Initialize particles in this group
            const particleIndices = getParticleIndicesForGroup(group);
            particleIndices.forEach((index, position) => {
                particleAnimations.set(index, {
                    progress: 0,
                    position: position, // Position in the sequence
                    isAnimating: false
                });
            });
        });
    }

    function tryPlaceRowInRegion(region, cols, rows) {
        for (let attempt = 0; attempt < config.maxAttempts; attempt++) {
            // Select a random row within the region
            const row = region.startRow + Math.floor(Math.random() * (region.endRow - region.startRow));
            
            // Calculate valid column range for placement
            const maxStartCol = region.endCol - config.groupSize;
            if (maxStartCol < region.startCol) return;
            
            const startCol = region.startCol + Math.floor(Math.random() * (maxStartCol - region.startCol));
            
            // Check if this position is valid
            const groupInfo = {
                type: 'row',
                row: row,
                startCol: startCol,
                endCol: startCol + config.groupSize - 1
            };

            if (isValidGroupPlacement(groupInfo, cols, rows)) {
                // Place the group
                for (let c = 0; c < config.groupSize && (startCol + c) < cols; c++) {
                    const index = getParticleIndex(row, startCol + c, cols);
                    connectedIndices.add(index);
                }
                placedGroups.push(groupInfo);
                return true;
            }
        }
        return false;
    }

    function tryPlaceColumnInRegion(region, cols, rows) {
        for (let attempt = 0; attempt < config.maxAttempts; attempt++) {
            // Select a random column within the region
            const col = region.startCol + Math.floor(Math.random() * (region.endCol - region.startCol));
            
            // Calculate valid row range for placement
            const maxStartRow = region.endRow - config.groupSize;
            if (maxStartRow < region.startRow) return;
            
            const startRow = region.startRow + Math.floor(Math.random() * (maxStartRow - region.startRow));
            
            // Check if this position is valid
            const groupInfo = {
                type: 'column',
                col: col,
                startRow: startRow,
                endRow: startRow + config.groupSize - 1
            };

            if (isValidGroupPlacement(groupInfo, cols, rows)) {
                // Place the group
                for (let r = 0; r < config.groupSize && (startRow + r) < rows; r++) {
                    const index = getParticleIndex(startRow + r, col, cols);
                    connectedIndices.add(index);
                }
                placedGroups.push(groupInfo);
                return true;
            }
        }
        return false;
    }

    function isValidGroupPlacement(newGroup, cols, rows) {
        // Check boundaries
        if (newGroup.type === 'row') {
            if (newGroup.row < 0 || newGroup.row >= rows || 
                newGroup.startCol < 0 || newGroup.endCol >= cols) {
                return false;
            }
        } else {
            if (newGroup.col < 0 || newGroup.col >= cols || 
                newGroup.startRow < 0 || newGroup.endRow >= rows) {
                return false;
            }
        }

        // Check for intersections and minimum spacing with existing groups
        for (const existingGroup of placedGroups) {
            if (!maintainsMinimumSpacing(newGroup, existingGroup)) {
                return false;
            }
        }

        return true;
    }

    function maintainsMinimumSpacing(group1, group2) {
        if (group1.type === 'row' && group2.type === 'row') {
            // Check row spacing
            if (Math.abs(group1.row - group2.row) < config.minSpacing) {
                return false;
            }
            // Check column overlap with spacing
            const overlap = !(group1.endCol + config.minSpacing < group2.startCol || 
                            group1.startCol > group2.endCol + config.minSpacing);
            return !overlap;
        }
        
        if (group1.type === 'column' && group2.type === 'column') {
            // Check column spacing
            if (Math.abs(group1.col - group2.col) < config.minSpacing) {
                return false;
            }
            // Check row overlap with spacing
            const overlap = !(group1.endRow + config.minSpacing < group2.startRow || 
                            group1.startRow > group2.endRow + config.minSpacing);
            return !overlap;
        }

        // Row vs Column
        if (group1.type === 'row' && group2.type === 'column') {
            // Check if the column is within the row's range (with spacing)
            const colInRange = group2.col >= (group1.startCol - config.minSpacing) && 
                             group2.col <= (group1.endCol + config.minSpacing);
            // Check if the row is within the column's range (with spacing)
            const rowInRange = group1.row >= (group2.startRow - config.minSpacing) && 
                             group1.row <= (group2.endRow + config.minSpacing);
            return !(colInRange && rowInRange);
        }

        // Column vs Row (swap the above check)
        if (group1.type === 'column' && group2.type === 'row') {
            return maintainsMinimumSpacing(group2, group1);
        }

        return true;
    }

    function getParticleIndicesForGroup(group) {
        const indices = [];
        if (group.type === 'row') {
            for (let c = 0; c < config.groupSize; c++) {
                indices.push(getParticleIndex(group.row, group.startCol + c, calculateGridSize().cols));
            }
        } else {
            for (let r = 0; r < config.groupSize; r++) {
                indices.push(getParticleIndex(group.startRow + r, group.col, calculateGridSize().cols));
            }
        }
        return indices;
    }

    function reshuffleGroups() {
        connectedIndices.clear();
        placedGroups = [];
        particleAnimations.clear();

        const gridSize = calculateGridSize();
        const cols = gridSize.cols;
        const rows = gridSize.rows;

        placeGroupsInRegions(cols, rows);

        placedGroups.forEach((group, index) => {
            const particleIndices = getParticleIndicesForGroup(group);
            particleIndices.forEach((index, position) => {
                particleAnimations.set(index, {
                    progress: 0,
                    position: position,
                    isAnimating: false,
                    startTime: 0
                });
            });
        });

        cycleStartTime = getCurrentTime();
        isTransitioning = false;
    }

    function placeGroupsInRegions(cols, rows) {
        // Divide the grid into regions
        const regionWidth = Math.ceil(cols / config.regions);
        const regionHeight = Math.ceil(rows / config.regions);

        // Create regions array
        const regions = [];
        for (let i = 0; i < config.regions; i++) {
            for (let j = 0; j < config.regions; j++) {
                regions.push({
                    startCol: j * regionWidth,
                    endCol: Math.min((j + 1) * regionWidth, cols),
                    startRow: i * regionHeight,
                    endRow: Math.min((i + 1) * regionHeight, rows),
                    used: false
                });
            }
        }

        // Shuffle regions for random selection
        shuffleArray(regions);

        // Calculate target groups per region
        const totalParticles = cols * rows;
        const targetGroupCount = Math.floor((totalParticles * config.connectedRatio) / config.groupSize);
        const groupsPerRegion = Math.ceil(targetGroupCount / regions.length);

        // Place groups in each region
        regions.forEach(region => {
            if (connectedIndices.size >= totalParticles * config.connectedRatio) return;

            for (let attempt = 0; attempt < groupsPerRegion; attempt++) {
                const isRow = Math.random() < 0.5;
                
                if (isRow && (region.endRow - region.startRow) > config.minSpacing * 2) {
                    tryPlaceRowInRegion(region, cols, rows);
                } else if (!isRow && (region.endCol - region.startCol) > config.minSpacing * 2) {
                    tryPlaceColumnInRegion(region, cols, rows);
                }
            }
        });
    }

    function updateAnimations(currentTime) {
        const deltaTime = currentTime - lastFrameTime;
        lastFrameTime = currentTime;

        if (isTransitioning) {
            if (currentTime >= transitionEndTime) {
                reshuffleGroups();
            }
            return;
        }

        placedGroups.forEach((group, groupIndex) => {
            if (group.isAnimating) return;

            const groupStartTime = cycleStartTime + (groupIndex * 0.3);
            if (currentTime >= groupStartTime) {
                startGroupAnimation(group, currentTime);
            }
        });

        let anyParticleAnimating = false;

        particleAnimations.forEach((animation, index) => {
            if (!animation.isAnimating) return;

            const startTime = animation.startTime + (animation.position * config.animation.particleDelay);
            if (currentTime < startTime) {
                anyParticleAnimating = true;
                return;
            }

            const elapsed = currentTime - startTime;
            animation.progress = Math.min(elapsed / config.animation.duration, 1);

            if (animation.progress >= 1) {
                animation.isAnimating = false;
            } else {
                anyParticleAnimating = true;
            }
        });

        if (!isTransitioning && !anyParticleAnimating) {
            const allComplete = placedGroups.every(group => {
                const particleIndices = getParticleIndicesForGroup(group);
                return particleIndices.every(index => {
                    const animation = particleAnimations.get(index);
                    return !animation.isAnimating;
                });
            });

            if (allComplete && (currentTime - cycleStartTime) > config.animation.duration * 2) {
                isTransitioning = true;
                transitionEndTime = currentTime + config.animation.cycleDelay;
            }
        }
    }

    function startGroupAnimation(group, currentTime) {
        if (group.isAnimating) return;
        
        group.isAnimating = true;
        
        // Start animation for each particle in the group
        const particleIndices = getParticleIndicesForGroup(group);
        particleIndices.forEach((index, position) => {
            const animation = particleAnimations.get(index);
            animation.isAnimating = true;
            animation.progress = 0;
            animation.startTime = currentTime;
        });
    }

    function getParticleOpacity(index, baseOpacity) {
        const animation = particleAnimations.get(index);
        if (!animation || !animation.isAnimating) {
            return config.baseOpacity; // Return base opacity when not animating
        }

        // Smooth easing function for the animation
        const easeInOutCubic = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        
        // Interpolate between base opacity and full opacity
        const progress = easeInOutCubic(animation.progress);
        const opacity = config.baseOpacity + (config.connectedOpacity - config.baseOpacity) * progress;
        return opacity;
    }

    // Helper function to shuffle array
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    // Helper functions for grid calculations
    function calculateGridSize() {
        const particles = sketch.particleSystem.getParticles();
        const xPositions = new Set();
        const yPositions = new Set();
        
        particles.forEach(p => {
            xPositions.add(p.origX);
            yPositions.add(p.origY);
        });

        return {
            cols: xPositions.size,
            rows: yPositions.size
        };
    }

    function getParticleIndex(row, col, cols) {
        return row * cols + col;
    }

    // Initialize on setup
    initializeConnectedParticles();

    // Listen for particle reinitialization
    element.addEventListener('particlesReinitialized', () => {
        initializeConnectedParticles();
    });

    return {
        updateParticles: (particles) => {
            if (!particles || particles.length === 0) {
                return null;
            }

            // Update animations
            updateAnimations(getCurrentTime());

            // Create displacement array for each particle
            return particles.map((particle, index) => {
                const isConnected = connectedIndices.has(index);
                return {
                    dx: 0,
                    dy: 0,
                    opacity: isConnected ? getParticleOpacity(index, config.connectedOpacity) : config.baseOpacity
                };
            });
        }
    };
});
