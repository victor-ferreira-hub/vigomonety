import { auth } from './firebase.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const API_BASE_URL = window.VIGO_API_BASE_URL || 'http://localhost:3000';
const logoutBtn = document.getElementById('logoutBtn');
const checkoutMessage = document.getElementById('checkoutMessage');
const buttons = document.querySelectorAll('.checkout-btn');
let currentUser = null;

logoutBtn?.addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, (user) => {
  if (!user) {
    location.href = 'login.html';
    return;
  }
  currentUser = user;
});

buttons.forEach(button => {
  button.addEventListener('click', async () => {
    const plan = button.dataset.plan;
    checkoutMessage.textContent = 'Abrindo pagamento seguro...';
    try {
      const response = await fetch(`${API_BASE_URL}/api/create-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, userId: currentUser?.uid, email: currentUser?.email })
      });
      if (!response.ok) throw new Error('backend-not-ready');
      const data = await response.json();
      if (!data.checkoutUrl) throw new Error('checkout-url-missing');
      window.location.href = data.checkoutUrl;
    } catch (error) {
      checkoutMessage.textContent = 'Pagamento em preparação: em breve você será direcionado para o checkout seguro.';
    }
  });
});
