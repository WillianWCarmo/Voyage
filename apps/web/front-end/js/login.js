// =============================================
// login.js — Área ADM do Voyage
// =============================================

const API_BASE = (window.VOYAGE_API_URL || `http://${window.location.hostname || 'localhost'}:3333/api`).replace(/\/+$/, '');
const CODIGO_ADM = 'VOYAGE-ADM-2026'; // código para criar o primeiro admin

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast show toast-${type}`;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 3500);
}

function toggleCards(showRegister) {
  const loginCard = document.getElementById('cardLogin');
  const registerCard = document.getElementById('cardRegister');
  if (!loginCard || !registerCard) return;
  loginCard.classList.toggle('active', !showRegister);
  registerCard.classList.toggle('active', showRegister);
}

async function apiRequest(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });
  } catch {
    throw new Error(`Não foi possível conectar à API (${API_BASE}). Verifique se o backend está rodando.`);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Não foi possível concluir a solicitação.');
  return data;
}

function saveAdminSession(token, admin) {
  localStorage.setItem('voyage_admin_token', token);
  localStorage.setItem('voyage_admin_user', JSON.stringify(admin));
}

document.addEventListener('DOMContentLoaded', () => {
  // Alternar Login ↔ Registro
  document.getElementById('goToRegister')?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleCards(true);
  });
  document.getElementById('goToLogin')?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleCards(false);
  });

  // Mostrar / ocultar senha
  document.querySelectorAll('.btn-toggle-password').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.getAttribute('data-target'));
      if (!input) return;
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      const icon = btn.querySelector('i');
      if (icon) {
        icon.classList.toggle('bi-eye', !show);
        icon.classList.toggle('bi-eye-slash', show);
      }
    });
  });

// ===== LOGIN =====
document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('loginEmail')?.value.trim().toLowerCase();
  const password = document.getElementById('loginPassword')?.value;
  const btn = e.target.querySelector('button[type="submit"]');

  if (!email || !password) {
    showToast('Preencha e-mail e senha.', 'error');
    return;
  }

  btn.disabled = true;
  try {
    const result = await apiRequest('/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
saveAdminSession(result.token, result.admin);
showToast('Login realizado com sucesso!', 'success');
setTimeout(() => {
  window.location.href = './admin-painel.html';
}, 600);
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
  }
});

// ===== REGISTRO =====
document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('regNome')?.value.trim();
  const email = document.getElementById('regEmail')?.value.trim().toLowerCase();
  const codigo = document.getElementById('regCodigo')?.value.trim();
  const senha = document.getElementById('regSenha')?.value;
  const confirma = document.getElementById('regConfirmaSenha')?.value;
  const aceito = document.getElementById('aceitoTermos')?.checked;
  const btn = e.target.querySelector('button[type="submit"]');

  if (!name || !email || !codigo || !senha || !confirma) {
    showToast('Preencha todos os campos.', 'error');
    return;
  }
  if (!aceito) {
    showToast('Você precisa aceitar os termos.', 'error');
    return;
  }
  if (senha !== confirma) {
    showToast('As senhas não coincidem.', 'error');
    return;
  }
  if (senha.length < 6) {
    showToast('A senha deve ter pelo menos 6 caracteres.', 'error');
    return;
  }
  if (codigo !== CODIGO_ADM) {
    showToast('Código de acesso ADM inválido.', 'error');
    return;
  }

  btn.disabled = true;
  try {
    await apiRequest('/admin/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password: senha, codigo })
    });

    // Limpa o formulário de registro
    e.target.reset();

    // Volta para o card de LOGIN (não redireciona)
    toggleCards(false);

    showToast('Conta criada com sucesso! Faça o login.', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
  }
});
});