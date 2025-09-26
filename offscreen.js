const BACKEND_URL = credentials.pabxUrl;

let ua = null;           // JsSIP.UA
let session = null;      // Current JsSIP.RTCSession

function logger(msg) {
    console.log(`[OFFSCREEN] ${new Date().toLocaleString()} `, msg)
    chrome.runtime.sendMessage({type: 'status', message: msg}).catch(() => {
    });
}

async function startUA() {
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
            logger('Sessão falhou: ' + (e?.cause || 'desconhecida'));
            session = null;
        });
        session.on('accepted', () => logger('Sessão aceita.'));
        session.on('confirmed', () => logger('Sessão confirmada.'));
    });

    ua.start();
}

startUA();

async function dial(phoneNumber) {
    logger('Autenticando...')
    const callToken = await getCallToken(credentials.token);
    const sipCall = `sip:${phoneNumber}@${credentials.domain}`;
    logger(`Chamando ${sipCall}`);
    const options = {
        mediaConstraints: {audio: true, video: false},
        extraHeaders: callToken ? ['X-CALL-TOKEN: ' + callToken] : []
    };
    try {
        ua.call(sipCall, options);
    } catch (e) {
        logger(`Erro ao iniciar chamada: ${e?.message || e}`);
    }
}

function hangup() {
    if (!session) {
        logger('Nenhuma sessão ativa para finalizar chamada.');
        return;
    }
    try {
        session.terminate();
    } catch (e) {
        logger(`Erro ao finalizar chamada: ${e?.message || e}`);
    }
}

function answer() {
    if (!session) {
        logger('Nenhuma sessão ativa para atender chamada.');
        return;
    }
    try {
        session.answer();
    } catch (e) {
        logger(`Erro ao atender chamada: ${e?.message || e}`);
    }
}

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
        if (ev?.streams[0]) {
            logger('Evento track (modern) ' + ev.streams[0].id);
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

chrome.runtime.onMessage.addListener(async (message) => {
    switch (message.type) {
        case 'dial':
            dial(message.phoneNumber);
            break;
        case 'answer':
            answer();
            break;
        case 'hangup':
            hangup();
            break;
        case 'wakeup':
            break;
        default:
            logger(`Mensagem desconhecida: ${JSON.stringify(message)}`);
    }
})