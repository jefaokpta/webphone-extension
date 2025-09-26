// ua-worker.js - MV3 service worker
// Ensures a persistent offscreen document exists to host the JsSIP UA and play audio.

async function ensureOffscreenDocument() {
    // If already exists, do nothing
    if (chrome.offscreen && chrome.offscreen.hasDocument) {
        const hasDoc = await chrome.offscreen.hasDocument?.();
        if (hasDoc) return;
    }
    try {
        await chrome.offscreen.createDocument({
            url: 'offscreen.html',
            reasons: ['AUDIO_PLAYBACK'],
            justification: 'Reproduzir áudio remoto do WebPhone (SIP) enquanto o popup está fechado.'
        });
        console.log('[SW] Offscreen document criado.');
    } catch (e) {
        console.warn('[SW] Falha ao criar offscreen document (pode já existir):', e?.message || e);
    }
}

// Ensure offscreen on startup/installation
chrome.runtime.onInstalled.addListener(() => {
    ensureOffscreenDocument();
});
chrome.runtime.onStartup?.addListener(() => {
    ensureOffscreenDocument();
});


