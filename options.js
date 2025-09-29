// options.js
// Salva e carrega o token JWT usando chrome.storage.sync

const jwtEl = document.getElementById('jwt');
const saveBtn = document.getElementById('saveBtn');
const clearBtn = document.getElementById('clearBtn');
const statusEl = document.getElementById('status');
const incomingToggle = document.getElementById('incomingCalls');

function showStatus(text, isError = false) {
    statusEl.textContent = text;
    statusEl.classList.toggle('text-danger', isError);
    statusEl.classList.toggle('text-success', !isError);
    if (text) setTimeout(() => (statusEl.textContent = ''), 2500);
}

async function loadSettings() {
    try {
        const {jwt, incomingCalls} = await chrome.storage.sync.get(['jwt', 'incomingCalls']);
        if (jwt) jwtEl.value = jwt;
        incomingToggle.checked = Boolean(incomingCalls);
    } catch (e) {
        console.warn('Falha ao carregar configurações do storage:', e);
    }
}

async function saveJwt() {
    const value = (jwtEl.value || '').trim();
    try {
        await chrome.storage.sync.set({jwt: value, incomingCalls: incomingToggle.checked});
        showStatus('Opções salvas!');
    } catch (e) {
        showStatus('Erro ao salvar', true);
    }
}

async function clearJwt() {
    try {
        await chrome.storage.sync.remove(['jwt']);
        jwtEl.value = '';
        showStatus('Limpado');
    } catch (e) {
        showStatus('Erro ao limpar', true);
    }
}

saveBtn.addEventListener('click', saveJwt);
clearBtn.addEventListener('click', clearJwt);

document.addEventListener('DOMContentLoaded', loadSettings);
