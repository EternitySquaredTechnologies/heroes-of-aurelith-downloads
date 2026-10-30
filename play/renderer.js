'use strict';

const $ = (id) => document.getElementById(id);
const show = (id) => {
  for (const s of ['patch', 'login', 'recovery', 'home', 'gameview']) $(s).classList.toggle('hidden', s !== id);
  document.querySelector('.frame').classList.toggle('hidden', id === 'gameview');
};

const PLAY_ERRORS = {
  connection_failed: 'Could not reach the game server. Is it running?',
  timeout: 'The game server took too long to answer.',
  bad_token: 'The server did not accept your login. Sign out and in again.',
  patch_required: 'Your game is out of date. Restart the launcher to update.',
  server_full: 'The world is full. Try again in a moment.',
  session_expired: 'Your session expired. Sign in again.',
  not_signed_in: 'Sign in first.',
  network: 'Could not reach the login server.',
};

const CLOSE_REASONS = {
  replaced: 'You signed in from somewhere else.',
  rate_limited: 'You were disconnected for sending too much.',
  bad_message: 'You were disconnected after a bad message.',
};

const PATCH_ERRORS = {
  manifest_fetch: 'Could not reach the patch server. Check your connection and try again.',
  manifest_invalid: 'The patch server sent data this version cannot read.',
  manifest_signature: 'The update could not be verified, so it was not installed.',
  unsafe_path: 'The update contained an unsafe file and was rejected.',
  download_failed: 'A download failed. Try again.',
  hash_mismatch: 'A downloaded file was damaged and was rejected. Try again.',
  shell_update_required: 'A new version of the launcher is required. Please download the latest installer.',
  missing_public_key: 'This build is missing its signing key. Reinstall the game.',
};

const AUTH_ERRORS = {
  invalid_credentials: 'Wrong username or password.',
  username_taken: 'That username is taken.',
  too_many_attempts: 'Too many attempts. Wait a moment and try again.',
  registration_closed: 'New accounts are closed for now.',
  invalid_request: 'Check your username and password.',
  invalid_reset_code: 'That reset code is wrong or has expired.',
  google_failed: 'Google sign-in did not work. Try again.',
  google_timeout: 'Google sign-in took too long. Try again.',
  google_disabled: 'Google sign-in is not available right now.',
  google_not_linked: 'No account is linked to that Google account.',
  google_in_use: 'That Google account is already linked to another player.',
  network: 'Could not reach the login server.',
};

let mode = 'login';

// Mirrors the server's sign-up rules (packages/shared/src/auth.ts). The server has the final say.
const RESERVED = ['admin', 'administrator', 'moderator', 'mod', 'gm', 'staff', 'support', 'system', 'server', 'owner', 'eternity', 'official', 'root', 'null', 'undefined'];
const COMMON = ['password', 'password1', 'password12', 'password123', 'passw0rd123', '1234567890', '12345678910', 'qwertyuiop', 'qwerty12345', 'iloveyou123', 'letmein1234', 'welcome1234', 'admin12345', 'abc1234567', '0123456789', '9876543210'];

function usernameProblem(name) {
  if (!/^[A-Za-z][A-Za-z0-9]{2,11}$/.test(name)) return 'Username must be 3 to 12 letters and numbers, start with a letter, with no spaces or symbols.';
  if (RESERVED.includes(name.toLowerCase())) return 'That username is reserved.';
  return null;
}

function passwordProblem(pw, name) {
  if (pw.length < 10) return 'Password must be at least 10 characters.';
  if (pw.length > 128) return 'Password must be at most 128 characters.';
  if (pw.length < 16 && !(/[A-Za-z]/.test(pw) && /[0-9]/.test(pw))) return 'Use letters and numbers, or make the password 16 or more characters.';
  if (COMMON.includes(pw.toLowerCase())) return 'That password is too common.';
  if (/^(.)\1+$/.test(pw)) return 'A password cannot be one repeated character.';
  if (name.length >= 3 && pw.toLowerCase().includes(name.toLowerCase())) return 'The password cannot contain your username.';
  return null;
}

function updateHints() {
  const box = $('auth-hints');
  box.classList.toggle('hidden', mode !== 'register');
  if (mode !== 'register') return;
  const name = $('username').value.trim();
  const pw = $('password').value;
  const mark = (id, text, problem) => {
    $(id).classList.toggle('ok', Boolean(text) && !problem);
    $(id).classList.toggle('bad', Boolean(text) && Boolean(problem));
  };
  mark('hint-user', name, usernameProblem(name));
  mark('hint-pass', pw, passwordProblem(pw, name));
}

function setMode(next) {
  mode = next;
  $('tab-login').setAttribute('aria-selected', String(next === 'login'));
  $('tab-register').setAttribute('aria-selected', String(next === 'register'));
  $('submit').textContent = next === 'login' ? 'Sign in' : 'Create account';
  $('password').setAttribute('autocomplete', next === 'login' ? 'current-password' : 'new-password');
  $('auth-error').textContent = '';
  $('age-row').classList.toggle('hidden', next === 'login');
  $('gender-row').classList.toggle('hidden', next === 'login');
  $('forgot').classList.toggle('hidden', next === 'register');
  $('username').maxLength = next === 'register' ? 12 : 32;
  updateHints();
}

function authMessage(result) {
  if (result.error === 'too_many_attempts' && result.retryAfterSec) {
    return `Too many attempts. Try again in ${result.retryAfterSec} seconds.`;
  }
  return AUTH_ERRORS[result.error] || 'Something went wrong. Try again.';
}

let currentUser = '';

function enterHome(username) {
  currentUser = username;
  $('welcome').textContent = `Welcome, ${username}.`;
  show('home');
}

async function runPatch() {
  show('patch');
  $('retry').classList.add('hidden');
  $('patch-status').textContent = 'Checking for updates...';
  $('patch-detail').textContent = '';
  $('bar-fill').style.width = '0%';

  const stop = window.coe.onPatchProgress((p) => {
    if (p.phase === 'downloading' || p.phase === 'done') {
      const pct = p.bytesTotal > 0 ? Math.round((p.bytesDone / p.bytesTotal) * 100) : 100;
      $('bar-fill').style.width = pct + '%';
      $('patch-status').textContent = p.phase === 'done' ? 'Up to date.' : 'Downloading updates...';
      $('patch-detail').textContent = p.current ? p.current : '';
    }
  });
  const result = await window.coe.patch();
  stop();

  if (!result.ok) {
    $('patch-status').textContent = PATCH_ERRORS[result.error] || 'The update failed.';
    $('retry').classList.remove('hidden');
    return;
  }

  $('bar-fill').style.width = '100%';
  $('patch-status').textContent = 'Up to date.';
  const info = await window.coe.info();
  $('version').textContent = `launcher ${info.version} - content ${result.version}`;

  const resumed = await window.coe.resume();
  if (resumed.ok) {
    enterHome(resumed.username);
  } else {
    show('login');
    $('username').focus();
  }
}

$('retry').addEventListener('click', runPatch);
$('tab-login').addEventListener('click', () => setMode('login'));
$('tab-register').addEventListener('click', () => setMode('register'));
$('username').addEventListener('input', updateHints);
$('password').addEventListener('input', updateHints);

$('auth-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  $('submit').disabled = true;
  $('auth-error').textContent = '';
  if (mode === 'register' && !$('age').checked) {
    $('submit').disabled = false;
    $('auth-error').textContent = 'You must be 13 or older to make an account.';
    return;
  }
  const chosen = document.querySelector('input[name="gender"]:checked');
  if (mode === 'register' && !chosen) {
    $('submit').disabled = false;
    $('auth-error').textContent = 'Choose a body shape. It cannot be changed later.';
    return;
  }
  if (mode === 'register') {
    const problem = usernameProblem($('username').value.trim()) || passwordProblem($('password').value, $('username').value.trim());
    if (problem) {
      $('submit').disabled = false;
      $('auth-error').textContent = problem;
      return;
    }
  }
  const call = mode === 'login' ? window.coe.login : window.coe.register;
  const result = await call($('username').value.trim(), $('password').value, $('remember').checked, $('age').checked, chosen ? chosen.value : '');
  $('submit').disabled = false;
  $('password').value = '';
  if (result.ok && result.recoveryKey) showRecovery(result.recoveryKey, () => enterHome(result.username));
  else if (result.ok) enterHome(result.username);
  else $('auth-error').textContent = authMessage(result);
});

$('logout').addEventListener('click', async () => {
  await window.coe.logout();
  show('login');
  $('username').focus();
});

$('play').addEventListener('click', async () => {
  $('home-error').textContent = '';
  $('play').disabled = true;
  const result = await window.coe.play();
  $('play').disabled = false;
  if (!result.ok) {
    $('home-error').textContent = PLAY_ERRORS[result.error] || `Could not enter the world (${result.error}).`;
    return;
  }
  try {
    await window.coeGame.start(result.welcome, result.map);
    show('gameview');
  } catch {
    window.coe.leave();
    $('home-error').textContent = 'Could not load the map.';
  }
});

const askSignOut = (open) => {
  $('signout-confirm').classList.toggle('hidden', !open);
  if (open) $('so-no').focus();
};
$('leave').addEventListener('click', () => askSignOut(true));
$('so-no').addEventListener('click', () => askSignOut(false));
$('so-yes').addEventListener('click', async () => {
  askSignOut(false);
  window.coe.leave();
  window.coeGame.stop();
  await window.coe.logout();
  show('login');
  $('username').focus();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('signout-confirm').classList.contains('hidden')) askSignOut(false);
});

window.coe.onGameMessage((msg) => window.coeGame.handle(msg));
window.coe.onGameClosed((info) => {
  if (!window.coeGame.isRunning()) return;
  window.coeGame.stop();
  show('home');
  $('home-error').textContent = CLOSE_REASONS[info.error] || 'You were disconnected from the world.';
});

runPatch();

$('show-password').addEventListener('change', () => {
  $('password').type = $('show-password').checked ? 'text' : 'password';
});
$('show-reset-password').addEventListener('change', () => {
  $('reset-password').type = $('show-reset-password').checked ? 'text' : 'password';
});

function showReset(on) {
  $('auth-form').classList.toggle('hidden', on);
  $('reset-form').classList.toggle('hidden', !on);
  document.querySelector('.tabs').classList.toggle('hidden', on);
  $('reset-message').textContent = '';
  $('reset-message').className = 'error';
  if (on) {
    $('reset-username').value = $('username').value;
    $('reset-code').focus();
  }
}
$('forgot').addEventListener('click', () => showReset(true));
$('reset-back').addEventListener('click', () => showReset(false));

$('reset-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  $('reset-submit').disabled = true;
  $('reset-message').className = 'error';
  $('reset-message').textContent = '';
  if (typeof window.coe.resetPassword !== 'function') {
    $('reset-submit').disabled = false;
    $('reset-message').textContent = 'Install the latest version of the game to reset a password.';
    return;
  }
  const result = await window.coe.resetPassword($('reset-username').value.trim(), $('reset-code').value.trim(), $('reset-password').value);
  $('reset-submit').disabled = false;
  if (result.ok) {
    $('reset-password').value = '';
    $('reset-code').value = '';
    $('username').value = $('reset-username').value.trim();
    showReset(false);
    setMode('login');
    const done = () => {
      show('login');
      $('auth-error').textContent = 'Password changed. Sign in with the new one.';
    };
    if (result.recoveryKey) showRecovery(result.recoveryKey, done);
    else done();
  } else if (result.error === 'invalid_request') {
    $('reset-message').textContent = 'The new password must be at least 10 characters and not a common one.';
  } else {
    $('reset-message').textContent = authMessage(result);
  }
});

let afterRecovery = null;

function showRecovery(key, next) {
  $('recovery-key').textContent = key;
  $('recovery-saved').checked = false;
  $('recovery-continue').disabled = true;
  $('recovery-copy').textContent = 'Copy';
  afterRecovery = next;
  show('recovery');
}

$('recovery-saved').addEventListener('change', () => {
  $('recovery-continue').disabled = !$('recovery-saved').checked;
});
$('recovery-copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText($('recovery-key').textContent);
    $('recovery-copy').textContent = 'Copied';
  } catch {
    $('recovery-copy').textContent = 'Select the key and copy it by hand';
  }
});
$('recovery-continue').addEventListener('click', () => {
  const next = afterRecovery;
  afterRecovery = null;
  $('recovery-key').textContent = '';
  if (next) next();
});

$('recovery-make').addEventListener('click', async () => {
  $('recovery-error').textContent = '';
  if (typeof window.coe.newRecoveryKey !== 'function') {
    $('recovery-error').textContent = 'Install the latest version of the game to make a recovery key.';
    return;
  }
  const result = await window.coe.newRecoveryKey(currentUser, $('recovery-password').value);
  $('recovery-password').value = '';
  if (result.ok) showRecovery(result.recoveryKey, () => show('home'));
  else $('recovery-error').textContent = authMessage(result);
});

$('google-link').addEventListener('click', async () => {
  $('recovery-error').textContent = '';
  if (typeof window.coe.googleLink !== 'function') {
    $('recovery-error').textContent = 'Install the latest version of the game to link Google.';
    return;
  }
  if (!$('recovery-password').value) {
    $('recovery-error').textContent = 'Type your password first.';
    return;
  }
  $('recovery-error').textContent = 'Finish signing in with Google in your browser...';
  const result = await window.coe.googleLink(currentUser, $('recovery-password').value);
  $('recovery-password').value = '';
  $('recovery-error').textContent = result.ok ? 'Google account linked.' : authMessage(result);
});

$('reset-google').addEventListener('click', async () => {
  $('reset-message').className = 'error';
  if (typeof window.coe.googleReset !== 'function') {
    $('reset-message').textContent = 'Install the latest version of the game to use Google.';
    return;
  }
  if (!$('reset-password').value) {
    $('reset-message').textContent = 'Type the new password first, then choose Google.';
    return;
  }
  $('reset-message').textContent = 'Finish signing in with Google in your browser...';
  const result = await window.coe.googleReset($('reset-password').value);
  if (!result.ok) {
    $('reset-message').textContent = result.error === 'invalid_request' ? 'The new password must be at least 10 characters and not a common one.' : authMessage(result);
    return;
  }
  $('reset-password').value = '';
  $('username').value = result.username;
  showReset(false);
  setMode('login');
  showRecovery(result.recoveryKey, () => {
    show('login');
    $('auth-error').textContent = 'Password changed. Sign in with the new one.';
  });
});
