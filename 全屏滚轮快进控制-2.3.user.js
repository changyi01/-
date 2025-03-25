// ==UserScript==
// @name         全屏滚轮快进控制
// @namespace    http://tampermonkey.net/
// @version      2.3
// @description  支持任意秒数设置+全屏状态检测+爱奇艺适配
// @author       QuiXoticer
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // 智能视频检测
    const findVideoElement = () => {
        let targetVideo = null;
        const deepSearch = (root) => {
            const videos = root.querySelectorAll('video');
            for (const v of videos) {
                if (v.offsetWidth > 100 && v.offsetHeight > 50) {
                    targetVideo = v;
                    return true;
                }
            }
            const iframes = root.querySelectorAll('iframe');
            for (const iframe of iframes) {
                try {
                    const doc = iframe.contentDocument || iframe.contentWindow.document;
                    if (deepSearch(doc)) return true;
                } catch {}
            }
            const shadows = root.querySelectorAll('*');
            for (const node of shadows) {
                if (node.shadowRoot && deepSearch(node.shadowRoot)) return true;
            }
            return false;
        };
        deepSearch(document);
        return targetVideo;
    };

    // 动态等待视频加载
    const waitForVideo = () => {
        return new Promise(resolve => {
            const observer = new MutationObserver(() => {
                const video = findVideoElement();
                if (video) {
                    observer.disconnect();
                    resolve(video);
                }
            });
            observer.observe(document, { childList: true, subtree: true, attributes: true });
            if (findVideoElement()) resolve(findVideoElement());
        });
    };

    // 主逻辑
    waitForVideo().then(video => initController(video));

    function initController(video) {
        // 创建控制面板
        const panel = document.createElement('div');
        panel.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 6px;">
                <label style="display: flex; align-items: center; justify-content: space-between; gap: 6px;">
                    <span style="white-space: nowrap;">快进退秒数：</span>
                    <input type="number" id="seek-seconds"
                        style="width: 90px; padding: 2px 4px; border: 1px solid #666; border-radius: 3px; background: rgba(255,255,255,0.1); color: #fff;"
                        min="0" step="any">
                </label>
            </div>
        `;

        // 面板样式
        Object.assign(panel.style, {
            position: 'fixed',
            right: '0',
            top: '50%',
            transform: 'translateY(-50%) translateX(calc(-100% + 30px))',
            background: 'rgba(0, 0, 0, 0.9)',
            color: '#fff',
            padding: '8px 12px',
            borderRadius: '6px 0 0 6px',
            zIndex: '2147483647',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
            transition: 'transform 0.2s ease, opacity 0.3s ease',
            cursor: 'default',
            pointerEvents: 'auto',
            fontSize: '13px',
            minWidth: '140px',
            opacity: '1'
        });
        document.body.appendChild(panel);
        const seekSecondsInput = panel.querySelector('#seek-seconds');

        // 爱奇艺全屏检测增强
        const isIQIYIFullscreen = () => {
            const checkIQIYI = (root) => {
                if (root.classList?.contains('iqp-player-fullscreen')) return true;
                if (root.shadowRoot) return checkIQIYI(root.shadowRoot);
                return Array.from(root.children).some(child => checkIQIYI(child));
            };
            return checkIQIYI(document.body);
        };

        // 全屏状态检测
        const updatePanelState = () => {
            const isFullscreen =
                document.fullscreenElement ||
                document.webkitFullscreenElement ||
                isIQIYIFullscreen();

            panel.style.opacity = isFullscreen ? '0' : '1';
            panel.style.pointerEvents = isFullscreen ? 'none' : 'auto';
        };

        // 全屏事件监听
        ['fullscreenchange', 'webkitfullscreenchange'].forEach(event => {
            document.addEventListener(event, updatePanelState);
        });
        new MutationObserver(updatePanelState).observe(document.body, {
            subtree: true,
            attributes: true,
            attributeFilter: ['class']
        });

        // 高精度输入处理
        const savedValue = localStorage.getItem('wheelSeekSeconds');
        seekSecondsInput.value = savedValue ? savedValue.replace(/^0+(?=\d)/, '') : '5';
        let seekSeconds = parseFloat(savedValue) || 5;
        seekSeconds = Math.max(0.1, seekSeconds);

        seekSecondsInput.addEventListener('input', function() {
            let inputValue = this.value
                .replace(/[^0-9.]/g, '')
                .replace(/(\..*)\./g, '$1')
                .replace(/^0+(\d)/, '$1')
                .replace(/^\./, '0.')
                .replace(/^0+(\.\d+)?$/, '0$1');

            let value = parseFloat(inputValue) || 0;
            value = Math.max(0, value);

            if (value === 0) {
                inputValue = '0.1';
                value = 0.1;
            }

            seekSeconds = value;
            this.value = inputValue.includes('.') ?
                inputValue.replace(/\.?0+$/, '') :
                inputValue;
            localStorage.setItem('wheelSeekSeconds', inputValue);
        });

        // 滚轮控制逻辑
        const handleWheelControl = (event) => {
            if (panel.matches(':hover')) return;
            const delta = event.deltaY > 0 ? seekSeconds : -seekSeconds;
            video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + delta));
            event.preventDefault();
            event.stopImmediatePropagation();
        };

        // 事件监听
        const eventOptions = { passive: false, capture: true };
        document.addEventListener('wheel', handleWheelControl, eventOptions);
        video.addEventListener('wheel', handleWheelControl, eventOptions);

        // 面板交互效果
        let panelTimeout;
        panel.addEventListener('mouseenter', () => {
            clearTimeout(panelTimeout);
            panel.style.transform = 'translateY(-50%) translateX(0)';
        });
        panel.addEventListener('mouseleave', () => {
            panelTimeout = setTimeout(() => {
                panel.style.transform = 'translateY(-50%) translateX(calc(-100% + 30px))';
            }, 200);
        });

        // 防御样式
        panel.querySelectorAll('*').forEach(el => {
            el.style.cssText += '; all: unset !important; box-sizing: border-box !important;';
        });
    }
})();