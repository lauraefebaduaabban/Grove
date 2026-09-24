/* ==========================================================================
   GROVE — Authentication (Supabase)
   Real authentication backed by Supabase Auth. Replaces the old prototype
   localStorage auth. Only the Supabase Publishable (anon) key is used here
   — never a secret/service-role key — so it is safe to ship in the browser.
   ========================================================================== */

const supabaseClient = window.supabase.createClient(
  'https://ffqjtaoxiewkrgxrkiyw.supabase.co',
  'PASTE_YOUR_SUPABASE_PUBLISHABLE_KEY_HERE'
);

// Must match the Site URL / Redirect URL configured in the Supabase dashboard.
// Update this if you test locally (e.g. http://localhost:5500) and add that
// URL to Supabase's Redirect URLs allow-list.
const SITE_URL = 'https://grovefinance.vercel.app';

const GroveAuth = (function () {

  /* ---------------- password rules (unchanged, shared with the live
     checklist UI in script.js) ---------------- */
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
  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email || '').trim());
  }

  /* ---------------- session cache ----------------
     Supabase's session calls are async, but existing Grove code (dashboard
     greeting, Settings page, the init session-check) calls
     GroveAuth.currentUser() synchronously. We keep a small in-memory cache
     that's kept in sync by onAuthStateChange, and expose `ready` so callers
     that run at startup can wait for the first session check to resolve. */
  let cachedUser = null;
  let recoveryFlow = false;
  let readyResolve;
  const ready = new Promise(resolve => { readyResolve = resolve; });

  function userFromSession(session) {
    if (!session || !session.user) return null;
    return {
      name: (session.user.user_metadata && session.user.user_metadata.name) || '',
      email: session.user.email || ''
    };
  }

  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      recoveryFlow = true;
    }
    cachedUser = userFromSession(session);
    if (readyResolve) { readyResolve(); readyResolve = null; }
  });

  function currentUser() {
    return cachedUser;
  }

  function isPasswordRecovery() {
    return recoveryFlow;
  }

  function clearPasswordRecoveryFlag() {
    recoveryFlow = false;
  }

  /* ---------------- signup / signin ---------------- */
  async function signUp({ name, email, password, confirm }) {
    name = (name || '').trim();
    email = (email || '').trim().toLowerCase();
    if (!name) return { ok: false, error: 'Please enter your name.' };
    if (!isValidEmail(email)) return { ok: false, error: 'Please enter a valid email address.' };
    if (!isStrongPassword(password)) return { ok: false, error: 'Password does not meet the requirements below.' };
    if (password !== confirm) return { ok: false, error: 'Passwords do not match.' };

    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: SITE_URL
      }
    });

    if (error) {
      if (/already registered|already exists/i.test(error.message)) {
        return { ok: false, error: 'An account with this email already exists.' };
      }
      return { ok: false, error: error.message };
    }

    // Supabase anti-enumeration behaviour: signing up with an email that's
    // already registered (and confirmed) returns a user object with an
    // empty `identities` array instead of an error.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return { ok: false, error: 'An account with this email already exists.' };
    }

    // Email confirmation is required, so there is no active session yet.
    if (data.user && !data.session) {
      return { ok: true, needsConfirmation: true };
    }

    return { ok: true };
  }

  async function signIn({ email, password }) {
    email = (email || '').trim().toLowerCase();
    if (!isValidEmail(email) || !password) return { ok: false, error: 'Please enter your email and password.' };

    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
      if (/confirm/i.test(error.message)) {
        return { ok: false, error: 'Please confirm your email before signing in. Check your inbox for the confirmation link.' };
      }
      return { ok: false, error: 'Incorrect email or password.' };
    }
    return { ok: true };
  }

  async function signOut() {
    await supabaseClient.auth.signOut();
    cachedUser = null;
    recoveryFlow = false;
  }

  /* ---------------- password reset (Supabase email-link flow) ---------------- */
  async function requestReset(email) {
    email = (email || '').trim().toLowerCase();
    if (!isValidEmail(email)) return { ok: false, error: 'Please enter a valid email address.' };

    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: SITE_URL
    });

    // Supabase intentionally doesn't reveal whether the email is registered,
    // so we can't tell the user "no account found" the way the old
    // prototype did. A generic confirmation is the correct, secure message.
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  async function resetPassword(newPassword, confirm) {
    if (!isStrongPassword(newPassword)) return { ok: false, error: 'Password does not meet the requirements below.' };
    if (newPassword !== confirm) return { ok: false, error: 'Passwords do not match.' };

    const { error } = await supabaseClient.auth.updateUser({ password: newPassword });
    if (error) return { ok: false, error: error.message };

    // Sign out of the temporary recovery session so the user signs back in
    // normally with their new password (matches the previous UX).
    await supabaseClient.auth.signOut();
    cachedUser = null;
    recoveryFlow = false;
    return { ok: true };
  }

  return {
    ready,
    signUp, signIn, signOut,
    requestReset, resetPassword,
    currentUser, isPasswordRecovery, clearPasswordRecoveryFlag,
    isValidEmail,
    passwordRuleResults, isStrongPassword
  };
})();
