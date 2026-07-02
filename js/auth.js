import { auth, db } from './firebase.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { doc, setDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { setMessage } from './helpers.js';

const tabLogin = document.getElementById('tabLogin');
const tabRegister = document.getElementById('tabRegister');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const authMessage = document.getElementById('authMessage');
const resetPasswordBtn = document.getElementById('resetPasswordBtn');
const googleLoginBtn = document.getElementById('googleLoginBtn');
const googleLabel = googleLoginBtn?.querySelector('.google-label') || googleLoginBtn;
const authDividerText = document.querySelector('.auth-divider span');
const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({ prompt: 'select_account' });

function showRegister() {
  tabRegister?.classList.add('active');
  tabLogin?.classList.remove('active');
  registerForm?.classList.remove('hidden');
  loginForm?.classList.add('hidden');
  if (googleLabel) googleLabel.textContent = 'Criar conta com Google';
  if (authDividerText) authDividerText.textContent = 'ou crie com e-mail';
  setMessage(authMessage, 'Preencha os dados abaixo para criar sua conta grátis.', '');
}

function showLogin() {
  tabLogin?.classList.add('active');
  tabRegister?.classList.remove('active');
  loginForm?.classList.remove('hidden');
  registerForm?.classList.add('hidden');
  if (googleLabel) googleLabel.textContent = 'Entrar com Google';
  if (authDividerText) authDividerText.textContent = 'ou entre com e-mail';
  setMessage(authMessage, '');
}

tabLogin?.addEventListener('click', showLogin);
tabRegister?.addEventListener('click', showRegister);

if (new URLSearchParams(location.search).get('mode') === 'register') showRegister();

onAuthStateChanged(auth, (user) => {
  if (user && location.pathname.endsWith('/login.html')) {
    location.href = 'dashboard.html';
  }
});

googleLoginBtn?.addEventListener('click', async () => {
  setMessage(authMessage, 'Abrindo login do Google...', '');
  try {
    const credential = await signInWithPopup(auth, googleProvider);
    const user = credential.user;
    await salvarPerfilUsuario(user, {
      name: user.displayName || user.email?.split('@')[0] || 'Usuário',
      email: user.email,
      photoURL: user.photoURL || '',
      provider: 'google'
    });
    location.href = 'dashboard.html';
  } catch (error) {
    console.error(error);
    setMessage(authMessage, traduzErro(error.code), 'error');
  }
});

loginForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage(authMessage, 'Entrando...', '');
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    location.href = 'dashboard.html';
  } catch (error) {
    console.error(error);
    setMessage(authMessage, traduzErro(error.code), 'error');
  }
});

registerForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const name = document.getElementById('registerName').value.trim();
  const email = document.getElementById('registerEmail').value.trim();
  const password = document.getElementById('registerPassword').value;

  if (!name) {
    setMessage(authMessage, 'Digite seu nome para criar a conta.', 'error');
    return;
  }

  if (password.length < 6) {
    setMessage(authMessage, 'A senha precisa ter pelo menos 6 caracteres.', 'error');
    return;
  }

  setMessage(authMessage, 'Criando sua conta grátis...', '');

  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(credential.user, { displayName: name });

    await salvarPerfilUsuario(credential.user, {
      name,
      email,
      provider: 'email'
    });

    location.href = 'dashboard.html';
  } catch (error) {
    console.error(error);
    setMessage(authMessage, traduzErro(error.code), 'error');
  }
});

async function salvarPerfilUsuario(user, dados) {
  const userRef = doc(db, 'users', user.uid);

  try {
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      await setDoc(userRef, {
        ...dados,
        plan: 'free',
        createdAt: serverTimestamp()
      });
    }
  } catch (error) {
    // A conta no Authentication já foi criada. Se o Firestore ainda não estiver com as regras publicadas,
    // não vamos travar o cadastro aqui. O dashboard vai avisar caso o banco ainda precise ser configurado.
    console.warn('Conta criada, mas perfil não foi salvo no Firestore:', error);
  }
}

resetPasswordBtn?.addEventListener('click', async () => {
  const email = document.getElementById('loginEmail').value.trim();
  if (!email) {
    setMessage(authMessage, 'Digite seu e-mail no campo de login para recuperar a senha.', 'error');
    return;
  }
  try {
    await sendPasswordResetEmail(auth, email);
    setMessage(authMessage, 'E-mail de recuperação enviado.', 'success');
  } catch (error) {
    console.error(error);
    setMessage(authMessage, traduzErro(error.code), 'error');
  }
});

function traduzErro(code) {
  const erros = {
    'auth/email-already-in-use': 'Esse e-mail já está cadastrado. Use Entrar ou recupere a senha.',
    'auth/invalid-email': 'E-mail inválido. Confere se digitou certinho.',
    'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
    'auth/user-not-found': 'Usuário não encontrado. Clique em Criar conta primeiro.',
    'auth/wrong-password': 'Senha incorreta.',
    'auth/invalid-credential': 'E-mail ou senha incorretos. Se ainda não tem cadastro, clique em Criar conta.',
    'auth/operation-not-allowed': 'O login por e-mail/senha não está liberado no Firebase. Vá em Authentication > Método de login e ative E-mail/senha.',
    'auth/popup-closed-by-user': 'Login com Google cancelado.',
    'auth/popup-blocked': 'O navegador bloqueou o pop-up do Google. Libere pop-ups para esse site.',
    'auth/unauthorized-domain': 'Domínio não autorizado no Firebase. Adicione localhost ou seu domínio real em Authentication > Configurações > Domínios autorizados.',
    'auth/network-request-failed': 'Erro de conexão. Verifique sua internet.',
    'permission-denied': 'Conta criada, mas o Firestore bloqueou o salvamento. Publique as regras do arquivo firestore.rules no Firebase.'
  };
  return erros[code] || `Não foi possível concluir. Código do erro: ${code || 'desconhecido'}.`;
}
