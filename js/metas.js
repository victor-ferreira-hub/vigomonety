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
  serverTimestamp,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { formatMoney, setMessage } from './helpers.js';

const logoutBtn = document.getElementById('logoutBtn');
const goalForm = document.getElementById('goalForm');
const goalMessage = document.getElementById('goalMessage');
const goalsList = document.getElementById('goalsList');
let currentUser = null;

logoutBtn?.addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, (user) => {
  if (!user) {
    location.href = 'login.html';
    return;
  }
  currentUser = user;
  listenGoals(user.uid);
});

goalForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!currentUser) return;

  const payload = {
    title: document.getElementById('goalTitle').value.trim(),
    targetAmount: Number(document.getElementById('goalTarget').value),
    currentAmount: Number(document.getElementById('goalCurrent').value || 0),
    deadline: document.getElementById('goalDeadline').value || '',
    createdAt: serverTimestamp()
  };

  try {
    await addDoc(collection(db, 'users', currentUser.uid, 'goals'), payload);
    goalForm.reset();
    document.getElementById('goalCurrent').value = 0;
    setMessage(goalMessage, 'Meta criada com sucesso.', 'success');
    setTimeout(() => setMessage(goalMessage, ''), 2500);
  } catch (error) {
    console.error(error);
    setMessage(goalMessage, 'Erro ao criar meta. Confira as regras do Firestore.', 'error');
  }
});

function listenGoals(uid) {
  const goalsRef = collection(db, 'users', uid, 'goals');
  const q = query(goalsRef, orderBy('createdAt', 'desc'));
  onSnapshot(q, (snapshot) => {
    const goals = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    renderGoals(goals);
  }, (error) => {
    console.error(error);
    goalsList.className = 'goals-list empty-state';
    goalsList.textContent = 'Erro ao carregar metas. Confira as regras do Firestore.';
  });
}

function renderGoals(goals) {
  if (!goals.length) {
    goalsList.className = 'goals-list empty-state';
    goalsList.textContent = 'Nenhuma meta criada ainda.';
    return;
  }
  goalsList.className = 'goals-list';
  goalsList.innerHTML = goals.map(goal => {
    const target = Number(goal.targetAmount || 0);
    const current = Number(goal.currentAmount || 0);
    const percent = target > 0 ? Math.min(100, (current / target) * 100) : 0;
    return `
      <article class="goal-card">
        <div class="goal-card-header">
          <div>
            <h3>${escapeHtml(goal.title)}</h3>
            <div class="goal-meta">
              <span>${formatMoney(current)} de ${formatMoney(target)}</span>
              <span>${goal.deadline ? `Até ${formatDate(goal.deadline)}` : 'Sem prazo'}</span>
              <span>${percent.toFixed(0)}%</span>
            </div>
          </div>
          <button class="delete-btn" onclick="deleteGoal('${goal.id}')">Excluir</button>
        </div>
        <div class="progress"><span style="width: ${percent}%"></span></div>
        <div class="goal-actions">
          <div>
            <label for="goal-${goal.id}">Atualizar valor atual</label>
            <input id="goal-${goal.id}" type="number" min="0" step="0.01" value="${current}" />
          </div>
          <button class="small-btn" onclick="updateGoal('${goal.id}')">Atualizar</button>
        </div>
      </article>
    `;
  }).join('');
}

window.updateGoal = async function updateGoal(id) {
  if (!currentUser) return;
  const input = document.getElementById(`goal-${id}`);
  await updateDoc(doc(db, 'users', currentUser.uid, 'goals', id), {
    currentAmount: Number(input.value || 0)
  });
};

window.deleteGoal = async function deleteGoal(id) {
  if (!currentUser || !confirm('Excluir essa meta?')) return;
  await deleteDoc(doc(db, 'users', currentUser.uid, 'goals', id));
};

function formatDate(date) {
  const [year, month, day] = String(date).split('-');
  return `${day}/${month}/${year}`;
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}
