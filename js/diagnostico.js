import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { collection, addDoc, onSnapshot, orderBy, query, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { currentMonth, sameMonth, formatMoney, setMessage, categoryTotals } from './helpers.js';

const logoutBtn = document.getElementById('logoutBtn');
const diagnosticMonth = document.getElementById('diagnosticMonth');
const fillFromTransactionsBtn = document.getElementById('fillFromTransactionsBtn');
const diagnosticForm = document.getElementById('diagnosticForm');
const diagnosticMessage = document.getElementById('diagnosticMessage');
const profileName = document.getElementById('profileName');
const profileSummary = document.getElementById('profileSummary');
const scoreValue = document.getElementById('scoreValue');
const riskValue = document.getElementById('riskValue');
const suggestedGoal = document.getElementById('suggestedGoal');
const actionPlan = document.getElementById('actionPlan');
const budgetRead = document.getElementById('budgetRead');
const quickTip = document.getElementById('quickTip');

let currentUser = null;
let allTransactions = [];

diagnosticMonth.value = currentMonth();
logoutBtn?.addEventListener('click', () => signOut(auth));
diagnosticMonth?.addEventListener('change', () => setMessage(diagnosticMessage, 'Mês alterado. Clique em “Usar lançamentos” para preencher com esse período.'));
fillFromTransactionsBtn?.addEventListener('click', fillFromTransactions);

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
  }, (error) => {
    console.error(error);
    setMessage(diagnosticMessage, 'Não consegui carregar seus lançamentos agora. Tente novamente em alguns instantes.', 'error');
  });
}

function fillFromTransactions() {
  const month = diagnosticMonth.value || currentMonth();
  const data = allTransactions.filter(item => sameMonth(item.date, month));
  const income = data.filter(item => item.type === 'entrada').reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const expenses = data.filter(item => item.type === 'saida').reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const fixedCategories = ['Moradia', 'Educação', 'Saúde'];
  const fixed = data.filter(item => item.type === 'saida' && fixedCategories.includes(item.category)).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const debt = data.filter(item => item.type === 'saida' && ['Cartão', 'Dívidas'].includes(item.category)).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const variable = Math.max(0, expenses - fixed - debt);
  const savings = Math.max(0, income - expenses);

  document.getElementById('incomeInput').value = income.toFixed(2);
  document.getElementById('fixedInput').value = fixed.toFixed(2);
  document.getElementById('variableInput').value = variable.toFixed(2);
  document.getElementById('debtInput').value = debt.toFixed(2);
  document.getElementById('savingsInput').value = savings.toFixed(2);
  setMessage(diagnosticMessage, data.length ? 'Campos preenchidos com seus lançamentos do mês.' : 'Não encontrei lançamentos nesse mês. Preencha manualmente.', data.length ? 'success' : '');
}

diagnosticForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const input = readInput();
  const result = calculateDiagnostic(input);
  renderDiagnostic(input, result);

  if (currentUser) {
    try {
      await addDoc(collection(db, 'users', currentUser.uid, 'diagnostics'), {
        input,
        result,
        month: diagnosticMonth.value || currentMonth(),
        createdAt: serverTimestamp()
      });
      setMessage(diagnosticMessage, 'Diagnóstico gerado e salvo com sucesso.', 'success');
    } catch (error) {
      console.error(error);
      setMessage(diagnosticMessage, 'Diagnóstico gerado, mas não consegui salvar no histórico agora.', 'error');
    }
  }
});

function readInput() {
  return {
    income: money('incomeInput'),
    fixed: money('fixedInput'),
    variable: money('variableInput'),
    debt: money('debtInput'),
    savings: money('savingsInput'),
    goal: document.getElementById('goalInput').value,
    credit: document.getElementById('creditInput').value,
    behavior: document.getElementById('behaviorInput').value
  };
}

function money(id) {
  return Number(document.getElementById(id).value || 0);
}

function calculateDiagnostic(input) {
  const totalExpenses = input.fixed + input.variable + input.debt;
  const balance = input.income - totalExpenses;
  const incomeBase = Math.max(input.income, 1);
  const savingsRate = balance / incomeBase;
  const debtRatio = input.debt / incomeBase;
  const fixedRatio = input.fixed / incomeBase;
  const variableRatio = input.variable / incomeBase;

  let score = 55;
  if (savingsRate >= 0.20) score += 25;
  else if (savingsRate >= 0.10) score += 15;
  else if (savingsRate >= 0.01) score += 5;
  else score -= 18;

  if (debtRatio > 0.35) score -= 25;
  else if (debtRatio > 0.20) score -= 14;
  else if (debtRatio > 0.05) score -= 6;
  else score += 8;

  if (fixedRatio > 0.60) score -= 10;
  if (variableRatio > 0.45) score -= 10;
  if (input.credit === 'muito') score -= 8;
  if (input.behavior === 'impulso' || input.behavior === 'nao-sei') score -= 8;
  if (input.behavior === 'atraso') score -= 12;
  score = Math.max(0, Math.min(100, Math.round(score)));

  let profile = 'Equilibrado em evolução';
  let summary = 'Você tem base para melhorar com alguns limites simples.';
  if (score < 35) { profile = 'No aperto'; summary = 'O foco agora é parar o vazamento e reorganizar contas.'; }
  else if (score < 55) { profile = 'Gastador por impulso'; summary = 'O dinheiro entra, mas está escapando em categorias variáveis.'; }
  else if (score >= 75 && savingsRate >= 0.15) { profile = 'Organizado'; summary = 'Você já está controlando bem e pode evoluir suas metas.'; }
  else if (score >= 85 && input.goal === 'Começar a investir') { profile = 'Investidor iniciante'; summary = 'Sua base está boa para estudar reserva e investimentos com calma.'; }

  const risks = [
    ['Dívidas', debtRatio],
    ['Gastos fixos', fixedRatio],
    ['Gastos variáveis', variableRatio],
    ['Saldo negativo', balance < 0 ? 1 : 0]
  ].sort((a, b) => b[1] - a[1]);
  const risk = risks[0][0];

  const weeklyLimit = Math.max(0, Math.floor((input.variable * 0.85) / 4));
  const recommendedSaving = Math.max(50, Math.round(input.income * 0.10));
  const goal = input.debt > 0 ? 'Quitar dívidas menores primeiro' : `Guardar ${formatMoney(recommendedSaving)} por mês`;

  const plan = buildPlan(input, { balance, savingsRate, debtRatio, risk, weeklyLimit, recommendedSaving });
  return { score, profile, summary, risk, balance, totalExpenses, savingsRate, debtRatio, fixedRatio, variableRatio, weeklyLimit, goal, plan };
}

function buildPlan(input, data) {
  const plan = [];
  if (data.balance < 0) plan.push(['Dia 1', 'Liste todos os gastos do mês e corte qualquer compra que não seja essencial até virar positivo.']);
  if (input.debt > 0) plan.push(['Dia 2', 'Separe suas dívidas por valor e vencimento. Comece atacando a menor ou a mais atrasada.']);
  if (input.variable > 0) plan.push(['Dia 3', `Defina um limite semanal de ${formatMoney(data.weeklyLimit)} para gastos variáveis.`]);
  if (input.credit !== 'nao') plan.push(['Dia 4', 'Evite parcelar novas compras esta semana. Use o cartão só se já tiver dinheiro separado.']);
  plan.push(['Dia 5', `Separe pelo menos ${formatMoney(Math.max(20, Math.round(input.income * 0.03)))} como primeiro cofrinho de segurança.`]);
  plan.push(['Dia 6', 'Revise mercado, delivery e lazer. Escolha uma categoria para reduzir primeiro.']);
  plan.push(['Dia 7', 'Volte no dashboard e compare: entrou, saiu e sobrou. Ajuste a meta da próxima semana.']);
  return plan.slice(0, 7);
}

function renderDiagnostic(input, result) {
  profileName.textContent = result.profile;
  profileSummary.textContent = result.summary;
  scoreValue.textContent = `${result.score}/100`;
  riskValue.textContent = result.risk;
  suggestedGoal.textContent = result.goal;
  quickTip.textContent = result.balance < 0
    ? 'Primeira missão: deixar o mês positivo antes de pensar em novos gastos.'
    : `Boa: sobrou ${formatMoney(result.balance)}. Transforme parte disso em meta automática.`;

  actionPlan.className = 'idea-list compact';
  actionPlan.innerHTML = result.plan.map(([title, text]) => `<div><strong>${title}</strong><span>${text}</span></div>`).join('');

  const totals = categoryTotals(allTransactions.filter(item => sameMonth(item.date, diagnosticMonth.value || currentMonth())));
  const top = Object.entries(totals).sort((a, b) => b[1] - a[1])[0];
  budgetRead.className = 'diagnostic-result';
  budgetRead.innerHTML = `
    <div><span>Renda</span><strong>${formatMoney(input.income)}</strong></div>
    <div><span>Gastos totais</span><strong>${formatMoney(result.totalExpenses)}</strong></div>
    <div><span>Saldo estimado</span><strong>${formatMoney(result.balance)}</strong></div>
    <div><span>Taxa de sobra</span><strong>${Math.round(result.savingsRate * 100)}%</strong></div>
    <p>${top ? `Pelos lançamentos, a categoria que mais pesou foi <b>${top[0]}</b> com ${formatMoney(top[1])}.` : 'Quando você cadastrar transações, o VIGO também identifica a categoria que mais pesa.'}</p>
  `;
}
