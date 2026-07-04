import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { collection, onSnapshot, orderBy, query } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { currentMonth, sameMonth, formatMoney, categoryTotals, setMessage } from './helpers.js';

const API_BASE_URL = window.VIGO_API_BASE_URL || 'http://localhost:3000';
const logoutBtn = document.getElementById('logoutBtn');
const assistantMonth = document.getElementById('assistantMonth');
const assistantForm = document.getElementById('assistantForm');
const assistantQuestion = document.getElementById('assistantQuestion');
const assistantMessage = document.getElementById('assistantMessage');
const chatMessages = document.getElementById('chatMessages');
const aiSummary = document.getElementById('aiSummary');

let allTransactions = [];
let currentUser = null;

assistantMonth.value = currentMonth();
logoutBtn?.addEventListener('click', () => signOut(auth));
assistantMonth?.addEventListener('change', renderSummary);

onAuthStateChanged(auth, (user) => {
  if (!user) {
    location.href = 'login.html';
    return;
  }
  currentUser = user;
  listenTransactions(user.uid);
});

function listenTransactions(uid) {
  const transactionsRef = collection(db, 'users', uid, 'transactions');
  const q = query(transactionsRef, orderBy('date', 'desc'));
  onSnapshot(q, (snapshot) => {
    allTransactions = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    renderSummary();
  }, (error) => {
    console.error(error);
    aiSummary.textContent = 'Não consegui carregar seus lançamentos.';
  });
}

assistantForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const question = assistantQuestion.value.trim();
  if (!question) return;

  addBubble(question, 'user');
  assistantQuestion.value = '';
  setMessage(assistantMessage, 'Pensando...', '');

  const summary = buildSummary();

  try {
    const response = await fetch(`${API_BASE_URL}/api/assistente-financeiro`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, summary, userId: currentUser?.uid })
    });

    if (!response.ok) throw new Error('backend-not-ready');
    const data = await response.json();
    addBubble(data.answer || 'Não recebi resposta do assistente.', 'assistant');
    setMessage(assistantMessage, '', '');
  } catch (error) {
    const local = fallbackAnswer(question, summary);
    addBubble(local, 'assistant');
    setMessage(assistantMessage, 'Assistente em fase de testes: em breve ele responderá usando seu resumo financeiro completo.', 'error');
  }
});

function renderSummary() {
  const summary = buildSummary();
  aiSummary.className = 'diagnostic-result';
  aiSummary.innerHTML = `
    <div><span>Entradas</span><strong>${formatMoney(summary.income)}</strong></div>
    <div><span>Despesas</span><strong>${formatMoney(summary.expense)}</strong></div>
    <div><span>Saldo</span><strong>${formatMoney(summary.balance)}</strong></div>
    <div><span>Maior gasto</span><strong>${summary.topCategory || '-'}</strong></div>
    <p>${summary.count} movimentações no mês ${assistantMonth.value || currentMonth()}.</p>
  `;
}

function buildSummary() {
  const month = assistantMonth.value || currentMonth();
  const data = allTransactions.filter(item => sameMonth(item.date, month));
  const income = data.filter(item => item.type === 'entrada').reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const expense = data.filter(item => item.type === 'saida').reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const balance = income - expense;
  const totals = categoryTotals(data);
  const top = Object.entries(totals).sort((a, b) => b[1] - a[1])[0];
  return {
    month,
    income,
    expense,
    balance,
    count: data.length,
    topCategory: top ? top[0] : null,
    topCategoryAmount: top ? top[1] : 0,
    categories: totals
  };
}

function addBubble(text, type) {
  const div = document.createElement('div');
  div.className = `chat-bubble ${type}`;
  div.textContent = text;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function fallbackAnswer(question, summary) {
  if (!summary.count) {
    return 'Ainda não tenho lançamentos suficientes. Cadastre suas entradas e despesas no dashboard para eu conseguir analisar melhor.';
  }
  if (summary.balance < 0) {
    return `Seu mês está negativo em ${formatMoney(Math.abs(summary.balance))}. Primeiro corte gastos variáveis e evite novas parcelas. A categoria que mais pesa agora é ${summary.topCategory || 'não identificada'}.`;
  }
  if (summary.topCategory) {
    return `Você está positivo em ${formatMoney(summary.balance)}. Para melhorar, revise ${summary.topCategory}, que teve ${formatMoney(summary.topCategoryAmount)} em gastos. Uma boa meta é guardar 10% das entradas antes de gastar.`;
  }
  return 'Seu resumo parece equilibrado. Continue lançando tudo e crie uma meta automática para guardar parte do saldo.';
}
