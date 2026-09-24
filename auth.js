/* ==========================================================================
   GROVE — Authentication (prototype only)
   NOTE: This is prototype authentication for demonstration purposes.
   Storing plaintext passwords in localStorage is NOT secure and must
   never be used in a real production system. The architecture below is
   written so it can be swapped for a real backend/auth service later.
   ========================================================================== */

const GroveAuth = (function () {
  const USERS_KEY = 'groveUsers';
  const SESSION_KEY = 'groveCurrentUser';
  const RESET_KEY = 'grovePasswordReset';
  const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes

  /* ---------------- storage helpers ---------------- */
  function safeGet(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      console.warn('Grove: could not read', key, e);
      return fallback;
    }
  }
  function safeSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn('Grove: could not save', key, e);
      return false;
    }
  }

  function getUsers() { return safeGet(USERS_KEY, []); }
  function saveUsers(users) { safeSet(USERS_KEY, users); }
  function findUserByEmail(email) {
    const e = (email || '').trim().toLowerCase();
    return getUsers().find(u => u.email === e) || null;
  }

  function getSession() { return safeGet(SESSION_KEY, null); }
  function setSession(email) { safeSet(SESSION_KEY, { email: (email || '').trim().toLowerCase() }); }
  function clearSession() { try { localStorage.removeItem(SESSION_KEY); } catch (e) {} }

  function currentUser() {
    const session = getSession();
    if (!session) return null;
    return findUserByEmail(session.email);
  }

  /* ---------------- validation ---------------- */
  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email || '').trim());
  }

  // Password rules, shared with the live checklist UI in script.js.
  const PASSWORD_RULES = {
    length: p => p.length >= 12,
    upper: p => /[A-Z]/.test(p),
    lower: p => /[a-z]/.test(p),
    number: p => /[0-9]/.test(p),
    special: p => /[^A-Za-z0-9]/.test(p)
  };
  function passwordRuleResults(password) {
    const p = password || '';
    const results = {};
    Object.keys(PASSWORD_RULES).forEach(key => { results[key] = PASSWORD_RULES[key](p); });
    return results;
  }
  function isStrongPassword(password) {
    const results = passwordRuleResults(password);
    return Object.keys(results).every(k => results[k]);
  }

  /* ---------------- signup / signin ---------------- */
  function signUp({ name, email, password, confirm }) {
    name = (name || '').trim();
    email = (email || '').trim().toLowerCase();
    if (!name) return { ok: false, error: 'Please enter your name.' };
    if (!isValidEmail(email)) return { ok: false, error: 'Please enter a valid email address.' };
    if (!isStrongPassword(password)) return { ok: false, error: 'Password does not meet the requirements below.' };
    if (password !== confirm) return { ok: false, error: 'Passwords do not match.' };
    if (findUserByEmail(email)) return { ok: false, error: 'An account with this email already exists.' };

    const users = getUsers();
    users.push({ name, email, password, createdAt: new Date().toISOString() });
    saveUsers(users);
    setSession(email);
    return { ok: true };
  }

  function signIn({ email, password }) {
    email = (email || '').trim().toLowerCase();
    if (!isValidEmail(email) || !password) return { ok: false, error: 'Please enter your email and password.' };
    const user = findUserByEmail(email);
    if (!user || user.password !== password) return { ok: false, error: 'Incorrect email or password.' };
    setSession(email);
    return { ok: true };
  }

  function signOut() {
    clearSession();
  }

  /* ---------------- password reset ---------------- */
  function requestReset(email) {
    email = (email || '').trim().toLowerCase();
    if (!isValidEmail(email)) return { ok: false, error: 'Please enter a valid email address.' };
    if (!findUserByEmail(email)) return { ok: false, error: 'No account found with this email.' };

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const entry = { email, code, expiresAt: Date.now() + CODE_TTL_MS };
    safeSet(RESET_KEY, entry);
    // Email delivery is not implemented in this prototype — log the code instead.
    console.log(`[Grove] Password reset code for ${email}: ${code} (expires in 10 minutes)`);
    return { ok: true };
  }

  function verifyResetCode(code) {
    const entry = safeGet(RESET_KEY, null);
    if (!entry) return { ok: false, error: 'No reset request found. Please start again.' };
    if (Date.now() > entry.expiresAt) return { ok: false, error: 'This code has expired. Please request a new one.' };
    if (String(code).trim() !== entry.code) return { ok: false, error: 'Incorrect code. Please try again.' };
    entry.verified = true;
    safeSet(RESET_KEY, entry);
    return { ok: true };
  }

  function resetPassword(newPassword, confirm) {
    const entry = safeGet(RESET_KEY, null);
    if (!entry || !entry.verified) return { ok: false, error: 'Please verify your code first.' };
    if (Date.now() > entry.expiresAt) return { ok: false, error: 'This code has expired. Please request a new one.' };
    if (!isStrongPassword(newPassword)) return { ok: false, error: 'Password does not meet the requirements below.' };
    if (newPassword !== confirm) return { ok: false, error: 'Passwords do not match.' };

    const users = getUsers();
    const user = users.find(u => u.email === entry.email);
    if (!user) return { ok: false, error: 'Account not found.' };
    user.password = newPassword;
    saveUsers(users);
    try { localStorage.removeItem(RESET_KEY); } catch (e) {}
    return { ok: true };
  }

  return {
    signUp, signIn, signOut,
    requestReset, verifyResetCode, resetPassword,
    currentUser, isValidEmail,
    passwordRuleResults, isStrongPassword
  };
})();

