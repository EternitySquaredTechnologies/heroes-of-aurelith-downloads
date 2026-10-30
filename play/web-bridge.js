'use strict';
// The browser's stand-in for preload.cjs. It gives the page the same window.coe the desktop shell gives, but talks to
// the auth service and game server straight from the page. Only the web build loads this file.
//
// Tokens live in this closure and nowhere else: not in window, not in storage. github.io shares one origin across every
// repo of the account, so anything written to localStorage here could be read by another page on it.
(() => {
  const SAFE_IMAGE = /^[a-z0-9_-]+(\/[a-z0-9_.-]+)*\.png$/i;

  const progress = new Set();
  const gameListeners = new Set();
  const closedListeners = new Set();
  const subscribe = (set) => (cb) => {
    set.add(cb);
    return () => set.delete(cb);
  };

  let config = null;
  let bundle = null;
  let session = null;
  let socket = null;
  let keepalive = null;

  const fail = (code, status = 0, retryAfterSec) => Object.assign(new Error(code), { code, status, retryAfterSec });
  const failure = (err) => ({ ok: false, error: err.code || 'unknown_error', ...(err.retryAfterSec ? { retryAfterSec: err.retryAfterSec } : {}) });

  async function getJson(url) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw fail('download_failed', res.status);
    return res.json();
  }

  async function post(path, body) {
    let res;
    try {
      res = await fetch(new URL(path, config.authUrl), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch {
      throw fail('network');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const retry = Number(res.headers.get('retry-after'));
      throw fail(data.error || 'unknown_error', res.status, Number.isFinite(retry) && retry > 0 ? retry : undefined);
    }
    return data;
  }

  async function tokens(path, body) {
    const t = await post(path, body);
    if (typeof t.accessToken !== 'string' || typeof t.refreshToken !== 'string' || !t.account) throw fail('bad_response', 502);
    return t;
  }

  async function signedIn(promise) {
    try {
      session = await promise;
      return { ok: true, username: session.account.username, recoveryKey: session.recoveryKey };
    } catch (err) {
      return failure(err);
    }
  }

  const recoveryKey = async (path, body) => {
    try {
      const data = await post(path, body);
      if (typeof data.recoveryKey !== 'string') throw fail('bad_response', 502);
      return { ok: true, recoveryKey: data.recoveryKey };
    } catch (err) {
      return failure(err);
    }
  };

  const isString = (v, max) => typeof v === 'string' && v.length > 0 && v.length <= max;

  function stopGame() {
    if (keepalive) keepalive.terminate();
    keepalive = null;
    const ws = socket;
    socket = null;
    if (ws) {
      ws.onclose = null;
      ws.close(1000);
    }
  }

  function connect(token, timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(config.server);
      socket = ws;
      let settled = false;
      let lastError = null;
      const timer = setTimeout(() => {
        lastError = 'timeout';
        ws.close();
      }, timeoutMs);

      ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', token, protocol: bundle.protocol }));
      ws.onmessage = (ev) => {
        let msg;
        try {
          msg = JSON.parse(String(ev.data));
        } catch {
          return;
        }
        if (typeof msg !== 'object' || msg === null || typeof msg.t !== 'string') return;
        if (msg.t === 'error') lastError = msg.code;
        if (!settled) {
          if (msg.t === 'welcome') {
            settled = true;
            clearTimeout(timer);
            resolve(msg);
          }
          return;
        }
        gameListeners.forEach((cb) => cb(msg));
      };
      ws.onclose = (ev) => {
        clearTimeout(timer);
        if (!settled) {
          settled = true;
          reject(new Error(lastError || 'connection_failed'));
          return;
        }
        if (socket === ws) socket = null;
        if (keepalive) keepalive.terminate();
        keepalive = null;
        closedListeners.forEach((cb) => cb({ code: ev.code, reason: ev.reason, error: lastError }));
      };
      ws.onerror = () => {};
    });
  }

  /** A hidden tab slows the page's own timers to once a minute, past the server's 45 second idle limit. A worker is not slowed. */
  function startKeepalive() {
    try {
      keepalive = new Worker('web-keepalive.js');
      keepalive.onmessage = () => {
        if (socket && socket.readyState === WebSocket.OPEN) socket.send('{"t":"ping","n":0}');
      };
    } catch {
      keepalive = null;
    }
  }

  window.coe = {
    async patch() {
      try {
        config = await getJson('config.json');
        bundle = await getJson('game-data.json');
        if (typeof config.authUrl !== 'string' || typeof config.server !== 'string') throw fail('manifest_invalid');
        progress.forEach((cb) => cb({ phase: 'done', bytesDone: 1, bytesTotal: 1, current: '' }));
        return { ok: true, version: bundle.version, downloaded: 0 };
      } catch (err) {
        return { ok: false, error: err.code === 'manifest_invalid' ? 'manifest_invalid' : 'manifest_fetch' };
      }
    },
    onPatchProgress: subscribe(progress),
    // Nothing is kept between visits, so there is never a session to resume.
    resume: async () => ({ ok: false, error: 'no_session' }),
    login: (username, password) => {
      if (!isString(username, 32) || !isString(password, 128)) return Promise.resolve({ ok: false, error: 'invalid_request' });
      return signedIn(tokens('/login', { username, password }));
    },
    register: (username, password, _remember, age, gender) => {
      if (!isString(username, 32) || !isString(password, 128)) return Promise.resolve({ ok: false, error: 'invalid_request' });
      return signedIn(tokens('/register', { username, password, ageConfirmed: age === true, gender: gender === 'f' ? 'f' : gender === 'm' ? 'm' : '' }));
    },
    resetPassword: (username, code, password) => {
      if (!isString(username, 32) || !isString(code, 32) || !isString(password, 128)) return Promise.resolve({ ok: false, error: 'invalid_request' });
      return recoveryKey('/password-reset', { username, code, password });
    },
    newRecoveryKey: (username, password) => {
      if (!isString(username, 32) || !isString(password, 128)) return Promise.resolve({ ok: false, error: 'invalid_request' });
      return recoveryKey('/recovery-key', { username, password });
    },
    // Google sign-in needs a loopback listener, which only the desktop shell has. The page checks for these and says so.
    async logout() {
      stopGame();
      const token = session && session.refreshToken;
      session = null;
      if (token) await post('/logout', { refreshToken: token }).catch(() => {});
      return { ok: true };
    },
    info: async () => ({ version: 'web', server: config ? config.server : null }),

    async play() {
      if (!session) return { ok: false, error: 'not_signed_in' };
      stopGame();
      try {
        // Access tokens last 15 minutes, so take a fresh one for every join.
        session = await tokens('/refresh', { refreshToken: session.refreshToken });
        const welcome = await connect(session.accessToken);
        startKeepalive();
        const map = await getJson(`content/maps/${String(welcome.map).replace(/[^a-z0-9_-]/gi, '')}.json`);
        return { ok: true, welcome, map };
      } catch (err) {
        stopGame();
        if (err.status === 401) return { ok: false, error: 'session_expired' };
        return { ok: false, error: err.code || err.message || 'unknown_error' };
      }
    },
    send(message) {
      if (typeof message !== 'object' || message === null || Array.isArray(message)) return;
      if (typeof message.t !== 'string' || message.t === 'hello') return;
      if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
    },
    leave: stopGame,
    onGameMessage: subscribe(gameListeners),
    onGameClosed: subscribe(closedListeners),
    async readImage(path) {
      return isString(path, 256) && SAFE_IMAGE.test(path) && !path.includes('..') ? `content/${path}` : null;
    },
    data: async () => (bundle ? bundle.data : null),
  };
})();
