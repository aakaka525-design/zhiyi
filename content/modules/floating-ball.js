/**
 * The Companion Orb - 核心交互悬浮球
 * 胶囊展开、磁吸、可拖拽
 */

(function () {
    'use strict';

    const STORAGE_KEY = 'companionOrbPos';

    let container = null;
    let ball = null;
    let capsule = null;
    let handle = null;
    let initialized = false;

    let isDragging = false;
    let dragOffset = { x: 0, y: 0 };
    let dragStartTime = 0;
    let capsuleOpen = false;
    let closeTimer = null;

    const menuData = [
        {
            id: 'immersive',
            icon: '<path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/> <circle cx="12" cy="12" r="10"/>',
            label: '全页翻译',
            action: () => ST.toggleImmersive && ST.toggleImmersive(),
        },
        {
            id: 'sidebar',
            icon: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/> <line x1="9" y1="3" x2="9" y2="21"/>',
            label: '侧边栏',
            action: () => ST.toggleSidebar && ST.toggleSidebar(),
        },
        {
            id: 'float-window',
            icon: '<rect x="3" y="3" width="18" height="18" rx="2"/> <line x1="3" y1="9" x2="21" y2="9"/> <circle cx="7" cy="6" r="1" fill="currentColor" stroke="none"/> <circle cx="11" cy="6" r="1" fill="currentColor" stroke="none"/>',
            label: '翻译小窗',
            action: () => ST.toggleFloatWindow && ST.toggleFloatWindow(),
        },
    ];

    const clearCloseTimer = () => {
        if (closeTimer) {
            clearTimeout(closeTimer);
            closeTimer = null;
        }
    };

    const updateCapsuleDirection = () => {
        if (!container || !ball) return;
        const ballRect = ball.getBoundingClientRect();
        const expandLeft = ballRect.left > window.innerWidth / 2;
        container.classList.toggle('expand-left', expandLeft);
        container.classList.toggle('expand-right', !expandLeft);
    };

    const closeCapsule = () => {
        if (!container || !ball) return;
        clearCloseTimer();
        capsuleOpen = false;
        container.classList.remove('capsule-open');
        ball.classList.remove('active');
    };

    const openCapsule = () => {
        if (!container || !ball) return;
        clearCloseTimer();
        updateCapsuleDirection();
        capsuleOpen = true;
        container.classList.add('capsule-open');
        ball.classList.add('active');
    };

    const createCapsuleButton = (item) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'st-capsule-btn';
        btn.dataset.action = item.id;
        btn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${item.icon}</svg>
            <span>${item.label}</span>
        `;
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            item.action();
            closeCapsule();
        });
        return btn;
    };

    const createOrb = () => {
        if (container) return;

        container = document.createElement('div');
        container.id = 'st-floating-ball-container';
        container.classList.add('expand-left');

        ball = document.createElement('div');
        ball.id = 'st-floating-ball';
        ball.title = 'Smart Translator Companion';
        ball.innerHTML = `
            <svg class="st-orb-progress" viewBox="0 0 44 44">
                <circle cx="22" cy="22" r="20" fill="none" stroke="var(--accent)"
                    stroke-width="2.5" stroke-dasharray="125.6" stroke-dashoffset="125.6"
                    stroke-linecap="round" transform="rotate(-90 22 22)"/>
            </svg>
            <svg class="st-orb-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"></path>
                <line x1="16" y1="8" x2="2" y2="22"></line>
                <line x1="17.5" y1="15" x2="9" y2="15"></line>
            </svg>
        `;

        capsule = document.createElement('div');
        capsule.className = 'st-capsule';

        handle = document.createElement('div');
        handle.className = 'st-capsule-handle';
        handle.title = '拖拽移动';
        handle.innerHTML = `
            <svg width="6" height="14" viewBox="0 0 6 14" fill="none" aria-hidden="true">
                <circle cx="1.5" cy="2" r="1.2" fill="currentColor"></circle>
                <circle cx="4.5" cy="2" r="1.2" fill="currentColor"></circle>
                <circle cx="1.5" cy="7" r="1.2" fill="currentColor"></circle>
                <circle cx="4.5" cy="7" r="1.2" fill="currentColor"></circle>
                <circle cx="1.5" cy="12" r="1.2" fill="currentColor"></circle>
                <circle cx="4.5" cy="12" r="1.2" fill="currentColor"></circle>
            </svg>
        `;
        capsule.appendChild(handle);
        menuData.forEach((item) => capsule.appendChild(createCapsuleButton(item)));

        container.appendChild(ball);
        container.appendChild(capsule);
        document.body.appendChild(container);

        loadPosition();

        handle.addEventListener('mousedown', onMouseDown);
        ball.addEventListener('click', (e) => {
            if (isDragging) return;
            e.stopPropagation();
            if (capsuleOpen) {
                closeCapsule();
            } else {
                openCapsule();
            }
        });

        container.addEventListener('mouseleave', () => {
            if (!capsuleOpen || isDragging) return;
            clearCloseTimer();
            closeTimer = setTimeout(() => {
                closeCapsule();
            }, 300);
        });

        container.addEventListener('mouseenter', () => {
            clearCloseTimer();
        });

        window.addEventListener('resize', () => {
            if (!container) return;
            const currentTop = parseInt(container.style.top, 10) || window.innerHeight * 0.8;
            const isRight = container.style.right === '0px';
            dockToEdge(currentTop, isRight);
        });
    };

    const loadPosition = async () => {
        try {
            const result = await chrome.storage.local.get(STORAGE_KEY);
            if (result[STORAGE_KEY]) {
                const { top } = result[STORAGE_KEY];
                dockToEdge(top, result[STORAGE_KEY].isRight);
            } else {
                dockToEdge(window.innerHeight * 0.8, true);
            }
        } catch (e) {
            dockToEdge(window.innerHeight * 0.8, true);
        }
    };

    const dockToEdge = (y, isRight) => {
        const safeY = Math.max(50, Math.min(y, window.innerHeight - 50));

        container.style.top = `${safeY}px`;
        if (isRight) {
            container.style.right = '0px';
            container.style.left = 'auto';
        } else {
            container.style.left = '0px';
            container.style.right = 'auto';
        }
        updateCapsuleDirection();
    };

    const onMouseDown = (e) => {
        if (e.button !== 0) return;
        isDragging = false;
        dragStartTime = Date.now();
        clearCloseTimer();

        const rect = handle.getBoundingClientRect();
        dragOffset = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        };

        container.style.transition = 'none';

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        e.preventDefault();
    };

    const onMouseMove = (e) => {
        isDragging = true;

        const clientX = e.clientX;
        const clientY = e.clientY;
        let newLeft = clientX - dragOffset.x;
        let newTop = clientY - dragOffset.y;

        container.style.left = `${newLeft}px`;
        container.style.top = `${newTop}px`;
        container.style.right = 'auto';
    };

    const onMouseUp = (e) => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);

        container.style.transition = 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';

        if (!isDragging || (Date.now() - dragStartTime < 200)) {
            isDragging = false;
            return;
        }

        const winWidth = window.innerWidth;
        const centerX = e.clientX;
        const isRight = centerX > winWidth / 2;

        dockToEdge(e.clientY, isRight);

        chrome.storage.local.set({
            [STORAGE_KEY]: {
                top: e.clientY,
                isRight,
            },
        });

        isDragging = false;
    };

    const syncVisibility = (showFloatingBall) => {
        if (showFloatingBall === true) {
            if (!container) {
                createOrb();
            } else {
                container.style.display = 'flex';
                updateCapsuleDirection();
            }
            return;
        }

        if (container) {
            closeCapsule();
            container.style.display = 'none';
        }
    };

    const init = () => {
        if (initialized) {
            syncVisibility(ST.state.settings?.showFloatingBall);
            return;
        }

        initialized = true;
        const settings = ST.state.settings || {};

        syncVisibility(settings.showFloatingBall);

        chrome.storage.onChanged.addListener((changes) => {
            if (changes.settings?.newValue) {
                const show = changes.settings.newValue.showFloatingBall;
                syncVisibility(show);
            }
        });
    };

    window.ST = window.ST || {};
    ST.floatingBall = { init };
})();
