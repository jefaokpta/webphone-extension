const BACKEND_URL = credentials.pabxUrl;

let ua = null;           // JsSIP.UA
let session = null;      // Current JsSIP.RTCSession

function logger(msg) {
    console.log(`[OFFSCREEN] ${new Date().toLocaleString()} `, msg)
}

function startUA() {
    const socket = new JsSIP.WebSocketInterface(`wss://${credentials.domain}:${credentials.port}/ws`);
    const configuration = {
        sockets: [socket],
        uri: `sip:${credentials.username}@${credentials.domain}`,
        password: credentials.password,
        register: true,
    };
    ua = new JsSIP.UA(configuration);

    ua.on('connected', () => logger('Socket conectado (WSS).'));
    ua.on('disconnected', () => logger('Socket desconectado.'));
    ua.on('registered', () => logger('Registrado no servidor SIP.'));
    ua.on('unregistered', () => logger('Não registrado.'));
    ua.on('registrationFailed', (e) => logger('Falha no registro: ' + (e?.cause || 'desconhecida')));

    ua.on('newRTCSession', (ev) => {
        session = ev.session;
        logger(`Nova sessão ${ev.originator}`);

        // Attach remote audio for both outgoing and incoming
        tryAttachAudio(session);

        session.on('ended', () => {
            logger('Sessão finalizada.');
            session = null;
        });
        session.on('failed', (e) => {
            logger('Sessão falhou:', e?.cause);
            session = null;
        });
        session.on('accepted', () => logger('Sessão aceita.'));
        session.on('confirmed', () => logger('Sessão confirmada.'));
    });

    ua.start();
}

startUA();

function tryAttachAudio(session) {
    const audioEl = document.getElementById('remoteAudio');
    if (!audioEl) return;
    // In newer browsers, 'track' is used; JsSIP still fires 'addstream' for compat
    const conn = session.connection;
    if (!conn) return;

    const attach = (stream) => {
        logger('Anexando stream remoto ao <audio>');
        try {
            audioEl.srcObject = stream;
            // Ensure autoplay without user gesture in extension context
            audioEl.muted = false;
            audioEl.play().catch(err => logger(`Falha ao reproduzir áudio remoto: ${err?.message || err}`));
        } catch (e) {
            logger(`Erro ao anexar áudio: ${e.message}`);
        }
    };

    // Legacy event
    conn.addEventListener('addstream', (ev) => {
        logger('Evento addstream');
        attach(ev.stream);
    });
    // Modern event
    conn.addEventListener('track', (ev) => {
        if (ev.streams && ev.streams[0]) {
            logger('Evento track');
            attach(ev.streams[0]);
        }
    });
}

async function getCallToken(token) {
    try {
        const response = await fetch(`${BACKEND_URL}/auth/call-token`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        const data = await response.json();
        return data.token;
    } catch (error) {
        logger(`Erro ao obter o token: ${error?.message || error}`);
        return undefined;
    }
}

chrome.runtime.onMessage.addListener((message) => {
    logger(`Mensagem recebida: ${JSON.stringify(message)}`);

})

function keepAlive() {
    setInterval(() => {
        logger('Mantendo conexão ativa');
    }, 10000);
}

keepAlive();