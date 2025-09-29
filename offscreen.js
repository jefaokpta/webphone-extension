
let ua = null;           // JsSIP.UA
let session = null;      // Current JsSIP.RTCSession
const isRegister = false;
let token = null;
let credential = null;

function logger(msg) {
    console.log(`[OFFSCREEN] ${new Date().toLocaleString()} `, msg)
    chrome.runtime.sendMessage({type: 'status', message: msg}).catch(() => {
    });
}

function startUA() {
    logger('Iniciando JsSIP... Registrar: ' + isRegister)
    const socket = new JsSIP.WebSocketInterface(`wss://${credential.domain}:${credential.port}/ws`);
    const configuration = {
        sockets: [socket],
        uri: `sip:${credential.peer}@${credential.domain}`,
        password: credential.password,
        register: isRegister,
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
        if (ev.originator === 'local') {
            tryAttachAudio(session);
        } else {
            session.on('peerconnection', () => {
                tryAttachAudio(session)
            })
        }

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

startByJwt()

//TODO: ativar heartbeat/register caso esteja configurado pra receber chamadas
// Heartbeat: envia ping periódico para manter o SW ativo e permitir recriação do offscreen se cair
if (isRegister) {
    const HEARTBEAT_INTERVAL_MS = 20000; // 20s
    setInterval(() => {
        chrome.runtime.sendMessage({type: 'heartbeat', ts: Date.now()}).catch(() => {
        });
    }, HEARTBEAT_INTERVAL_MS);
}

async function dial(phoneNumber) {
    logger('Autenticando...')
    const callToken = await getCallToken();
    const sipCall = `sip:${phoneNumber}@${credential.domain}`;
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
    const audioEl = new Audio();
    // In newer browsers, 'track' is used; JsSIP still fires 'addstream' for compat
    const conn = session.connection;

    const attach = (stream) => {
        logger('Anexando stream remoto ao <audio>');
        audioEl.srcObject = stream;
        // Ensure autoplay without user gesture in extension context
        audioEl.muted = false;
        audioEl.play().catch(err => logger(`Falha ao reproduzir áudio remoto: ${err?.message || err}`));
    };

    // Legacy event
    conn.addEventListener('addstream', (ev) => {
        attach(ev.stream);
        logger('audio conectado')
    });
    // Modern event
    // conn.addEventListener('track', (ev) => {
    //     if (ev?.streams[0]) {
    //         logger('Evento track (modern) ' + ev.streams[0].id);
    //         attach(ev.streams[0]);
    //     }
    // });
}

async function getCallToken() {
    try {
        const response = await fetch(`${credential.backendUrl}/auth/call-token`, {
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

function startByJwt() {
    chrome.runtime.sendMessage({type: "jwt"})
}

function extractJwt(token) {
    const parts = token.split('.');
    if (parts.length !== 3) {
        throw new Error('JWT token inválido');
    }
    return JSON.parse(atob(parts[1]));
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
        case 'jwt-response':
            token = message.jwt;
            credential = extractJwt(token);
            startUA();
            break;
        default:
            logger(`Mensagem desconhecida: ${JSON.stringify(message)}`);
    }
})