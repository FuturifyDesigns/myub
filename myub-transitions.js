/**
 * MyUB — page transitions disabled.
 * Keeps myub-enhanced class and clears any leftover overlay from older builds.
 */
(function () {
    'use strict';

    try {
        document.documentElement.classList.add('myub-enhanced');
    } catch (_) {}

    function destroyOverlay() {
        try {
            document.documentElement.classList.remove('myub-pt-running');
        } catch (_) {}
        try {
            document.querySelectorAll('#myubPageTransition, .myub-pt').forEach(function (node) {
                if (node && node.parentNode) node.parentNode.removeChild(node);
            });
        } catch (_) {}
        try {
            sessionStorage.removeItem('myub_pt');
            sessionStorage.removeItem('myub_from_transition');
        } catch (_) {}
    }

    destroyOverlay();

    // No-op navigate helper (in case anything still calls it)
    window.myubNavigate = function (url) {
        if (url) location.href = url;
    };
    window.myubDestroyPageTransition = destroyOverlay;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', destroyOverlay);
    }
    window.addEventListener('load', destroyOverlay);
})();
