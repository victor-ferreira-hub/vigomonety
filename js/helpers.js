export const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatMoney(value) {
  return currency.format(Number(value || 0));
}

export function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function todayISO() {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

export function sameMonth(dateValue, monthValue) {
  return String(dateValue || '').slice(0, 7) === monthValue;
}

export function setMessage(element, text, type = '') {
  if (!element) return;
  element.textContent = text;
  element.className = `form-message ${type}`.trim();
}

export function categoryTotals(transactions) {
  return transactions
    .filter(item => item.type === 'saida')
    .reduce((acc, item) => {
      const category = item.category || 'Outros';
      acc[category] = (acc[category] || 0) + Number(item.amount || 0);
      return acc;
    }, {});
}

export function renderCategoryChart(container, totals) {
  if (!container) return;
  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  if (!entries.length) {
    container.className = 'category-chart empty-state';
    container.textContent = 'Nenhum gasto cadastrado neste mês.';
    return;
  }
  container.className = 'category-chart';
  const max = entries[0][1] || 1;
  container.innerHTML = entries.map(([category, total]) => `
    <div class="category-row">
      <strong>${category}</strong>
      <div class="bar"><span style="width: ${Math.max(8, (total / max) * 100)}%"></span></div>
      <small>${formatMoney(total)}</small>
    </div>
  `).join('');
}

export function downloadTextFile(filename, content, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
