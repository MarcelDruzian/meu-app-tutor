// ==========================================================
// TUTOR IA - AUTENTICA??O REAL INICIAL (BACKEND + TOKEN)
// ==========================================================

export const AuthService = {
  async register({ name, email, password }) {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || 'N?o foi poss?vel criar a conta no momento.');
    }

    return data;
  },

  async login({ email, password }) {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || 'E-mail ou senha inv?lidos.');
    }

    return data;
  },

  async logout(token) {
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? 'Bearer ' + token : ''
      }
    });

    const data = await response.json().catch(() => ({ ok: false }));
    if (!response.ok) {
      throw new Error(data.error || 'N?o foi poss?vel encerrar a sess?o.');
    }

    return data;
  },

  async getCurrentUser(token) {
    const response = await fetch('/api/auth/me', {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? 'Bearer ' + token : ''
      }
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json().catch(() => ({}));
    return data.user || null;
  }
};
