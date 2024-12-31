// Register the pixelate functionality
pageFunctions.addFunction('pixelate', () => {
    /**
     * Configuration object with default settings
     */
    const DEFAULT_CONFIG = {
        size: 20,        // Default number of blocks (image will be divided into size x size grid)
        frames: 10,      // Default number of frames for the animation
        duration: 0.3    // Default duration of the animation in seconds
    };

    /**
     * Utility: getPixelateConfig
     * Reads configuration from data attributes, falls back to defaults
     */
    function getPixelateConfig(container) {
        return {
            size: container.dataset.pixelateSize ? parseInt(container.dataset.pixelateSize, 10) : DEFAULT_CONFIG.size,
            frames: container.dataset.pixelateFrames ? parseInt(container.dataset.pixelateFrames, 10) : DEFAULT_CONFIG.frames,
            duration: container.dataset.pixelateDuration ? parseFloat(container.dataset.pixelateDuration) : DEFAULT_CONFIG.duration
        };
    }

    /**
     * generatePixelBlocks
     * Creates the blocks for the pixelate effect based on image dimensions
     */
    function generatePixelBlocks(container, gridSize) {
        // Get the image element
        const image = container.querySelector('img');
        if (!image) return [];

        // Get the actual image dimensions
        const rect = image.getBoundingClientRect();
        const imageWidth = rect.width;
        const imageHeight = rect.height;

        // Calculate block dimensions based on image size and desired grid
        const blockWidth = imageWidth / gridSize;
        const blockHeight = imageHeight / gridSize;

        // Create blocks in a DocumentFragment for performance
        const fragment = document.createDocumentFragment();
        const blocks = [];

        // Create wrapper for blocks that will be clipped to image bounds
        const wrapper = document.createElement('div');
        wrapper.style.position = 'absolute';
        wrapper.style.top = '0';
        wrapper.style.left = '0';
        wrapper.style.width = imageWidth + 'px';
        wrapper.style.height = imageHeight + 'px';
        wrapper.style.overflow = 'hidden';
        wrapper.style.zIndex = '2';

        // Create a grid of blocks
        for (let r = 0; r < gridSize; r++) {
            for (let c = 0; c < gridSize; c++) {
                const block = document.createElement('div');
                block.style.position = 'absolute';

                // Calculate position and size for this block
                const top = r * blockHeight;
                const left = c * blockWidth;
                const width = (c === gridSize - 1) ? imageWidth - left : Math.ceil(blockWidth);
                const height = (r === gridSize - 1) ? imageHeight - top : Math.ceil(blockHeight);

                block.style.top = top + 'px';
                block.style.left = left + 'px';
                block.style.width = width + 'px';
                block.style.height = height + 'px';
                block.style.backgroundColor = 'var(--theme--background)';
                block.style.opacity = '1';

                wrapper.appendChild(block);
                blocks.push(block);
            }
        }

        fragment.appendChild(wrapper);
        container.appendChild(fragment);
        return blocks;
    }

    /**
     * pixelateAnimation
     * Handles the pixelate animations (both in and out)
     */
    function pixelateAnimation(container, direction = 'in') {
        // Prevent animation if already animating
        if (container._isAnimating) return;
        
        // Get configuration from data attributes or defaults
        const config = getPixelateConfig(container);

        // Get the image element
        const image = container.querySelector('img');
        if (!image) return;

        // Use existing blocks or generate new ones
        let blocks = container._pixelateBlocks || generatePixelBlocks(container, config.size);
        if (!blocks.length) return;

        // Set animation flag
        container._isAnimating = true;

        // Create the animation timeline
        const tl = gsap.timeline({
            onComplete: () => {
                if (direction === 'in') {
                    // Clean up the blocks after fade in
                    blocks.forEach(block => block.remove());
                    delete container._pixelateBlocks;
                } else {
                    // Store blocks reference for fade in
                    container._pixelateBlocks = blocks;
                }
                // Set final image visibility
                image.style.visibility = direction === 'in' ? 'visible' : 'hidden';
                // Reset animation flag
                container._isAnimating = false;
            }
        });

        // Set initial and target opacity based on direction
        const fromOpacity = direction === 'in' ? 1 : 0;
        const toOpacity = direction === 'in' ? 0 : 1;

        // Set initial states
        blocks.forEach(block => block.style.opacity = fromOpacity);
        image.style.visibility = direction === 'in' ? 'visible' : 'visible';

        // Shuffle blocks for random reveal
        gsap.utils.shuffle(blocks);

        tl.to(blocks, {
            opacity: toOpacity,
            duration: config.duration,
            stagger: {
                each: config.duration / blocks.length,
                from: 'random',
                ease: 'none'
            },
            snap: { opacity: 1 },
            ease: 'steps(1)'
        });

        return tl;
    }

    // Initialize and expose the animation functions
    const containers = document.querySelectorAll('[data-pixelate="true"]');
    containers.forEach((container) => {
        // Initialize animation state
        container._isAnimating = false;

        // Ensure container has position relative
        if (getComputedStyle(container).position === 'static') {
            container.style.position = 'relative';
        }

        // Add the animation functions to the container element with state checks
        container.pixelateIn = () => {
            if (!container._isAnimating && container._pixelateBlocks) {
                return pixelateAnimation(container, 'in');
            }
        };
        container.pixelateOut = () => {
            if (!container._isAnimating && !container._pixelateBlocks) {
                return pixelateAnimation(container, 'out');
            }
        };

        // Handle initial hidden state if specified
        if (container.dataset.pixelateHidden === 'true') {
            // Hide image initially
            const image = container.querySelector('img');
            if (image) {
                image.style.visibility = 'hidden';
            }

            // Create initial blocks without animation
            const config = getPixelateConfig(container);
            const blocks = generatePixelBlocks(container, config.size);
            blocks.forEach(block => {
                block.style.opacity = '1';
            });
            
            // Store blocks reference for later use
            container._pixelateBlocks = blocks;
        }

        // Handle scroll trigger if specified
        if (container.dataset.pixelateTrigger === 'scroll') {
            // Hide image initially
            const image = container.querySelector('img');
            if (image) {
                image.style.visibility = 'hidden';
            }

            // Create initial blocks if not already created
            if (!container._pixelateBlocks) {
                const config = getPixelateConfig(container);
                const blocks = generatePixelBlocks(container, config.size);
                blocks.forEach(block => {
                    block.style.opacity = '1';
                });
                container._pixelateBlocks = blocks;
            }

            // Create ScrollTrigger
            ScrollTrigger.create({
                trigger: container,
                start: "top 80%",
                once: true,
                onEnter: () => {
                    container.pixelateIn();
                }
            });
        }
    });
});