
// ═══════════════════════════════════════════════════════════════
// BLOOM WELLNESS — Biometric Authentication (WebAuthn / FIDO2)
// ═══════════════════════════════════════════════════════════════
// ✅ WORKS ON MOBILE IN NORMAL MODE (no desktop site mode needed)
//    - Android Chrome  → Fingerprint scanner
//    - iOS Safari 14+  → Touch ID / Face ID
//    - Desktop Chrome  → Windows Hello / Touch ID on Mac
//
// Uses "platform authenticator" which means the BUILT-IN sensor
// on the device, not an external USB key.
// ═══════════════════════════════════════════════════════════════

const BloomAuth = (() => {
  const RP_NAME = 'Bloom Wellness';
  // RP_ID must match the domain. localhost works for local testing.
  const RP_ID = location.hostname || 'localhost';

  // ── Utilities ───────────────────────────────────────────────
  function isSupported() {
    return typeof window !== 'undefined' && !!window.PublicKeyCredential;
  }

  function isMobile() {
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  function randomBytes(n = 32) {
    const arr = new Uint8Array(n);
    crypto.getRandomValues(arr);
    return arr;
  }

  function bufToB64url(buf) {
    return btoa(String.fromCharCode(...new Uint8Array(buf)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  function b64urlToBuf(s) {
    s = (s + '===').slice(0, s.length + (4 - s.length % 4) % 4);
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    return Uint8Array.from(atob(s), c => c.charCodeAt(0));
  }

  // ── Check if platform authenticator (biometric) is available ─
  async function biometricAvailable() {
    if (!isSupported()) return false;
    try {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch (e) {
      return false;
    }
  }

  // ── REGISTER — create a biometric credential ────────────────
  // Call this once when user enables biometric lock
  async function register(userName) {
    if (!isSupported()) throw new Error('WebAuthn not supported on this browser');

    const challenge   = randomBytes(32);
    const userIdBytes = new TextEncoder().encode('bloom-' + (userName || 'user'));

    const credential = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          id: RP_ID,
          name: RP_NAME,
        },
        user: {
          id: userIdBytes,
          name: userName || 'BloomUser',
          displayName: userName || 'Bloom User',
        },
        pubKeyCredParams: [
          { alg: -7,   type: 'public-key' },   // ES256 (ECDSA)
          { alg: -257, type: 'public-key' },    // RS256 (RSA)
          { alg: -8,   type: 'public-key' },    // EdDSA
        ],
        authenticatorSelection: {
          // 'platform' → uses built-in sensor (fingerprint / Face ID / Windows Hello)
          // 'cross-platform' would use USB keys — we don't want that
          authenticatorAttachment: 'platform',
          userVerification: 'required',       // MUST verify biometric
          residentKey: 'preferred',
          requireResidentKey: false,
        },
        timeout: 60000,
        attestation: 'none', // we don't need attestation for a wellness app
      },
    });

    if (!credential) throw new Error('Credential creation failed');

    // Store credential ID in localStorage for future auth
    const credId = bufToB64url(credential.rawId);
    return credId;
  }

  // ── AUTHENTICATE — verify biometric ─────────────────────────
  // Call this on each app open (if biometric lock is enabled)
  async function authenticate(credentialIdB64) {
    if (!isSupported()) throw new Error('WebAuthn not supported');

    const challenge = randomBytes(32);
    const allowCredentials = credentialIdB64
      ? [{ id: b64urlToBuf(credentialIdB64), type: 'public-key', transports: ['internal'] }]
      : [];

    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials,
        userVerification: 'required',
        timeout: 60000,
        rpId: RP_ID,
      },
    });

    return assertion !== null;
  }

  // ── Public API ───────────────────────────────────────────────
  return {
    isSupported,
    isMobile,
    biometricAvailable,
    register,
    authenticate,
  };
})();
