import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { currentMonth, todayISO, sameMonth, formatMoney, categoryTotals, renderCategoryChart, setMessage } from './helpers.js';

const logoutBtn = document.getElementById('logoutBtn');
const welcomeText = document.getElementById('welcomeText');
const monthInput = document.getElementById('monthInput');
const transactionForm = document.getElementById('transactionForm');
const transactionDate = document.getElementById('transactionDate');
const transactionMessage = document.getElementById('transactionMessage');
const transactionsTable = document.getElementById('transactionsTable');
const categoryChart = document.getElementById('categoryChart');
const balanceValue = document.getElementById('balanceValue');
const incomeValue = document.getElementById('incomeValue');
const expenseValue = document.getElementById('expenseValue');
const topCategoryValue = document.getElementById('topCategoryValue');
const topCategoryAmount = document.getElementById('topCategoryAmount');
const balanceStatus = document.getElementById('balanceStatus');

let currentUser = null;
let allTransactions = [];

monthInput.value = currentMonth();
transactionDate.value = todayISO();

logoutBtn?.addEventListener('click', () => signOut(auth));
monthInput?.addEventListener('change', renderDashboard);

onAuthStateChanged(auth, (user) => {
  if (!user) {
    location.href = 'login.html';
    return;
  }
  currentUser = user;
  welcomeText.textContent = `Olá, ${user.displayName || user.email}. Esse é seu resumo financeiro.`;
  listenTransactions(user.uid);
});

function listenTransactions(uid) {
  const transactionsRef = collection(db, 'users', uid, 'transactions');
  const q = query(transactionsRef, orderBy('date', 'desc'));
  onSnapshot(q, (snapshot) => {
    allTransactions = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    renderDashboard();
  }, (error) => {
    console.error(error);
    transactionsTable.innerHTML = '<tr><td colspan="6" class="empty-state">Erro ao carregar movimentações. Confira as regras do Firestore.</td></tr>';
  });
}

transactionForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!currentUser) return;

  const payload = {
    type: document.getElementById('transactionType').value,
    date: document.getElementById('transactionDate').value,
    description: document.getElementById('transactionDescription').value.trim(),
    amount: Number(document.getElementById('transactionAmount').value),
    category: document.getElementById('transactionCategory').value,
    createdAt: serverTimestamp()
  };

  try {
    await addDoc(collection(db, 'users', currentUser.uid, 'transactions'), payload);
    transactionForm.reset();
    transactionDate.value = todayISO();
    setMessage(transactionMessage, 'Movimentação salva com sucesso.', 'success');
    setTimeout(() => setMessage(transactionMessage, ''), 2500);
  } catch (error) {
    console.error(error);
    setMessage(transactionMessage, 'Erro ao salvar. Confira Firestore e Authentication.', 'error');
  }
});

window.deleteTransaction = async function deleteTransaction(id) {
  if (!currentUser || !confirm('Excluir essa movimentação?')) return;
  await deleteDoc(doc(db, 'users', currentUser.uid, 'transactions', id));
};

function renderDashboard() {
  const month = monthInput.value || currentMonth();
  const data = allTransactions.filter(item => sameMonth(item.date, month));

  const income = data.filter(item => item.type === 'entrada').reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const expense = data.filter(item => item.type === 'saida').reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const balance = income - expense;
  const totals = categoryTotals(data);
  const top = Object.entries(totals).sort((a, b) => b[1] - a[1])[0];

  incomeValue.textContent = formatMoney(income);
  expenseValue.textContent = formatMoney(expense);
  balanceValue.textContent = formatMoney(balance);
  balanceStatus.textContent = balance >= 0 ? 'Dentro do controle' : 'Atenção: despesas maiores';
  topCategoryValue.textContent = top ? top[0] : '-';
  topCategoryAmount.textContent = top ? formatMoney(top[1]) : 'Por categoria';

  renderCategoryChart(categoryChart, totals);
  renderTable(data.slice(0, 12));
}

function renderTable(data) {
  if (!data.length) {
    transactionsTable.innerHTML = '<tr><td colspan="6" class="empty-state">Nenhuma movimentação cadastrada neste mês.</td></tr>';
    return;
  }
  transactionsTable.innerHTML = data.map(item => `
    <tr>
      <td>${formatDate(item.date)}</td>
      <td>${escapeHtml(item.description)}</td>
      <td>${escapeHtml(item.category)}</td>
      <td><span class="type-pill ${item.type}">${item.type === 'entrada' ? 'Entrada' : 'Despesa'}</span></td>
      <td>${formatMoney(item.amount)}</td>
      <td><button class="delete-btn" onclick="deleteTransaction('${item.id}')">Excluir</button></td>
    </tr>
  `).join('');
}

function formatDate(date) {
  if (!date) return '-';
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}
