// ua-worker.js - MV3 service worker
// Ensures a persistent offscreen document exists to host the JsSIP UA and play audio.

function logger(msg) {
    console.log(`[SW] ${new Date().toLocaleString()} `, msg)
}
async function ensureOffscreenDocument() {
    // If already exists, do nothing
    if (chrome.offscreen?.hasDocument) {
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

chrome.runtime.onMessage.addListener(async (message) => {
    // toda vez q popup abre e envia a mensagem 'wakeup' para o service worker criar o offscreen document e ficar pronto para receber comandos
    await ensureOffscreenDocument();
    armHeartbeat();
    if (message.type === 'wakeup') logger(`Recebida: ${JSON.stringify(message)}`);
    if (message.type === 'heartbeat') logger(`Recebida: ${JSON.stringify(message)}`);
})

// Heartbeat watchdog: se não receber ping do offscreen por X segundos, recria o offscreen.
const HEARTBEAT_TTL_MS = 20000; // 30s
let heartbeatTimer = null;

function armHeartbeat() {
    if (heartbeatTimer) clearTimeout(heartbeatTimer);
    heartbeatTimer = setTimeout(async () => {
        logger('Heartbeat perdido. Tentando recriar offscreen...');
        await ensureOffscreenDocument();
        // Rearma para o próximo ciclo
        armHeartbeat();
    }, HEARTBEAT_TTL_MS + 2000); // pequena margem
}

