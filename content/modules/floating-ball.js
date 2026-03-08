/**
 * The Companion Orb - 核心交互悬浮球
 * 极简、磁吸、扇形菜单
 */

(function () {
    'use strict';

    const STORAGE_KEY = 'companionOrbPos';
    // 磁吸阈值（距离边缘多少像素内自动吸附）
    const SNAP_THRESHOLD = 50;

    let container = null;
    let ball = null;
    let menu = null;

    let isDragging = false;
    let dragOffset = { x: 0, y: 0 };
    let dragStartTime = 0;

    // 创建 Companion Orb
    const createOrb = () => {
        if (container) return;

        // Container
        container = document.createElement('div');
        container.id = 'st-floating-ball-container';

        // Orb
        ball = document.createElement('div');
        ball.id = 'st-floating-ball';
        // Icon (Small Feather / Abstract Text)
        ball.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"></path>
                <line x1="16" y1="8" x2="2" y2="22"></line>
                <line x1="17.5" y1="15" x2="9" y2="15"></line>
            </svg>
        `;
        ball.title = 'Smart Translator Companion';

        // Menu (Fan-out)
        menu = document.createElement('div');
        menu.className = 'st-orb-menu';

        // Menu Items
        const menuData = [
            {
                id: 'btn-immersive',
                icon: '<path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/> <circle cx="12" cy="12" r="10"/>',
                title: '全页翻译',
                action: () => ST.toggleImmersive && ST.toggleImmersive()
            },
            {
                id: 'btn-manga',
                icon: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/> <circle cx="8.5" cy="8.5" r="1.5"/> <polyline points="21 15 16 10 5 21"/>',
                title: '漫画模式',
                action: () => ST.manga && ST.manga.manualTrigger && ST.manga.manualTrigger()
            },
            {
                id: 'btn-sidebar',
                icon: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/> <line x1="9" y1="3" x2="9" y2="21"/>',
                title: '侧边栏',
                action: () => ST.sidebar && ST.sidebar.toggle && ST.sidebar.toggle()
            }
        ];

        menuData.forEach((item, index) => {
            const btn = document.createElement('div');
            btn.className = 'st-orb-menu-item';
            // Tag with index for dynamic positioning
            btn.dataset.index = index;
            btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${item.icon}</svg>`;
            btn.setAttribute('data-tooltip', item.title);

            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                item.action();
                toggleActive(false); // Close menu after click
            });
            menu.appendChild(btn);
        });

        container.appendChild(menu);
        container.appendChild(ball);
        document.body.appendChild(container);

        // Load position
        loadPosition();

        // Event Listeners
        ball.addEventListener('mousedown', onMouseDown);

        // Hover interactions
        container.addEventListener('mouseenter', () => !isDragging && toggleActive(true));
        container.addEventListener('mouseleave', () => !isDragging && toggleActive(false));
    };

    const toggleActive = (active) => {
        if (active) {
            container.classList.add('active');
            ball.classList.add('active');
        } else {
            container.classList.remove('active');
            ball.classList.remove('active');
        }
    };

    // Magnetic Docking Logic
    const loadPosition = async () => {
        try {
            const result = await chrome.storage.local.get(STORAGE_KEY);
            if (result[STORAGE_KEY]) {
                const { top } = result[STORAGE_KEY];
                // Only load Y position, X is always docked to edge
                dockToEdge(top, result[STORAGE_KEY].isRight);
            } else {
                dockToEdge(window.innerHeight * 0.8, true); // Default: Bottom-Right
            }
        } catch (e) {
            dockToEdge(window.innerHeight * 0.8, true);
        }
    };

    const dockToEdge = (y, isRight) => {
        // Clamp Y
        const safeY = Math.max(50, Math.min(y, window.innerHeight - 50));

        container.style.top = `${safeY}px`;
        if (isRight) {
            container.style.right = '0px';
            container.style.left = 'auto';
            updateMenuPositions(true); // Fan out Left/Top
        } else {
            container.style.left = '0px';
            container.style.right = 'auto';
            updateMenuPositions(false); // Fan out Right/Top
        }
    };

    // Dynamic Menu Positioning - Even Radial Fan-out
    const updateMenuPositions = (isDockedRight) => {
        if (!menu) return;
        const buttons = menu.querySelectorAll('.st-orb-menu-item');
        const count = buttons.length;
        const radius = 75; // Distance from center

        // Define arc range for safety (don't touch edges exactly)
        // 0 degrees is Right (East), -90 is Top (North), 180 is Left (West)

        let startAngle, endAngle;

        if (isDockedRight) {
            // Fan out to Top-Left: from ~190° (Left) to ~260° (Top)
            // Using radians. 180 deg = PI.
            // Let's use 190 to 260 degrees
            startAngle = 190 * (Math.PI / 180);
            endAngle = 260 * (Math.PI / 180);
        } else {
            // Fan out to Top-Right: from ~-10° (Right) to ~-80° (Top)
            startAngle = -10 * (Math.PI / 180);
            endAngle = -80 * (Math.PI / 180);
        }

        buttons.forEach((btn, index) => {
            // Calculate angle for this button
            // If count is 1, take middle. If > 1, distribute evenly.
            const progress = count > 1 ? index / (count - 1) : 0.5;
            const angle = startAngle + (endAngle - startAngle) * progress;

            const x = radius * Math.cos(angle);
            const y = radius * Math.sin(angle); // +Y is down, so negative sin is Up

            btn.style.transform = `translate(${x}px, ${y}px)`;
        });
    };

    const onMouseDown = (e) => {
        if (e.button !== 0) return;
        isDragging = false;
        dragStartTime = Date.now();

        // Get initial offset within the ball
        // container is fixed at top/left or top/right. 
        // We'll calculate offset relative to viewport
        const rect = ball.getBoundingClientRect();
        dragOffset = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };

        // Switch to absolute positioning for dragging
        container.style.transition = 'none'; // Disable transition for direct follow

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        e.preventDefault();
    };

    const onMouseMove = (e) => {
        isDragging = true;

        let clientX = e.clientX;
        let clientY = e.clientY;

        // Move the container
        // We need to set left/top based on mouse
        let newLeft = clientX - 20; // Center approximation
        let newTop = clientY - 20;

        container.style.left = `${newLeft}px`;
        container.style.top = `${newTop}px`;
        container.style.right = 'auto';
    };

    const onMouseUp = (e) => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);

        container.style.transition = 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';

        if (!isDragging || (Date.now() - dragStartTime < 200)) {
            // It was a click
            // Mobile toggle behavior or desktop explicit click
            // toggleActive(true); // Hover handles it on desktop
            return;
        }

        // Magnetic Dock
        const winWidth = window.innerWidth;
        const centerX = e.clientX;

        // Determine closest edge
        const isRight = centerX > winWidth / 2;

        dockToEdge(e.clientY, isRight);

        // Save
        chrome.storage.local.set({
            [STORAGE_KEY]: {
                top: e.clientY,
                isRight: isRight
            }
        });

        isDragging = false;
    };

    // Lifecycle
    const init = () => {
        console.log('[SmartTranslator] FloatingBall init called');
        const settings = ST.state.settings || {};
        console.log('[SmartTranslator] Settings:', settings);

        // Default to TRUE if undefined
        if (settings.showFloatingBall !== false) {
            console.log('[SmartTranslator] Creating Orb...');
            createOrb();
        } else {
            console.log('[SmartTranslator] Orb disabled by setting');
        }

        chrome.storage.onChanged.addListener((changes) => {
            if (changes.settings?.newValue) {
                const show = changes.settings.newValue.showFloatingBall;
                console.log('[SmartTranslator] Setting changed, showFloatingBall:', show);
                if (show === false && container) container.style.display = 'none';
                if (show !== false) {
                    if (!container) createOrb();
                    else container.style.display = 'flex';
                }
            }
        });
    };

    window.ST = window.ST || {};
    ST.floatingBall = { init };

    // Self-init if ready (fallback)
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            // Check if content.js already initialized it to avoid double init
            // But for now double init is safe-ish due to checks
            console.log('[SmartTranslator] DOMContentLoaded self-init check');
            if (!container) init();
        });
    } else {
        // init(); // Rely on content.js to call valid init with settings
    }
})();
