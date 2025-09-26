// popup.js
// Envia comandos de discagem/encerramento para o service worker

const phoneInput = document.querySelector('.input');
const callBtn = document.getElementById('callBtn');
const hangupBtn = document.getElementById('hangupBtn');
const answerBtn = document.getElementById('answerBtn');
const statusDiv = document.getElementById('status');

function logger(msg) {
    console.log(`[POPUP] ${new Date()} `, msg)
    statusDiv.textContent = msg;
}

document.addEventListener("DOMContentLoaded", checkMicrophonePermission);

async function checkMicrophonePermission() {
    try {
        await navigator.mediaDevices.getUserMedia({audio: true});
        chrome.runtime.sendMessage({type: 'wakeup'});
    } catch () {
        chrome.tabs.create({url: "permission.html"});
    }
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
        logger(`Falha ao enviar comando de discagem: ${e?.message || e}`)
    }
});

hangupBtn.addEventListener('click', async () => {
    try {
        await chrome.runtime.sendMessage({type: 'hangup'});
    } catch (e) {
        logger(`Falha ao enviar comando de desligar: ${e?.message || e}`)
    }
});

answerBtn.addEventListener('click', async () => {
    try {
        await chrome.runtime.sendMessage({type: 'answer'});
    } catch (e) {
        logger(`Falha ao enviar comando de atender: ${e?.message || e}`)
    }
});

chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'status') logger(message.message);
});



