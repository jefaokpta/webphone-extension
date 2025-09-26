// popup.js
// Envia comandos de discagem/encerramento para o service worker

const phoneInput = document.querySelector('.input');
const callBtn = document.getElementById('callBtn');
const hangupBtn = document.getElementById('hangupBtn');

function logger(msg) {
    console.log(`[POPUP] ${new Date()} `, msg)
}

callBtn.addEventListener('click', async () => {
    const number = (phoneInput.value || '').trim();
    if (!number) {
        // avisar na div status
        return;
    }
    try {
        logger(`Discando para ${number}`)
        await chrome.runtime.sendMessage({type: 'dial', phoneNumber: number});
    } catch (e) {
        logger(`Falha ao enviar comando de discagem: ${e}`)
    }
});

hangupBtn.addEventListener('click', async () => {
    try {
        await chrome.runtime.sendMessage({type: 'hangup'});
    } catch (e) {
        logger(`Falha ao enviar comando de desligar: ${e}`)
    }
});

