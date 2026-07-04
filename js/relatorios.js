import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { collection, onSnapshot, orderBy, query } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { currentMonth, sameMonth, formatMoney, categoryTotals, renderCategoryChart, downloadTextFile } from './helpers.js';

const logoutBtn = document.getElementById('logoutBtn');
const reportMonthInput = document.getElementById('reportMonthInput');
const reportIncome = document.getElementById('reportIncome');
const reportExpense = document.getElementById('reportExpense');
const reportBalance = document.getElementById('reportBalance');
const reportCount = document.getElementById('reportCount');
const reportCategories = document.getElementById('reportCategories');
const insightsList = document.getElementById('insightsList');
const reportTable = document.getElementById('reportTable');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const printBtn = document.getElementById('printBtn');

let allTransactions = [];
let filteredTransactions = [];
let currentUser = null;

reportMonthInput.value = currentMonth();
logoutBtn?.addEventListener('click', () => signOut(auth));
reportMonthInput?.addEventListener('change', renderReport);
printBtn?.addEventListener('click', () => window.print());
exportCsvBtn?.addEventListener('click', exportCsv);

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
    renderReport();
  }, (error) => {
    console.error(error);
    reportTable.innerHTML = '<tr><td colspan="5" class="empty-state">Não consegui carregar seu relatório agora. Tente novamente em alguns instantes.</td></tr>';
  });
}

function renderReport() {
  const month = reportMonthInput.value || currentMonth();
  filteredTransactions = allTransactions.filter(item => sameMonth(item.date, month));

  const income = filteredTransactions.filter(item => item.type === 'entrada').reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const expense = filteredTransactions.filter(item => item.type === 'saida').reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const balance = income - expense;
  const totals = categoryTotals(filteredTransactions);

  reportIncome.textContent = formatMoney(income);
  reportExpense.textContent = formatMoney(expense);
  reportBalance.textContent = formatMoney(balance);
  reportCount.textContent = filteredTransactions.length;

  renderCategoryChart(reportCategories, totals);
  renderInsights(income, expense, balance, totals);
  renderTable(filteredTransactions);
}

function renderInsights(income, expense, balance, totals) {
  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const insights = [];

  if (income === 0 && expense === 0) {
    insightsList.className = 'idea-list compact empty-state';
    insightsList.textContent = 'Cadastre movimentações para gerar insights.';
    return;
  }

  if (balance < 0) insights.push(['⚠️ Atenção', 'Suas despesas passaram das entradas neste mês.']);
  if (balance > 0) insights.push(['✅ Bom sinal', `Sobrou ${formatMoney(balance)} no mês selecionado.`]);
  if (entries[0]) insights.push(['📌 Maior gasto', `${entries[0][0]} foi a categoria com maior despesa: ${formatMoney(entries[0][1])}.`]);
  if (expense > income * 0.8 && income > 0) insights.push(['💡 Dica', 'Você gastou mais de 80% das entradas. Vale revisar gastos variáveis.']);
  if (!insights.length) insights.push(['📊 Resumo', 'O mês está equilibrado. Continue registrando para melhorar a análise.']);

  insightsList.className = 'idea-list compact';
  insightsList.innerHTML = insights.map(([title, text]) => `<div><strong>${title}</strong><span>${text}</span></div>`).join('');
}

function renderTable(data) {
  if (!data.length) {
    reportTable.innerHTML = '<tr><td colspan="5" class="empty-state">Nenhuma movimentação encontrada.</td></tr>';
    return;
  }
  reportTable.innerHTML = data.map(item => `
    <tr>
      <td>${formatDate(item.date)}</td>
      <td>${escapeHtml(item.description)}</td>
      <td>${escapeHtml(item.category)}</td>
      <td><span class="type-pill ${item.type}">${item.type === 'entrada' ? 'Entrada' : 'Despesa'}</span></td>
      <td>${formatMoney(item.amount)}</td>
    </tr>
  `).join('');
}

function exportCsv() {
  if (!filteredTransactions.length) {
    alert('Nenhuma movimentação para exportar.');
    return;
  }
  const header = ['data', 'descricao', 'categoria', 'tipo', 'valor'];
  const rows = filteredTransactions.map(item => [
    item.date,
    cleanCsv(item.description),
    cleanCsv(item.category),
    item.type,
    Number(item.amount || 0).toFixed(2).replace('.', ',')
  ]);
  const csv = [header, ...rows].map(row => row.join(';')).join('\n');
  downloadTextFile(`vigo-relatorio-${reportMonthInput.value}.csv`, csv, 'text/csv;charset=utf-8');
}

function cleanCsv(value = '') {
  return String(value).replaceAll(';', ',').replaceAll('\n', ' ');
}

function formatDate(date) {
  if (!date) return '-';
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}
