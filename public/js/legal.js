// Páginas de Privacidade e Termos: mostra o canal de suporte configurado em SUPPORT_EMAIL (via /api/status).
// Sem a variável definida, mantém o texto neutro que já está na página.
(function () {
  var target = document.getElementById('legalSupport');
  if (!target || typeof fetch !== 'function') return;
  fetch('/api/status')
    .then(function (response) { return response.ok ? response.json() : null; })
    .then(function (status) {
      var email = status && typeof status.supportEmail === 'string' ? status.supportEmail : '';
      if (!email) return;
      target.textContent = 'Canal de suporte: ';
      var link = document.createElement('a');
      link.href = 'mailto:' + email;
      link.textContent = email;
      target.appendChild(link);
    })
    .catch(function () { /* mantém o texto neutro */ });
})();
