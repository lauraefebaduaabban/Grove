/* ==========================================================================
   GROVE — Application logic
   ========================================================================== */

/* ---------------------------------------------------------------------
   CONSTANTS
--------------------------------------------------------------------- */
const FINANCE_KEY = 'grove_finance_state_v1';

const CURRENCIES = [
  { code: 'GHS', symbol: '₵', name: 'Ghanaian Cedi' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira' },
];

const CATEGORIES = ['Food', 'Transport', 'Housing', 'Bills', 'Shopping', 'Education', 'Health', 'Entertainment', 'Salary', 'Business', 'Other'];
const EXPENSE_CHART_CATEGORIES = ['Food', 'Transport', 'Housing', 'Bills', 'Shopping', 'Education', 'Health', 'Entertainment', 'Business', 'Other'];

const CATEGORY_COLORS = {
  Food: '#B4924C', Transport: '#5B8A72', Housing: '#163A32', Bills: '#9A3324',
  Shopping: '#7A6BAF', Education: '#3B7EA1', Health: '#C97A55', Entertainment: '#4E7B96',
  Business: '#6E7B5B', Other: '#8C8577'
};

const ASSET_TYPES = ['Cash', 'Bank account', 'Mobile money', 'Savings', 'Investments', 'Stocks', 'Crypto', 'Other asset'];
const LIABILITY_TYPES = ['Loan', 'Credit / debt', 'Other liability'];
const RECURRING_FREQUENCIES = ['daily', 'weekly', 'monthly', 'yearly'];
const FREQUENCY_LABELS = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' };
const BILL_CATEGORIES = ['Rent', 'Electricity', 'Water', 'Internet', 'DSTV / Subscriptions', 'School fees', 'Insurance', 'Phone plan', 'Other'];

function defaultState() {
  return {
    currency: 'GHS',
    transactions: [],
    budgets: [],
    goals: [],
    emergencyFund: { target: 0, current: 0 },
    assets: [],
    liabilities: [],
    netWorthHistory: [],
    recurringTransactions: [],
    bills: []
  };
}

/* ---------------------------------------------------------------------
   STATE / STORAGE
--------------------------------------------------------------------- */
let state = loadState();
let activeView = 'dashboard';
let dashChart = null, ovIeChart = null, ovCatChart = null;
let activeTxType = 'income';

function loadState() {
  try {
    const raw = localStorage.getItem(FINANCE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    const base = defaultState();
    return {
      currency: parsed.currency && CURRENCIES.some(c => c.code === parsed.currency) ? parsed.currency : base.currency,
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
      budgets: Array.isArray(parsed.budgets) ? parsed.budgets : [],
      goals: Array.isArray(parsed.goals) ? parsed.goals : [],
      emergencyFund: parsed.emergencyFund && typeof parsed.emergencyFund === 'object'
        ? { target: Number(parsed.emergencyFund.target) || 0, current: Number(parsed.emergencyFund.current) || 0 }
        : base.emergencyFund,
      assets: Array.isArray(parsed.assets) ? parsed.assets : base.assets,
      liabilities: Array.isArray(parsed.liabilities) ? parsed.liabilities : base.liabilities,
      netWorthHistory: Array.isArray(parsed.netWorthHistory) ? parsed.netWorthHistory : base.netWorthHistory,
      recurringTransactions: Array.isArray(parsed.recurringTransactions) ? parsed.recurringTransactions : base.recurringTransactions,
      bills: Array.isArray(parsed.bills) ? parsed.bills : base.bills
    };
  } catch (e) {
    console.warn('Grove: finance state was unreadable, starting fresh.', e);
    return defaultState();
  }
}

function saveState() {
  try {
    localStorage.setItem(FINANCE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Grove: could not save finance state.', e);
  }
}

function uid() {
  return 'id_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* ---------------------------------------------------------------------
   CURRENCY
--------------------------------------------------------------------- */
function currentCurrency() {
  return CURRENCIES.find(c => c.code === state.currency) || CURRENCIES[0];
}
function formatMoney(amount) {
  const n = Number(amount) || 0;
  const symbol = currentCurrency().symbol;
  const formatted = Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (n < 0 ? '-' : '') + symbol + formatted;
}

function renderCurrencyMenu() {
  const menu = document.getElementById('currency-menu');
  menu.innerHTML = CURRENCIES.map(c => `
    <button class="currency-option ${c.code === state.currency ? 'is-selected' : ''}" data-currency="${c.code}">
      <span class="currency-symbol">${c.symbol}</span> ${c.name} (${c.code})
    </button>
  `).join('');
  document.getElementById('currency-toggle-symbol').textContent = currentCurrency().symbol;
}

function renderSettingsCurrencyGrid() {
  const grid = document.getElementById('settings-currency-grid');
  grid.innerHTML = CURRENCIES.map(c => `
    <label class="currency-radio ${c.code === state.currency ? 'is-selected' : ''}" data-currency-radio="${c.code}">
      <input type="radio" name="settings-currency" value="${c.code}" ${c.code === state.currency ? 'checked' : ''} class="sr-only">
      <span class="currency-symbol">${c.symbol}</span> ${c.name} (${c.code})
    </label>
  `).join('');
}

function setCurrency(code) {
  if (!CURRENCIES.some(c => c.code === code)) return;
  state.currency = code;
  saveState();
  renderCurrencyMenu();
  renderSettingsCurrencyGrid();
  renderAll();
}

/* ---------------------------------------------------------------------
   APPEARANCE / THEME
--------------------------------------------------------------------- */
function applyTheme(theme) {
  const selectedTheme = theme === 'dark' ? 'dark' : 'light';

  document.documentElement.setAttribute('data-theme', selectedTheme);
  localStorage.setItem('grove-theme', selectedTheme);

  const lightBtn = document.getElementById('theme-light');
  const darkBtn = document.getElementById('theme-dark');

  if (lightBtn) {
    lightBtn.classList.toggle('is-selected', selectedTheme === 'light');
  }

  if (darkBtn) {
    darkBtn.classList.toggle('is-selected', selectedTheme === 'dark');
  }
}

function initTheme() {
  const savedTheme = localStorage.getItem('grove-theme') || 'light';
  applyTheme(savedTheme);
}

/* ---------------------------------------------------------------------
   DERIVED FINANCE DATA
--------------------------------------------------------------------- */
function totalIncome() {
  return state.transactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
}
function totalExpenses() {
  return state.transactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
}
function currentBalance() { return totalIncome() - totalExpenses(); }
function savingsRate() {
  const income = totalIncome();
  if (income <= 0) return 0;
  return Math.round(((income - totalExpenses()) / income) * 100);
}
function spendingByCategory() {
  const map = {};
  state.transactions.filter(t => t.type === 'expense').forEach(t => {
    map[t.category] = (map[t.category] || 0) + Number(t.amount);
  });
  return map;
}
function categorySpent(category) {
  return state.transactions
    .filter(t => t.type === 'expense' && t.category === category)
    .reduce((s, t) => s + Number(t.amount), 0);
}
function recentTransactions(limit) {
  return [...state.transactions]
    .sort((a, b) => new Date(b.date) - new Date(a.date) || (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, limit || 5);
}

/* ---------------------------------------------------------------------
   DATE HELPERS (shared by recurring transactions, bills, calendar)
--------------------------------------------------------------------- */
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function parseDate(str) {
  return new Date(str + 'T00:00:00');
}
function toDateStr(d) {
  return d.toISOString().slice(0, 10);
}
function addInterval(dateStr, frequency, steps) {
  steps = steps || 1;
  const d = parseDate(dateStr);
  if (frequency === 'daily') d.setDate(d.getDate() + steps);
  else if (frequency === 'weekly') d.setDate(d.getDate() + 7 * steps);
  else if (frequency === 'monthly') d.setMonth(d.getMonth() + steps);
  else if (frequency === 'yearly') d.setFullYear(d.getFullYear() + steps);
  return toDateStr(d);
}
function daysBetween(a, b) {
  return Math.round((parseDate(b) - parseDate(a)) / 86400000);
}

/* ---------------------------------------------------------------------
   NET WORTH
--------------------------------------------------------------------- */
function totalManualAssets() {
  return state.assets.reduce((s, a) => s + (Number(a.amount) || 0), 0);
}
function totalLiabilities() {
  return state.liabilities.reduce((s, l) => s + (Number(l.amount) || 0), 0);
}
// Linked, read-only contributions from existing Grove data — shown for context but
// not stored as separate assets, so nothing here is ever double-counted with
// anything the user enters manually in Net Worth.
function linkedAssetLines() {
  const lines = [];
  if (state.emergencyFund && state.emergencyFund.current > 0) {
    lines.push({ label: 'Emergency fund', amount: state.emergencyFund.current, source: 'Emergency Fund' });
  }
  
  return lines;
}
function totalLinkedAssets() {
  return linkedAssetLines().reduce((s, l) => s + l.amount, 0);
}
function totalAssets() {
  return totalManualAssets() + totalLinkedAssets();
}
function currentNetWorth() {
  return totalAssets() - totalLiabilities();
}
// Record (or update) today's net worth snapshot. Called whenever assets,
// liabilities, the emergency fund, or goal balances change, so history is
// always built from real recorded data — never fabricated.
function snapshotNetWorth() {
  const today = todayStr();
  const value = currentNetWorth();
  const existing = state.netWorthHistory.find(h => h.date === today);
  if (existing) existing.value = value;
  else state.netWorthHistory.push({ date: today, value });
  state.netWorthHistory.sort((a, b) => new Date(a.date) - new Date(b.date));
}

/* ---------------------------------------------------------------------
   RECURRING TRANSACTIONS
--------------------------------------------------------------------- */
function computeNextOccurrence(rt, fromDate) {
  // Smallest occurrence date >= fromDate, on/after startDate.
  let next = rt.startDate;
  if (next >= fromDate) return next;
  if (rt.frequency === 'daily' || rt.frequency === 'weekly') {
    const unitDays = rt.frequency === 'daily' ? 1 : 7;
    const steps = Math.ceil(daysBetween(next, fromDate) / unitDays);
    next = addInterval(next, rt.frequency, steps);
  } else {
    let guard = 0;
    while (next < fromDate && guard < 5000) {
      next = addInterval(next, rt.frequency, 1);
      guard++;
    }
  }
  return next;
}
function recurringIsExpired(rt) {
  return rt.endDate && rt.nextDate > rt.endDate;
}
// Generates real transaction rows for any occurrence whose date has arrived
// (nextDate <= today). Bounded by elapsed time only — never generates future
// or endless duplicates. Existing transactions are left untouched.
function generateDueRecurringTransactions() {
  const today = todayStr();
  let changed = false;
  state.recurringTransactions.forEach(rt => {
    if (!rt.active) return;
    let guard = 0;
    while (rt.nextDate <= today && !recurringIsExpired(rt) && guard < 1000) {
      state.transactions.push({
        id: uid(),
        description: rt.description,
        amount: rt.amount,
        date: rt.nextDate,
        category: rt.category,
        note: 'Recurring: ' + rt.description,
        type: rt.type,
        createdAt: Date.now(),
        recurringId: rt.id
      });
      rt.lastGeneratedDate = rt.nextDate;
      rt.nextDate = addInterval(rt.nextDate, rt.frequency, 1);
      changed = true;
      guard++;
    }
    if (recurringIsExpired(rt)) rt.active = false;
  });
  if (changed) saveState();
}
function activeRecurringTransactions() {
  return state.recurringTransactions.filter(r => r.active);
}

/* ---------------------------------------------------------------------
   BILLS & SUBSCRIPTIONS
--------------------------------------------------------------------- */
function billStatus(bill) {
  if (bill.paid) return 'paid';
  const today = todayStr();
  if (bill.dueDate < today) return 'overdue';
  if (daysBetween(today, bill.dueDate) <= 7) return 'due-soon';
  return 'upcoming';
}
const BILL_STATUS_LABELS = { upcoming: 'Upcoming', 'due-soon': 'Due soon', paid: 'Paid', overdue: 'Overdue' };
function markBillPaid(id) {
  const bill = state.bills.find(b => b.id === id);
  if (!bill) return;
  if (bill.frequency && bill.frequency !== 'one-time') {
    bill.history = bill.history || [];
    bill.history.push(bill.dueDate);
    bill.dueDate = addInterval(bill.dueDate, bill.frequency, 1);
    bill.paid = false;
  } else {
    bill.paid = true;
    bill.paidDate = todayStr();
  }
  saveState();
  renderAll();
}
function markBillUnpaid(id) {
  const bill = state.bills.find(b => b.id === id);
  if (!bill) return;
  bill.paid = false;
  bill.paidDate = null;
  saveState();
  renderAll();
}
function upcomingBills(limit) {
  return [...state.bills]
    .filter(b => !b.paid)
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, limit || state.bills.length);
}
function monthlyRecurringSubscriptionCost() {
  // Bills that recur monthly (or normalized to a monthly-equivalent), used as
  // a "monthly recurring subscription cost" figure.
  return state.bills.reduce((sum, b) => {
    if (!b.frequency || b.frequency === 'one-time') return sum;
    const amt = Number(b.amount) || 0;
    if (b.frequency === 'monthly') return sum + amt;
    if (b.frequency === 'weekly') return sum + amt * 4.345;
    if (b.frequency === 'yearly') return sum + amt / 12;
    if (b.frequency === 'daily') return sum + amt * 30.44;
    return sum;
  }, 0);
}

/* ---------------------------------------------------------------------
   FINANCIAL CALENDAR
--------------------------------------------------------------------- */
// Builds real events for a given month (no fabricated data): bill due dates,
// and recurring transaction occurrences projected forward from nextDate.
function calendarEventsForMonth(year, month) {
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);
  const startStr = toDateStr(monthStart), endStr = toDateStr(monthEnd);
  const events = [];

  state.bills.forEach(b => {
    if (b.dueDate >= startStr && b.dueDate <= endStr) {
      events.push({ date: b.dueDate, type: 'bill', title: b.name, amount: b.amount, detail: `Bill · ${BILL_STATUS_LABELS[billStatus(b)]}` });
    }
  });

  state.recurringTransactions.forEach(rt => {
    if (!rt.active) return;
    let d = rt.nextDate;
    let guard = 0;
    while (d <= endStr && !(rt.endDate && d > rt.endDate) && guard < 500) {
      if (d >= startStr) {
        events.push({
          date: d, type: rt.type === 'income' ? 'income' : 'expense', title: rt.description, amount: rt.amount,
          detail: `${rt.type === 'income' ? 'Recurring income' : 'Recurring expense'} · ${FREQUENCY_LABELS[rt.frequency]}`
        });
      }
      d = addInterval(d, rt.frequency, 1);
      guard++;
    }
  });

  return events.sort((a, b) => a.date.localeCompare(b.date));
}

/* ---------------------------------------------------------------------
   VIEW NAVIGATION
--------------------------------------------------------------------- */
function goToView(view) {
  activeView = view;
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('is-active', v.dataset.view === view));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('is-active', n.dataset.view === view));
  document.querySelectorAll('.bottom-nav-item').forEach(n => n.classList.toggle('is-active', n.dataset.view === view));
  closeAppDrawer();
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  renderView(view);
}

function renderView(view) {
  if (view === 'dashboard') renderDashboard();
  else if (view === 'transactions') renderTransactionsView();
  else if (view === 'budgets') renderBudgetsView();
  else if (view === 'goals') renderGoalsView();
  else if (view === 'emergency') renderEmergencyView();
  else if (view === 'overview') renderOverviewView();
  else if (view === 'insights') renderInsightsView();
  else if (view === 'networth') renderNetWorthView();
  else if (view === 'recurring') renderRecurringView();
  else if (view === 'bills') renderBillsView();
  else if (view === 'reports') renderReportsView();
  else if (view === 'calendar') renderCalendarView();
  else if (view === 'settings') renderSettingsView();
}

function renderAll() {
  renderView(activeView);
}

/* ---------------------------------------------------------------------
   TRANSACTION ROW HELPERS
--------------------------------------------------------------------- */
function txRowHTML(t) {
  const sign = t.type === 'income' ? '+' : '\u2212';
  return `
    <div class="tx-row" data-tx-id="${t.id}">
      <div class="tx-indicator ${t.type}">${sign}</div>
      <div>
        <div class="tx-desc">${escapeHTML(t.description)}</div>
        <div class="tx-meta">${escapeHTML(t.category)} · ${formatDate(t.date)}</div>
      </div>
      <div>
        <div class="tx-amount ${t.type}">${sign}${formatMoney(t.amount)}</div>
      </div>
    </div>`;
}
function escapeHTML(str) {
  const d = document.createElement('div');
  d.textContent = str == null ? '' : String(str);
  return d.innerHTML;
}
function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/* ---------------------------------------------------------------------
   DASHBOARD
--------------------------------------------------------------------- */
function renderDashboard() {
  document.getElementById('dash-balance').textContent = formatMoney(currentBalance());
  document.getElementById('dash-balance').classList.toggle('negative', currentBalance() < 0);
  document.getElementById('dash-income').textContent = formatMoney(totalIncome());
  document.getElementById('dash-expenses').textContent = formatMoney(totalExpenses());
  document.getElementById('dash-savings-rate').textContent = savingsRate() + '%';

  renderMotivation();
  renderAlertStack('dash-alerts');

  const spend = spendingByCategory();
  const hasSpend = Object.keys(spend).length > 0;
  document.getElementById('dash-spending-empty').classList.toggle('hidden', hasSpend);
  document.getElementById('dash-spending-chart-wrap').classList.toggle('hidden', !hasSpend);
  if (hasSpend) renderSimpleCategoryChart('dash-spending-chart', spend, 'dash');

  const recent = recentTransactions(5);
  const txList = document.getElementById('dash-tx-list');
  document.getElementById('dash-tx-empty').classList.toggle('hidden', recent.length > 0);
  txList.innerHTML = recent.map(txRowHTML).join('');

  const insights = buildInsights();
  document.getElementById('dash-insights-empty').classList.toggle('hidden', insights.length > 0);
  document.getElementById('dash-insights-list').innerHTML = insights.slice(0, 4).map(i => `
    <div class="insight-item"><div class="insight-dot"></div><p>${escapeHTML(i)}</p></div>
  `).join('');

  const nwEl = document.getElementById('dash-net-worth');
  nwEl.textContent = formatMoney(currentNetWorth());
  nwEl.classList.toggle('negative', currentNetWorth() < 0);

  const dueBills = upcomingBills(4);
  document.getElementById('dash-bills-empty').classList.toggle('hidden', dueBills.length > 0);
  document.getElementById('dash-bills-list').innerHTML = dueBills.map(b => {
    const status = billStatus(b);
    return `
    <div class="nw-row">
      <div class="nw-row-main">
        <div class="nw-row-name">${escapeHTML(b.name)}</div>
        <div class="nw-row-meta">Due ${formatDate(b.dueDate)}</div>
      </div>
      <span class="bill-status-pill ${status}">${BILL_STATUS_LABELS[status]}</span>
    </div>`;
  }).join('');
}

let chartInstances = {};
// Legend container ids matching each doughnut chart's canvas id, used so
// the legend can show percentages (Chart.js's built-in legend cannot).
const DOUGHNUT_LEGEND_IDS = {
  'dash-spending-chart': 'dash-spending-legend',
  'ov-cat-chart': 'ov-cat-legend',
  'rep-cat-chart': 'rep-cat-legend'
};

function renderSimpleBarComparison(canvasId, income, expenses) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const wrap = canvas.closest('.chart-wrap');
  if (!wrap) return;

  const incomeValue = Number(income) || 0;
  const expenseValue = Number(expenses) || 0;
  const maxValue = Math.max(incomeValue, expenseValue, 1);

  canvas.style.display = 'none';

  let chart = wrap.querySelector('.simple-bar-chart');

  if (!chart) {
    chart = document.createElement('div');
    chart.className = 'simple-bar-chart';
    wrap.appendChild(chart);
  }

  chart.innerHTML = `
    <div class="simple-bar-item">
      <div class="simple-bar-value">${formatMoney(incomeValue)}</div>
      <div class="simple-bar-track">
        <div class="simple-bar-fill income"
             style="height:${(incomeValue / maxValue) * 100}%"></div>
      </div>
      <div class="simple-bar-label">Income</div>
    </div>

    <div class="simple-bar-item">
      <div class="simple-bar-value">${formatMoney(expenseValue)}</div>
      <div class="simple-bar-track">
        <div class="simple-bar-fill expense"
             style="height:${(expenseValue / maxValue) * 100}%"></div>
      </div>
      <div class="simple-bar-label">Expenses</div>
    </div>
  `;
}

function renderSimpleCategoryChart(canvasId, dataMap, keyPrefix) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const wrap = canvas.closest('.chart-wrap');
  if (!wrap) return;

  const entries = Object.entries(dataMap)
    .map(([label, value]) => [label, Number(value) || 0])
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1]);

  const total = entries.reduce((sum, [, value]) => sum + value, 0);

  canvas.style.display = 'none';

  let chart = wrap.querySelector('.simple-category-chart');

  if (!chart) {
    chart = document.createElement('div');
    chart.className = 'simple-category-chart';
    wrap.appendChild(chart);
  }

  chart.innerHTML = entries.map(([label, value]) => {
    const pct = total > 0 ? Math.round((value / total) * 100) : 0;
    const color = CATEGORY_COLORS[label] || '#8C8577';

    return `
      <div class="simple-category-row">
        <div class="simple-category-top">
          <span class="simple-category-name">
            <span class="simple-category-dot" style="background:${color}"></span>
            ${escapeHTML(label)}
          </span>
          <span class="simple-category-amount">
            ${formatMoney(value)} · ${pct}%
          </span>
        </div>
        <div class="simple-category-track">
          <div class="simple-category-fill" style="width:${pct}%; background:${color}"></div>
        </div>
      </div>
    `;
  }).join('');
}

function renderDoughnut(canvasId, dataMap, keyPrefix) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || typeof Chart === 'undefined') return;

  const wrap = canvas.closest('.chart-wrap') || canvas.parentElement;
  const legendEl = document.getElementById(DOUGHNUT_LEGEND_IDS[canvasId] || '');
  const labels = Object.keys(dataMap);
  const data = Object.values(dataMap).map(Number);
  const total = data.reduce((s, v) => s + v, 0);

  const key = keyPrefix + '-doughnut';

  if (chartInstances[key]) {
    chartInstances[key].destroy();
    chartInstances[key] = null;
  }

  if (!labels.length || !data.some(value => value > 0)) {
    if (wrap) wrap.classList.add('is-empty');
    if (legendEl) legendEl.innerHTML = '';
    return;
  }

  if (wrap) wrap.classList.remove('is-empty');

  const colors = labels.map(label => CATEGORY_COLORS[label] || '#8C8577');

  chartInstances[key] = new Chart(canvas.getContext('2d'), {
    type: 'pie',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderColor: '#FBF8F1',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        // The custom legend below (with percentages) replaces the built-in
        // one, so it stays off to avoid showing two legends.
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const pct = total > 0 ? Math.round((Number(ctx.raw) / total) * 100) : 0;
              return `${ctx.label}: ${formatMoney(ctx.raw)} (${pct}%)`;
            }
          }
        }
      }
    }
  });

  if (legendEl) {
    // Build a legend that always shows category name + real percentage,
    // calculated straight from the same data the chart renders.
    legendEl.innerHTML = labels.map((label, i) => {
      const pct = total > 0 ? Math.round((data[i] / total) * 100) : 0;
      return `
        <div class="chart-legend-item">
          <span class="chart-legend-swatch" style="background:${colors[i]}"></span>
          <span class="chart-legend-label">${escapeHTML(label)}</span>
          <span class="chart-legend-pct">${pct}%</span>
        </div>`;
    }).join('');
  }
}

function renderReportComparison(canvasId, income, expenses) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const wrap = canvas.closest('.chart-wrap');
  if (!wrap) return;

  const incomeValue = Number(income) || 0;
  const expenseValue = Number(expenses) || 0;
  const maxValue = Math.max(incomeValue, expenseValue, 1);

  canvas.style.display = 'none';

  let chart = wrap.querySelector('.report-comparison-chart');

  if (!chart) {
    chart = document.createElement('div');
    chart.className = 'report-comparison-chart';
    wrap.appendChild(chart);
  }

  chart.innerHTML = `
    <div class="report-comparison-row">
      <div class="report-comparison-header">
        <span>Income</span>
        <strong>${formatMoney(incomeValue)}</strong>
      </div>

      <div class="report-comparison-track">
        <div class="report-comparison-fill income"
             style="width:${(incomeValue / maxValue) * 100}%"></div>
      </div>
    </div>

    <div class="report-comparison-row">
      <div class="report-comparison-header">
        <span>Expenses</span>
        <strong>${formatMoney(expenseValue)}</strong>
      </div>

      <div class="report-comparison-track">
        <div class="report-comparison-fill expense"
             style="width:${(expenseValue / maxValue) * 100}%"></div>
      </div>
    </div>
  `;
}

// Keep charts responsive across screen sizes and orientation changes.
let resizeRaf = null;

window.addEventListener('resize', () => {
  if (resizeRaf) cancelAnimationFrame(resizeRaf);

  resizeRaf = requestAnimationFrame(() => {
    Object.values(chartInstances).forEach(chart => {
      if (chart) chart.resize();
    });
  });
});

/* ---------------------------------------------------------------------
   TRANSACTIONS VIEW
--------------------------------------------------------------------- */
function populateFilterOptions() {
  const catSelect = document.getElementById('tx-filter-category');
  const prevCategory = catSelect.value;
  catSelect.innerHTML = '<option value="">All categories</option>' + CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('');
  // Restore the user's previous selection — rebuilding the option list must
  // never silently reset an active filter back to "All categories".
  if (prevCategory && CATEGORIES.includes(prevCategory)) catSelect.value = prevCategory;

  const months = [...new Set(state.transactions.map(t => t.date.slice(0, 7)))].sort().reverse();
  const monthSelect = document.getElementById('tx-filter-month');
  const prevMonth = monthSelect.value;
  monthSelect.innerHTML = '<option value="">All months</option>' + months.map(m => {
    const d = new Date(m + '-01T00:00:00');
    const label = d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    return `<option value="${m}">${label}</option>`;
  }).join('');
  // Same fix for the month filter — keep the active month selected.
  if (prevMonth && months.includes(prevMonth)) monthSelect.value = prevMonth;
}

function filteredTransactions() {
  const search = (document.getElementById('tx-search').value || '').trim().toLowerCase();
  const type = document.getElementById('tx-filter-type').value;
  const category = document.getElementById('tx-filter-category').value;
  const month = document.getElementById('tx-filter-month').value;

  return [...state.transactions]
    .filter(t => !search || t.description.toLowerCase().includes(search) || t.category.toLowerCase().includes(search))
    .filter(t => !type || t.type === type)
    .filter(t => !category || t.category === category)
    .filter(t => !month || t.date.slice(0, 7) === month)
    .sort((a, b) => new Date(b.date) - new Date(a.date) || (b.createdAt || 0) - (a.createdAt || 0));
}

function renderTransactionsView() {
  populateFilterOptions();
  const list = filteredTransactions();
  const hasAny = state.transactions.length > 0;
  const hasResults = list.length > 0;

  document.getElementById('tx-empty').classList.toggle('hidden', hasAny);
  document.getElementById('tx-no-results').classList.toggle('hidden', !hasAny || hasResults);
  document.getElementById('tx-table-panel').classList.toggle('hidden', !hasResults);

  const tbody = document.getElementById('tx-table-body');
  const mobileWrap = document.getElementById('tx-table-mobile');

  tbody.innerHTML = list.map(t => `
    <tr data-tx-id="${t.id}">
      <td>${escapeHTML(t.description)}${t.note ? `<div class="tx-meta">${escapeHTML(t.note)}</div>` : ''}</td>
      <td><span class="pill">${escapeHTML(t.category)}</span></td>
      <td>${formatDate(t.date)}</td>
      <td class="tx-amount ${t.type}">${t.type === 'income' ? '+' : '\u2212'}${formatMoney(t.amount)}</td>
      <td><div class="row-actions">
        <button class="btn-icon" data-edit-tx="${t.id}" aria-label="Edit">✎</button>
        <button class="btn-icon" data-delete-tx="${t.id}" aria-label="Delete">🗑</button>
      </div></td>
    </tr>
  `).join('');

  mobileWrap.innerHTML = list.map(t => `
    <div class="tx-card-mobile" data-tx-id="${t.id}">
      <div class="tx-card-mobile-top">
        <strong>${escapeHTML(t.description)}</strong>
        <span class="tx-amount ${t.type}">${t.type === 'income' ? '+' : '\u2212'}${formatMoney(t.amount)}</span>
      </div>
      <div class="tx-meta">${escapeHTML(t.category)} · ${formatDate(t.date)}</div>
      <div class="tx-actions-inline">
        <button class="btn-icon" data-edit-tx="${t.id}" aria-label="Edit">✎</button>
        <button class="btn-icon" data-delete-tx="${t.id}" aria-label="Delete">🗑</button>
      </div>
    </div>
  `).join('');
}

/* ---------------------------------------------------------------------
   BUDGETS VIEW
--------------------------------------------------------------------- */
function renderBudgetsView() {
  renderAlertStack('budgets-alerts');
  const hasAny = state.budgets.length > 0;
  document.getElementById('budgets-empty').classList.toggle('hidden', hasAny);
  const grid = document.getElementById('budgets-grid');
  grid.innerHTML = state.budgets.map(b => {
    const spent = categorySpent(b.category);
    const pct = b.amount > 0 ? Math.min(100, Math.round((spent / b.amount) * 100)) : 0;
    const over = spent > b.amount;
    return `
    <div class="budget-card" data-budget-id="${b.id}">
      <div class="budget-card-head">
        <h4>${escapeHTML(b.category)}</h4>
        <div class="row-actions">
          <button class="btn-icon" data-edit-budget="${b.id}" aria-label="Edit budget">✎</button>
          <button class="btn-icon" data-delete-budget="${b.id}" aria-label="Delete budget">🗑</button>
        </div>
      </div>
      <div class="budget-figures"><span>${formatMoney(spent)} spent</span><span>of ${formatMoney(b.amount)}</span></div>
      <div class="progress-track"><div class="progress-fill ${over ? 'over' : ''}" style="width:${Math.min(100, (spent / (b.amount || 1)) * 100)}%"></div></div>
      <div class="budget-status ${over ? 'over' : ''}">${over ? `Over budget by ${formatMoney(spent - b.amount)}` : `${pct}% used`}</div>
    </div>`;
  }).join('');
}

/* ---------------------------------------------------------------------
   GOALS VIEW
--------------------------------------------------------------------- */
function renderGoalsView() {
  const hasAny = state.goals.length > 0;
  document.getElementById('goals-empty').classList.toggle('hidden', hasAny);
  const grid = document.getElementById('goals-grid');
  grid.innerHTML = state.goals.map(g => {
    const pct = g.target > 0 ? Math.min(100, Math.round((g.current / g.target) * 100)) : 0;
    return `
    <div class="goal-card" data-goal-id="${g.id}">
      <div class="goal-card-head">
        <h4>${escapeHTML(g.name)}</h4>
        <button class="btn-icon" data-delete-goal="${g.id}" aria-label="Delete goal">🗑</button>
      </div>
      <div class="goal-amounts">${formatMoney(g.current)} <span>of ${formatMoney(g.target)}</span></div>
      <div class="progress-track"><div class="progress-fill gold" style="width:${pct}%"></div></div>
      <div class="budget-status">${pct}% complete</div>
      <div class="goal-actions">
        <button class="btn btn-outline btn-sm" data-add-contribution="${g.id}">+ Add money</button>
      </div>
    </div>`;
  }).join('');
}

/* ---------------------------------------------------------------------
   EMERGENCY FUND VIEW
--------------------------------------------------------------------- */
function renderEmergencyView() {
  const ef = state.emergencyFund;
  const hasTarget = ef.target > 0;
  document.getElementById('ef-empty').classList.toggle('hidden', hasTarget);
  document.getElementById('ef-content').classList.toggle('hidden', !hasTarget);
  document.getElementById('delete-ef-btn').classList.toggle('hidden', !hasTarget);
  if (hasTarget) {
    document.getElementById('ef-current').textContent = formatMoney(ef.current);
    document.getElementById('ef-target').textContent = formatMoney(ef.target);
    const pct = ef.target > 0 ? Math.min(100, Math.round((ef.current / ef.target) * 100)) : 0;
    document.getElementById('ef-progress-fill').style.width = pct + '%';
    document.getElementById('ef-pct').textContent = pct + '% complete';
  }
}

/* ---------------------------------------------------------------------
   OVERVIEW VIEW
--------------------------------------------------------------------- */
function renderOverviewView() {
  document.getElementById('ov-balance').textContent = formatMoney(currentBalance());
  document.getElementById('ov-income').textContent = formatMoney(totalIncome());
  document.getElementById('ov-expenses').textContent = formatMoney(totalExpenses());

  const goalPct = state.goals.length
    ? Math.round(state.goals.reduce((s, g) => s + (g.target > 0 ? Math.min(1, g.current / g.target) : 0), 0) / state.goals.length * 100)
    : 0;
  document.getElementById('ov-goals-pct').textContent = goalPct + '%';

  const hasTx = state.transactions.length > 0;
  document.getElementById('ov-ie-empty').classList.toggle('hidden', hasTx);
  document.getElementById('ov-ie-wrap').classList.toggle('hidden', !hasTx);
  if (hasTx) renderSimpleBarComparison('ov-ie-chart', totalIncome(), totalExpenses());

  const spend = spendingByCategory();
  const hasSpend = Object.keys(spend).length > 0;
  document.getElementById('ov-cat-empty').classList.toggle('hidden', hasSpend);
  document.getElementById('ov-cat-wrap').classList.toggle('hidden', !hasSpend);
  if (hasSpend) renderSimpleCategoryChart('ov-cat-chart', spend, 'ov');

  const recent = recentTransactions(6);
  document.getElementById('ov-activity-empty').classList.toggle('hidden', recent.length > 0);
  document.getElementById('ov-activity-list').innerHTML = recent.map(txRowHTML).join('');

  const hasGoals = state.goals.length > 0;
  document.getElementById('ov-goals-empty').classList.toggle('hidden', hasGoals);
  document.getElementById('ov-goals-list').innerHTML = state.goals.map(g => {
    const pct = g.target > 0 ? Math.min(100, Math.round((g.current / g.target) * 100)) : 0;
    return `
    <div class="ov-goal-row">
      <div class="ov-goal-top"><strong>${escapeHTML(g.name)}</strong><span>${formatMoney(g.current)} of ${formatMoney(g.target)} · ${pct}%</span></div>
      <div class="progress-track"><div class="progress-fill gold" style="width:${pct}%"></div></div>
    </div>`;
  }).join('');
}

/* ---------------------------------------------------------------------
   INSIGHTS
--------------------------------------------------------------------- */
function buildInsights() {
  const insights = [];
  const income = totalIncome(), expenses = totalExpenses();

  if (income > 0 || expenses > 0) {
    const rate = savingsRate();
    insights.push(rate >= 0
      ? `Your current savings rate is ${rate}% of income.`
      : `You have spent ${formatMoney(expenses - income)} more than you've recorded in income.`);
  }
  const spend = spendingByCategory();
  const catEntries = Object.entries(spend).sort((a, b) => b[1] - a[1]);
  if (catEntries.length) {
    insights.push(`Your largest spending category is ${catEntries[0][0]}, at ${formatMoney(catEntries[0][1])}.`);
  }
  if (state.budgets.length) {
    const over = state.budgets.filter(b => categorySpent(b.category) > b.amount);
    insights.push(over.length
      ? `${over.length} of ${state.budgets.length} budgets are currently over their limit.`
      : `All ${state.budgets.length} of your budgets are within limit.`);
  }
  if (state.goals.length) {
    const g = [...state.goals].sort((a, b) => (b.current / (b.target || 1)) - (a.current / (a.target || 1)))[0];
    const pct = g.target > 0 ? Math.round((g.current / g.target) * 100) : 0;
    insights.push(`Your goal "${g.name}" is ${pct}% complete.`);
  }
  if (state.emergencyFund.target > 0) {
    const pct = Math.round((state.emergencyFund.current / state.emergencyFund.target) * 100);
    insights.push(`Your emergency fund is ${pct}% funded.`);
  }
  if (income > 0 && expenses > 0) {
    insights.push(`You've recorded ${formatMoney(income)} in income against ${formatMoney(expenses)} in expenses.`);
  }
  if (state.assets.length || state.liabilities.length || linkedAssetLines().length) {
    insights.push(`Your current net worth is ${formatMoney(currentNetWorth())}.`);
  }
  const overdue = state.bills.filter(b => billStatus(b) === 'overdue').length;
  if (overdue > 0) {
    insights.push(`You have ${overdue} overdue bill${overdue > 1 ? 's' : ''}.`);
  }
  return insights;
}

/* ---------------------------------------------------------------------
   BUDGET ALERTS
--------------------------------------------------------------------- */
const BUDGET_APPROACH_THRESHOLD = 0.8; // 80% of budget

function buildBudgetAlerts() {
  return state.budgets.map(b => {
    const spent = categorySpent(b.category);
    const pct = b.amount > 0 ? spent / b.amount : 0;
    if (pct >= 1) {
      return { status: 'exceeded', category: b.category, pct, spent, amount: b.amount };
    }
    if (pct >= BUDGET_APPROACH_THRESHOLD) {
      return { status: 'approaching', category: b.category, pct, spent, amount: b.amount };
    }
    return null;
  }).filter(Boolean).sort((a, b) => b.pct - a.pct);
}

function alertItemHTML(a) {
  if (a.status === 'exceeded') {
    return `
    <div class="alert-item is-exceeded">
      <div class="alert-icon">!</div>
      <div>
        <div class="alert-title">Budget exceeded</div>
        <div class="alert-body">Your ${escapeHTML(a.category)} spending is currently above your budget (${formatMoney(a.spent)} of ${formatMoney(a.amount)}).</div>
      </div>
    </div>`;
  }
  const pctRounded = Math.round(a.pct * 100);
  return `
    <div class="alert-item is-approaching">
      <div class="alert-icon">i</div>
      <div>
        <div class="alert-title">Budget alert</div>
        <div class="alert-body">You've used ${pctRounded}% of your ${escapeHTML(a.category)} budget this period.</div>
      </div>
    </div>`;
}

function renderAlertStack(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const alerts = buildBudgetAlerts();
  el.innerHTML = alerts.map(alertItemHTML).join('');
}

/* ---------------------------------------------------------------------
   MOTIVATIONAL / PROGRESS MESSAGE
--------------------------------------------------------------------- */
function buildMotivationalMessage() {
  const hasActivity =
    state.transactions.length > 0 ||
    state.goals.length > 0 ||
    state.emergencyFund.target > 0;

  if (!hasActivity) return null;

  const user = GroveAuth.currentUser();
  const firstName = user?.name?.trim().split(/\s+/)[0] || '';

  const hour = new Date().getHours();
  const greetingWord =
    hour < 12 ? 'Good morning' :
    hour < 17 ? 'Good afternoon' :
    hour < 21 ? 'Good evening' :
    'Still up';

  const greeting = firstName
    ? `${greetingWord}, ${firstName} 👋`
    : `${greetingWord} 👋`;

  // If there is no income yet, show setup/foundation messages.
  const income = Number(totalIncome()) || 0;

  if (income <= 0) {
    const messages = [
      'You’re building a clearer picture of your finances.',
      'We’re getting your money picture organized. 👀',
      'Every good money system starts with knowing where you stand.',
      'We’re laying the foundation. One move at a time.',
      'Your financial picture is starting to come together.',
      'We’re getting organized before we start making bigger moves.',
      'One step at a time. We’re building your money picture.',
      'The setup phase is part of the process. 👀'
    ];

    const dayIndex = Math.floor(Date.now() / 86400000) % messages.length;

    return {
      title: greeting,
      sub: messages[dayIndex]
    };
  }

  const rate = Number(savingsRate()) || 0;

  let messages;

  if (rate < 0) {
    messages = [
      'Okay, let’s look at the numbers. 👀',
      'No panic. We just need to tighten things up a little.',
      'Let’s get the spending back in line with the income.',
      'Your money needs a little attention right now. 👀',
      'Okay, we’re in reset mode.',
      'Let’s slow down and check where the money is going.',
      'We’ve got some numbers to work through. 👀',
      'Okay, this is our sign to take a closer look.',
      'Let’s get things back into balance.',
      'Your next move? Get those expenses back under control.',
      'We’re spending more than we’re bringing in. Time to regroup.',
      'No stress. Let’s work on getting that number back up.',
      'The numbers need a little TLC right now. 👀',
      'Okay, let’s bring the spending down and the breathing room up.',
      'This is where we pause, review, and adjust.'
    ];
  } else if (rate < 20) {
    messages = [
      'Okayyy, we’re starting to build. 👀',
      'A little left over is still progress.',
      'We’re keeping something aside. That’s a start.',
      'The goal now? Keep more of what you earn.',
      'Small moves still count.',
      'We’re building the habit. Keep going.',
      'Okay, we’ve got some breathing room.',
      'Not bad. Now let’s see if we can push it a little higher.',
      'The foundation is being built. 👀',
      'You’re starting to keep some money for yourself.',
      'Every percentage counts. Keep building.',
      'We’re getting somewhere. One step at a time.',
      'The money is moving, and so are we.',
      'A little progress is still progress.',
      'Let’s turn that small win into a bigger one.'
    ];
  } else if (rate < 40) {
    messages = [
      'Okayyy, we’re building. 👀',
      'The motion is motioning.',
      'No cap, you’re making progress.',
      'We’re in motion. Keep stacking.',
      'Okay, look at you keeping some money. 👀',
      'The financial glow-up has entered the chat.',
      'You’re doing your thing. Keep it going.',
      'Now we’re starting to see some movement.',
      'You’re building a solid money habit.',
      'Okayyy, the numbers are looking better.',
      'We love to see it. 👀',
      'You’re getting better at keeping your money.',
      'The progress is progressing.',
      'You’re putting your money to work for your future.',
      'This is how the financial glow-up starts.',
      'You’re getting into your money-building era.',
      'The foundation is looking good. Keep going.',
      'Okay, we’re definitely moving in the right direction.',
      'You’re making moves without doing too much.',
      'Slowly but surely, the money is staying with you.'
    ];
  } else if (rate < 60) {
    messages = [
      'Damn, you’re doing amazing. 🔥',
      'No cap, you’re really making moves.',
      'Okayyy, you’re locked in. 👀',
      'Gosh, look at that progress.',
      'You’re keeping a serious portion of what you earn.',
      'We love to see this kind of discipline. 🔥',
      'You’re not just earning — you’re keeping.',
      'Okay, the numbers are speaking for themselves.',
      'You’re really getting serious about building wealth.',
      'The financial glow-up is glowing. 👀',
      'You’re doing your thing. Keep this energy.',
      'Now THIS is some progress.',
      'You’re building serious breathing room.',
      'Okayyy, your money is staying with you.',
      'The wealth-building era is looking good.',
      'You’re becoming very intentional with your money.',
      'This is what making your money count looks like.',
      'You’re seriously changing the way your money moves.',
      'Locked in and making moves. 🔥',
      'You’re giving your future self something to work with.'
    ];
  } else if (rate < 80) {
    messages = [
      'You’re on fire. 🔥',
      'Okay, the motion is REALLY motioning.',
      'No cap… you’re locked in.',
      'Damn. Look at you keeping that much. 👀',
      'You’re seriously building wealth right now.',
      'This is what financial discipline looks like. 🔥',
      'Financial glow-up? Yeah, we see it.',
      'You’re cooking. Keep going. 🔥',
      'Okayyy, you’re actually making serious moves.',
      'Your money is working differently these days. 👀',
      'You’re keeping a huge part of what you earn.',
      'The wealth-building era is officially underway.',
      'You’re seriously locked into your goals.',
      'This is some serious money discipline.',
      'You’re giving financially responsible and we love it. 👀',
      'Okay, you’re really building something here.',
      'Your future self is going to appreciate this.',
      'The numbers are looking VERY good.',
      'You’re not playing around with your money anymore. 🔥',
      'You’re in your serious wealth-building era.'
    ];
  } else if (rate < 90) {
    messages = [
      'Okayyyy… you’re actually cooking. 🔥',
      'No cap, this is serious money discipline.',
      'You’re keeping almost everything you earn. 👀',
      'The wealth-building era is looking GOOD on you.',
      'Damn. You’re really locked in.',
      'Gosh, look at that savings rate. 🔥',
      'Okay, this is getting serious.',
      'You’re doing something very right here. 👀',
      'Your savings game is seriously strong.',
      'You’re building wealth at a serious pace.',
      'This is some next-level discipline.',
      'Okayyy, your money is staying put. 🔥',
      'You’re really showing your money who’s boss.',
      'The financial glow-up is getting serious.',
      'You’re in a whole different money era.',
      'Almost everything is staying in your pocket. 👀',
      'You’re seriously locked in.',
      'This is the kind of consistency that builds wealth.',
      'You’re making your money work overtime for your future.',
      'Okay, we see the discipline. 🔥'
    ];
  } else {
    messages = [
      '90%+?! Okay, you’re in a different era. 🔥',
      'Damn. You’re REALLY locked in.',
      'No cap… that savings rate is wild. 👀',
      'Okayyy, wealth-building mode is ON.',
      'You’re keeping almost all of what you earn. 🔥',
      'Gosh. Look at that savings rate. You’re cooking.',
      'The financial glow-up is officially glowing.',
      'Okay, this is serious wealth-building energy. 👀',
      'You’re operating on a different level.',
      'That savings rate? Absolutely locked in. 🔥',
      'You’re barely letting the money leave. 👀',
      'Okayyy, your money is staying HOME.',
      'This is some serious financial discipline.',
      'You’re in your wealth-building era for real.',
      'No cap, you’re putting your money on a serious mission.',
      'The numbers are actually crazy. 🔥',
      'You’re keeping almost everything and building for the future.',
      'Okay, you’re not playing about your money.',
      'That’s a serious savings game. 👀',
      'You’re officially in maximum wealth-building mode. 🔥'
    ];
  }

  // Same message throughout the day, different message on different days.
  const dayIndex = Math.floor(Date.now() / 86400000) % messages.length;

  return {
    title: greeting,
    sub: messages[dayIndex]
  };
}

function renderMotivation() {
  const banner = document.getElementById('dash-motivation');
  const msg = buildMotivationalMessage();
  banner.classList.toggle('hidden', !msg);

  if (msg) {
    document.getElementById('dash-motivation-title').textContent = msg.title;
    document.getElementById('dash-motivation-sub').textContent = msg.sub;
  }
}

function renderInsightsView() {
  const insights = buildInsights();
  document.getElementById('insights-empty').classList.toggle('hidden', insights.length > 0);
  document.getElementById('insights-grid').innerHTML = insights.map(i => `
    <div class="budget-card"><p style="font-size:0.92rem; line-height:1.55;">${escapeHTML(i)}</p></div>
  `).join('');
}

/* ---------------------------------------------------------------------
   SETTINGS VIEW
--------------------------------------------------------------------- */
function renderSettingsView() {
  const user = GroveAuth.currentUser();
  document.getElementById('settings-name').textContent = user ? user.name : '—';
  document.getElementById('settings-email').textContent = user ? user.email : '—';
  renderSettingsCurrencyGrid();
}

/* ---------------------------------------------------------------------
   NET WORTH VIEW
--------------------------------------------------------------------- */
function assetLiabilityRowHTML(item, kind) {
  return `
    <div class="nw-row" data-item-id="${item.id}">
      <div class="nw-row-main">
        <div class="nw-row-name">${escapeHTML(item.name)}</div>
        <div class="nw-row-meta">${escapeHTML(item.type)}${item.note ? ' · ' + escapeHTML(item.note) : ''}</div>
      </div>
      <div class="nw-row-amount">${formatMoney(item.amount)}</div>
      <div class="nw-row-actions">
        <button class="btn-icon" data-edit-${kind}="${item.id}" aria-label="Edit">✎</button>
        <button class="btn-icon" data-delete-${kind}="${item.id}" aria-label="Delete">🗑</button>
      </div>
    </div>`;
}
function linkedRowHTML(line) {
  return `
    <div class="nw-row is-linked">
      <div class="nw-row-main">
        <div class="nw-row-name">${escapeHTML(line.label)}<span class="linked-tag">From ${escapeHTML(line.source)}</span></div>
        <div class="nw-row-meta">Included automatically — edit it from ${escapeHTML(line.source)}.</div>
      </div>
      <div class="nw-row-amount">${formatMoney(line.amount)}</div>
      <div class="nw-row-actions"></div>
    </div>`;
}
function renderNetWorthView() {
  document.getElementById('nw-total-assets').textContent = formatMoney(totalAssets());
  document.getElementById('nw-total-liabilities').textContent = formatMoney(totalLiabilities());

  const nwEl = document.getElementById('nw-net-worth');
  nwEl.textContent = formatMoney(currentNetWorth());
  nwEl.classList.toggle('negative', currentNetWorth() < 0);

  const linked = linkedAssetLines();

  const hasAssets = state.assets.length > 0 || linked.length > 0;

  document.getElementById('nw-assets-empty').classList.toggle('hidden', hasAssets);

  document.getElementById('nw-assets-list').innerHTML =
    linked.map(linkedRowHTML).join('') +
    state.assets.map(a => assetLiabilityRowHTML(a, 'asset')).join('');

  const hasLiabilities = state.liabilities.length > 0;

  document.getElementById('nw-liabilities-empty').classList.toggle('hidden', hasLiabilities);

  document.getElementById('nw-liabilities-list').innerHTML =
    state.liabilities
      .map(l => assetLiabilityRowHTML(l, 'liability'))
      .join('');

  renderNetWorthChart();
}


function renderNetWorthChart() {
  const wrap = document.getElementById('nw-chart-wrap');

  if (!wrap) return;

  if (chartInstances['nw-chart']) {
    chartInstances['nw-chart'].destroy();
    chartInstances['nw-chart'] = null;
  }

  const history = Array.isArray(state.netWorthHistory)
    ? state.netWorthHistory
    : [];

  const points = history
    .filter(item =>
      item &&
      item.date != null &&
      Number.isFinite(Number(item.value))
    )
    .sort((a, b) =>
      String(a.date).localeCompare(String(b.date))
    );

  /* No history yet */
  if (points.length < 2) {
    wrap.innerHTML = `
      <div class="empty-state" style="height:100%; display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center; padding:24px;">
        <h4>Not enough history yet.</h4>
        <p>Add or update assets and liabilities on different days to build your net worth trend.</p>
      </div>
    `;

    return;
  }

  /* Recreate a clean canvas */
  wrap.innerHTML = `
    <canvas id="nw-chart"></canvas>
  `;

  const canvas = document.getElementById('nw-chart');

  if (!canvas) return;

  /* Chart.js unavailable */
  if (typeof Chart === 'undefined') {
    wrap.innerHTML = `
      <div class="empty-state" style="height:100%; display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center; padding:24px;">
        <h4>Chart unavailable.</h4>
        <p>Chart.js could not be loaded.</p>
      </div>
    `;

    return;
  }

  const labels = points.map(item => formatDate(item.date));
  const values = points.map(item => Number(item.value));

  chartInstances['nw-chart'] = new Chart(canvas, {
    type: 'line',

    data: {
      labels: labels,

      datasets: [{
        label: 'Net worth',
        data: values,

        borderColor: '#163A32',
        backgroundColor: 'rgba(22, 58, 50, 0.08)',

        borderWidth: 2.5,
        fill: true,
        tension: 0.3,

        pointRadius: 4,
        pointHoverRadius: 6,

        pointBackgroundColor: '#163A32',
        pointBorderColor: '#FFFFFF',
        pointBorderWidth: 2
      }]
    },

    options: {
      responsive: true,
      maintainAspectRatio: false,

      interaction: {
        mode: 'index',
        intersect: false
      },

      plugins: {
        legend: {
          display: false
        },

        tooltip: {
          callbacks: {
            label: function(context) {
              return 'Net worth: ' + formatMoney(context.parsed.y);
            }
          }
        }
      },

      scales: {
        x: {
          grid: {
            display: false
          },

          ticks: {
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 6
          }
        },

        y: {
          beginAtZero: false,

          ticks: {
            callback: function(value) {
              return formatMoney(value);
            }
          },

          grid: {
            color: 'rgba(22, 58, 50, 0.08)'
          }
        }
      }
    }
  });
}

/* ---------------------------------------------------------------------
   RECURRING TRANSACTIONS VIEW
--------------------------------------------------------------------- */
function recurringCardHTML(rt) {
  const sign = rt.type === 'income' ? '+' : '\u2212';
  return `
    <div class="recurring-card ${rt.active ? '' : 'is-paused'}" data-recurring-id="${rt.id}">
      <div class="recurring-card-head">
        <h4>${escapeHTML(rt.description)}</h4>
        <span class="status-badge ${rt.active ? 'active' : 'paused'}">${rt.active ? 'Active' : 'Paused'}</span>
      </div>
      <div class="recurring-amount ${rt.type}">${sign}${formatMoney(rt.amount)}</div>
      <div class="recurring-meta-row"><span>Category</span><span>${escapeHTML(rt.category)}</span></div>
      <div class="recurring-meta-row"><span>Frequency</span><span>${FREQUENCY_LABELS[rt.frequency]}</span></div>
      <div class="recurring-meta-row"><span>Next occurrence</span><span>${formatDate(rt.nextDate)}</span></div>
      ${rt.endDate ? `<div class="recurring-meta-row"><span>Ends</span><span>${formatDate(rt.endDate)}</span></div>` : ''}
      <div class="recurring-actions">
        <button class="btn btn-outline btn-sm" data-edit-recurring="${rt.id}">Edit</button>
        <button class="btn btn-ghost btn-sm" data-toggle-recurring="${rt.id}">${rt.active ? 'Pause' : 'Reactivate'}</button>
        <button class="btn-icon" data-delete-recurring="${rt.id}" aria-label="Delete">🗑</button>
      </div>
    </div>`;
}
function renderRecurringView() {
  const hasAny = state.recurringTransactions.length > 0;
  document.getElementById('recurring-empty').classList.toggle('hidden', hasAny);
  document.getElementById('recurring-grid').innerHTML = [...state.recurringTransactions]
    .sort((a, b) => a.nextDate.localeCompare(b.nextDate))
    .map(recurringCardHTML).join('');
}

/* ---------------------------------------------------------------------
   BILLS VIEW
--------------------------------------------------------------------- */
function billRowHTML(b) {
  const status = billStatus(b);
  return `
    <tr data-bill-id="${b.id}">
      <td>${escapeHTML(b.name)}${b.notes ? `<div class="tx-meta">${escapeHTML(b.notes)}</div>` : ''}</td>
      <td><span class="pill">${escapeHTML(b.category)}</span></td>
      <td>${formatDate(b.dueDate)}</td>
      <td>${formatMoney(b.amount)}</td>
      <td><span class="bill-status-pill ${status}">${BILL_STATUS_LABELS[status]}</span></td>
      <td><div class="row-actions">
        ${b.paid
          ? `<button class="btn-icon" data-mark-unpaid="${b.id}" aria-label="Mark unpaid">↺</button>`
          : `<button class="btn-icon" data-mark-paid="${b.id}" aria-label="Mark paid">✓</button>`}
        <button class="btn-icon" data-edit-bill="${b.id}" aria-label="Edit">✎</button>
        <button class="btn-icon" data-delete-bill="${b.id}" aria-label="Delete">🗑</button>
      </div></td>
    </tr>`;
}
function billCardMobileHTML(b) {
  const status = billStatus(b);
  return `
    <div class="bill-card-mobile" data-bill-id="${b.id}">
      <div class="bill-card-mobile-top">
        <strong>${escapeHTML(b.name)}</strong>
        <span class="bill-status-pill ${status}">${BILL_STATUS_LABELS[status]}</span>
      </div>
      <div class="tx-meta">${escapeHTML(b.category)} · Due ${formatDate(b.dueDate)} · ${formatMoney(b.amount)}</div>
      <div class="tx-actions-inline">
        ${b.paid
          ? `<button class="btn-icon" data-mark-unpaid="${b.id}" aria-label="Mark unpaid">↺</button>`
          : `<button class="btn-icon" data-mark-paid="${b.id}" aria-label="Mark paid">✓</button>`}
        <button class="btn-icon" data-edit-bill="${b.id}" aria-label="Edit">✎</button>
        <button class="btn-icon" data-delete-bill="${b.id}" aria-label="Delete">🗑</button>
      </div>
    </div>`;
}
function renderBillsView() {
  const bills = state.bills;
  document.getElementById('bills-sum-upcoming').textContent = bills.filter(b => billStatus(b) === 'upcoming').length;
  document.getElementById('bills-sum-due-soon').textContent = bills.filter(b => billStatus(b) === 'due-soon').length;
  document.getElementById('bills-sum-overdue').textContent = bills.filter(b => billStatus(b) === 'overdue').length;
  document.getElementById('bills-sum-monthly').textContent = formatMoney(monthlyRecurringSubscriptionCost());

  const hasAny = bills.length > 0;
  document.getElementById('bills-empty').classList.toggle('hidden', hasAny);
  document.getElementById('bills-table-panel').classList.toggle('hidden', !hasAny);

  const sorted = [...bills].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  document.getElementById('bills-table-body').innerHTML = sorted.map(billRowHTML).join('');
  document.getElementById('bills-table-mobile').innerHTML = sorted.map(billCardMobileHTML).join('');
}

/* ---------------------------------------------------------------------
   REPORTS VIEW
--------------------------------------------------------------------- */
let reportPeriod = 'this-month';
function reportDateRange() {
  const now = new Date();
  if (reportPeriod === 'this-month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { start: toDateStr(start), end: toDateStr(end) };
  }
  if (reportPeriod === 'last-month') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { start: toDateStr(start), end: toDateStr(end) };
  }
  if (reportPeriod === 'this-year') {
    return { start: `${now.getFullYear()}-01-01`, end: `${now.getFullYear()}-12-31` };
  }
  const start = document.getElementById('report-start').value;
  const end = document.getElementById('report-end').value;
  return { start: start || '0000-01-01', end: end || '9999-12-31' };
}
function transactionsInRange(start, end) {
  return state.transactions.filter(t => t.date >= start && t.date <= end);
}
function renderReportsView() {
  document.querySelectorAll('[data-report-period]').forEach(btn => btn.classList.toggle('is-active', btn.dataset.reportPeriod === reportPeriod));
  document.getElementById('report-custom-range').classList.toggle('hidden', reportPeriod !== 'custom');

  const { start, end } = reportDateRange();
  const txs = transactionsInRange(start, end);
  const income = txs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const expenses = txs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
  const netFlow = income - expenses;
  const savings = Math.max(0, netFlow);
  const rate = income > 0 ? Math.round((netFlow / income) * 100) : 0;

  const hasData = txs.length > 0;
  document.getElementById('rep-empty').classList.toggle('hidden', hasData);
  document.getElementById('rep-content').classList.toggle('hidden', !hasData);
  if (!hasData) return;

  document.getElementById('rep-income').textContent = formatMoney(income);
  document.getElementById('rep-expenses').textContent = formatMoney(expenses);
  document.getElementById('rep-net-flow').textContent = formatMoney(netFlow);
  document.getElementById('rep-savings').textContent = formatMoney(savings);
  document.getElementById('rep-savings-rate').textContent = rate + '%';

  const catMap = {};
  txs.filter(t => t.type === 'expense').forEach(t => { catMap[t.category] = (catMap[t.category] || 0) + Number(t.amount); });
  const catEntries = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
  document.getElementById('rep-largest-category').textContent = catEntries.length ? catEntries[0][0] : '—';
renderReportComparison('rep-ie-chart', income, expenses);

  const hasSpend = catEntries.length > 0;
  document.getElementById('rep-cat-empty').classList.toggle('hidden', hasSpend);
  document.getElementById('rep-cat-wrap').classList.toggle('hidden', !hasSpend);
  if (hasSpend) renderDoughnut('rep-cat-chart', catMap, 'rep');

  // Spending trend: group ALL expense transactions (not just this period) by month, for context.
  const monthMap = {};
  state.transactions.filter(t => t.type === 'expense').forEach(t => {
    const m = t.date.slice(0, 7);
    monthMap[m] = (monthMap[m] || 0) + Number(t.amount);
  });
  const months = Object.keys(monthMap).sort();
  const hasTrend = months.length >= 2;
  document.getElementById('rep-trend-empty').classList.toggle('hidden', hasTrend);
  document.getElementById('rep-trend-wrap').classList.toggle('hidden', !hasTrend);
  if (hasTrend) {
    const ctx = document.getElementById('rep-trend-chart');
    if (ctx && typeof Chart !== 'undefined') {
      if (chartInstances['rep-trend-chart']) chartInstances['rep-trend-chart'].destroy();
      chartInstances['rep-trend-chart'] = new Chart(ctx, {
        type: 'line',
        data: {
          labels: months.map(m => new Date(m + '-01T00:00:00').toLocaleDateString(undefined, { month: 'short', year: 'numeric' })),
          datasets: [{ label: 'Spending', data: months.map(m => monthMap[m]), borderColor: '#9A3324', backgroundColor: 'rgba(154,51,36,0.08)', fill: true, tension: 0.25, pointRadius: 3 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
      });
      requestAnimationFrame(() => chartInstances['rep-trend-chart'] && chartInstances['rep-trend-chart'].resize());
    }
  }
}
function exportReportCSV() {
  const { start, end } = reportDateRange();
  const txs = transactionsInRange(start, end).sort((a, b) => a.date.localeCompare(b.date));
  const rows = [['Date', 'Description', 'Category', 'Type', 'Amount']];
  txs.forEach(t => rows.push([t.date, t.description, t.category, t.type, t.amount]));
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `grove-report-${start}-to-${end}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function exportReportPDF() {
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) {
    alert('PDF export is not available right now.');
    return;
  }

  const { start, end } = reportDateRange();
  const txs = transactionsInRange(start, end)
    .sort((a, b) => a.date.localeCompare(b.date));

  const income = txs
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

  const expenses = txs
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

  const netFlow = income - expenses;

  const doc = new jsPDF();

  const pdfMoney = value =>
  formatMoney(value)
    .replace(/₵/g, 'GHS ')
    .replace(/₦/g, 'NGN ');

  let y = 20;

  doc.setFontSize(20);
  doc.setFont(undefined, 'bold');
  doc.text('Grove — Financial Report', 20, y);

  y += 10;

  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.text(`Period: ${start} to ${end}`, 20, y);

  y += 15;

  doc.setFontSize(13);
  doc.setFont(undefined, 'bold');
  doc.text('Summary', 20, y);

  y += 8;

  doc.setFontSize(11);
  doc.setFont(undefined, 'normal');
  doc.text(`Income: ${pdfMoney(income)}`, 20, y);
  y += 7;
  doc.text(`Expenses: ${pdfMoney(expenses)}`, 20, y);
  y += 7;
  doc.text(`Net flow: ${pdfMoney(netFlow)}`, 20, y);

  y += 14;

  doc.setFontSize(13);
  doc.setFont(undefined, 'bold');
  doc.text('Transactions', 20, y);

  y += 9;

  doc.setFontSize(9);
  doc.setFont(undefined, 'bold');
  doc.text('Date', 20, y);
  doc.text('Description', 50, y);
  doc.text('Category', 115, y);
  doc.text('Type', 155, y);
  doc.text('Amount', 180, y);

  y += 6;

  doc.setFont(undefined, 'normal');

  txs.forEach(t => {
    if (y > 275) {
      doc.addPage();
      y = 20;

      doc.setFontSize(9);
      doc.setFont(undefined, 'bold');
      doc.text('Date', 20, y);
      doc.text('Description', 50, y);
      doc.text('Category', 115, y);
      doc.text('Type', 155, y);
      doc.text('Amount', 180, y);

      y += 6;
      doc.setFont(undefined, 'normal');
    }

    const description = String(t.description || '').slice(0, 30);
    const category = String(t.category || '').slice(0, 18);

    doc.text(String(t.date || ''), 20, y);
    doc.text(description, 50, y);
    doc.text(category, 115, y);
    doc.text(String(t.type || ''), 155, y);
    doc.text(pdfMoney(Number(t.amount || 0)), 180, y);

    y += 6;
  });

  doc.save(`grove-report-${start}-to-${end}.pdf`);
}

/* ---------------------------------------------------------------------
   FINANCIAL CALENDAR VIEW
--------------------------------------------------------------------- */
let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth();
let calSelectedDate = null;
function renderCalendarView() {
  const label = new Date(calYear, calMonth, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  document.getElementById('cal-month-label').textContent = label;

  const events = calendarEventsForMonth(calYear, calMonth);
  const eventsByDate = {};
  events.forEach(e => { (eventsByDate[e.date] = eventsByDate[e.date] || []).push(e); });

  const firstDay = new Date(calYear, calMonth, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const today = todayStr();

  let cells = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => `<div class="cal-dow">${d}</div>`).join('');
  for (let i = 0; i < startOffset; i++) cells += `<div class="cal-day is-empty"></div>`;
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = toDateStr(new Date(calYear, calMonth, day));
    const dayEvents = eventsByDate[dateStr] || [];
    const isToday = dateStr === today;
    const isSelected = dateStr === calSelectedDate;
    cells += `
      <button type="button" class="cal-day ${dayEvents.length ? 'has-events' : ''} ${isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''}" data-cal-date="${dateStr}">
        <span class="cal-day-num">${day}</span>
        <span class="cal-day-dots">${dayEvents.slice(0, 4).map(e => `<span class="cal-day-dot ${e.type}"></span>`).join('')}</span>
      </button>`;
  }
  document.getElementById('cal-grid').innerHTML = cells;

  if (!calSelectedDate || !eventsByDate[calSelectedDate]) {
    calSelectedDate = events.length ? events[0].date : null;
  }
  renderCalendarEventsList(eventsByDate, events);
}
function renderCalendarEventsList(eventsByDate, allEvents) {
  const title = document.getElementById('cal-events-title');
  const emptyEl = document.getElementById('cal-events-empty');
  const listEl = document.getElementById('cal-events-list');

  if (!allEvents.length) {
    title.textContent = 'Events';
    emptyEl.classList.remove('hidden');
    listEl.innerHTML = '';
    return;
  }
  emptyEl.classList.add('hidden');
  const dayEvents = calSelectedDate ? (eventsByDate[calSelectedDate] || []) : allEvents;
  title.textContent = calSelectedDate ? `Events on ${formatDate(calSelectedDate)}` : 'Events this month';
  if (!dayEvents.length) {
    listEl.innerHTML = `<p style="color:var(--ink-soft); font-size:0.88rem; padding:8px 0;">No events on this day. Pick another highlighted day to see its events.</p>`;
    return;
  }
  listEl.innerHTML = dayEvents.map(e => `
    <div class="cal-event-item">
      <div>
        <div class="cal-event-title">${escapeHTML(e.title)}</div>
        <div class="cal-event-detail">${escapeHTML(e.detail)} · ${formatDate(e.date)}</div>
      </div>
      <div class="tx-amount ${e.type === 'income' ? 'income' : 'expense'}">${formatMoney(e.amount)}</div>
    </div>`).join('');
}

/* ---------------------------------------------------------------------
   FAQ CAROUSEL (landing page)
--------------------------------------------------------------------- */
const FAQ_ITEMS = [
  { q: 'What is Grove?', a: 'Grove is a personal finance tracking and organization tool. It helps you record income and expenses, set budgets, and track savings goals in one place.' },
  { q: 'Is Grove a bank?', a: 'No. Grove is not a bank and does not offer banking services. It\u2019s a place to organize financial information you enter yourself.' },
  { q: 'Can Grove connect to my bank account?', a: 'No. Grove does not connect to bank accounts or mobile money providers. All figures are entered manually by you.' },
  { q: 'Does Grove move or hold my money?', a: 'No. Grove never moves, holds, sends, or receives money. It only records the numbers you give it.' },
  { q: 'How does Grove track my finances?', a: 'You add transactions, budgets, and goals manually. Grove stores this on your device and uses it to build your summaries and insights.' }
];
let faqIndex = 0;

function initFaqCarousel() {
  const wrap = document.getElementById('faq-slide-wrap');
  const dots = document.getElementById('faq-dots');
  if (!wrap || !dots) return;
  wrap.innerHTML = FAQ_ITEMS.map((item, i) => `
    <div class="faq-slide ${i === 0 ? 'is-active' : ''}" data-faq-index="${i}">
      <div class="faq-slide-q">${escapeHTML(item.q)}</div>
      <div class="faq-slide-a">${escapeHTML(item.a)}</div>
    </div>
  `).join('');
  dots.innerHTML = FAQ_ITEMS.map((_, i) => `
    <button class="faq-dot ${i === 0 ? 'is-active' : ''}" data-faq-dot="${i}" aria-label="Question ${i + 1} of ${FAQ_ITEMS.length}"></button>
  `).join('');
}

function goToFaqSlide(index) {
  const total = FAQ_ITEMS.length;
  faqIndex = ((index % total) + total) % total;
  document.querySelectorAll('.faq-slide').forEach(s => s.classList.toggle('is-active', Number(s.dataset.faqIndex) === faqIndex));
  document.querySelectorAll('.faq-dot').forEach((d, i) => d.classList.toggle('is-active', i === faqIndex));
}

/* ---------------------------------------------------------------------
   PASSWORD STRENGTH UI
--------------------------------------------------------------------- */
function wirePasswordChecklist(inputId, checklistId) {
  const input = document.getElementById(inputId);
  const list = document.getElementById(checklistId);
  if (!input || !list) return;
  input.addEventListener('input', () => {
    const results = GroveAuth.passwordRuleResults(input.value);
    Object.keys(results).forEach(rule => {
      const li = list.querySelector(`[data-rule="${rule}"]`);
      if (li) li.classList.toggle('is-met', results[rule]);
    });
  });
}

function wireConfirmMatch(passwordId, confirmId, errorId) {
  const pwInput = document.getElementById(passwordId);
  const confirmInput = document.getElementById(confirmId);
  const check = () => {
    const field = confirmInput.closest('.field');
    const mismatched = confirmInput.value.length > 0 && confirmInput.value !== pwInput.value;
    field.classList.toggle('has-error', mismatched);
  };
  if (pwInput && confirmInput) {
    confirmInput.addEventListener('input', check);
    pwInput.addEventListener('input', check);
  }
}

/* ---------------------------------------------------------------------
   PWA / SERVICE WORKER
--------------------------------------------------------------------- */
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  // Registration is skipped gracefully when served from file:// or a
  // sandboxed context where service workers aren't permitted.
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {
      // Non-fatal: Grove works fully as a normal web app without it.
    });
  });
}

/* ---------------------------------------------------------------------
   MODALS — generic open/close
--------------------------------------------------------------------- */
function openModal(id) {
  document.getElementById(id).classList.add('is-open');
  document.body.style.overflow = 'hidden';
}
function closeModal(id) {
  document.getElementById(id).classList.remove('is-open');
  const anyOpen = document.querySelector('.modal-overlay.is-open');
  if (!anyOpen) document.body.style.overflow = '';
}
function closeAllModals() {
  document.querySelectorAll('.modal-overlay.is-open').forEach(m => m.classList.remove('is-open'));
  document.body.style.overflow = '';
}

/* ---------------------------------------------------------------------
   TRANSACTION MODAL
--------------------------------------------------------------------- */
function populateTxCategorySelect() {
  const select = document.getElementById('tx-category');
  select.innerHTML = CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('');
}

function openTxModal(txId) {
  populateTxCategorySelect();
  const form = document.getElementById('tx-form');
  form.reset();
  document.getElementById('tx-id').value = '';

  if (txId) {
    const t = state.transactions.find(x => x.id === txId);
    if (!t) return;
    document.getElementById('tx-modal-title').textContent = 'Edit transaction';
    document.getElementById('tx-submit-btn').textContent = 'Save changes';
    document.getElementById('tx-id').value = t.id;
    document.getElementById('tx-description').value = t.description;
    document.getElementById('tx-amount').value = t.amount;
    document.getElementById('tx-date').value = t.date;
    document.getElementById('tx-category').value = t.category;
    document.getElementById('tx-note').value = t.note || '';
    setTxType(t.type);
  } else {
    document.getElementById('tx-modal-title').textContent = 'Add transaction';
    document.getElementById('tx-submit-btn').textContent = 'Add transaction';
    document.getElementById('tx-date').value = new Date().toISOString().slice(0, 10);
    setTxType('income');
  }
  document.querySelectorAll('#tx-form .field').forEach(f => f.classList.remove('has-error'));
  openModal('tx-modal-overlay');
}

function setTxType(type) {
  activeTxType = type;
  document.querySelectorAll('[data-tx-type]').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.txType === type);
  });
}

function handleTxSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('tx-id').value;
  const description = document.getElementById('tx-description').value.trim();
  const amount = parseFloat(document.getElementById('tx-amount').value);
  const date = document.getElementById('tx-date').value;
  const category = document.getElementById('tx-category').value;
  const note = document.getElementById('tx-note').value.trim();

  let valid = true;
  const setError = (fieldId, hasError) => {
    document.getElementById(fieldId).closest('.field').classList.toggle('has-error', hasError);
    if (hasError) valid = false;
  };
  setError('tx-description', !description);
  setError('tx-amount', !(amount > 0));
  setError('tx-date', !date);
  setError('tx-category', !category);
  if (!valid) return;

  if (id) {
    const t = state.transactions.find(x => x.id === id);
    Object.assign(t, { description, amount, date, category, note, type: activeTxType });
  } else {
    state.transactions.push({
      id: uid(), description, amount, date, category, note, type: activeTxType, createdAt: Date.now()
    });
  }
  saveState();
  closeModal('tx-modal-overlay');
  renderAll();
}

function deleteTransaction(id) {
  state.transactions = state.transactions.filter(t => t.id !== id);
  saveState();
  renderAll();
}

/* ---------------------------------------------------------------------
   BUDGET MODAL
--------------------------------------------------------------------- */
let editingBudgetId = null;
function openBudgetModal(budgetId) {
  document.getElementById('budget-form').reset();
  editingBudgetId = budgetId || null;
  const select = document.getElementById('budget-category');
  select.innerHTML = EXPENSE_CHART_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('');

  const modalTitle = document.querySelector('#budget-modal-overlay .modal-head h3');
  const submitBtn = document.querySelector('#budget-form button[type="submit"]');

  if (editingBudgetId) {
    const budget = state.budgets.find(b => b.id === editingBudgetId);
    if (budget) {
      select.value = budget.category;
      document.getElementById('budget-amount').value = budget.amount;
    }
    if (modalTitle) modalTitle.textContent = 'Edit budget';
    if (submitBtn) submitBtn.textContent = 'Save changes';
  } else {
    if (modalTitle) modalTitle.textContent = 'Add budget';
    if (submitBtn) submitBtn.textContent = 'Add budget';
  }
  openModal('budget-modal-overlay');
}
function handleBudgetSubmit(e) {
  e.preventDefault();
  const category = document.getElementById('budget-category').value;
  const amount = parseFloat(document.getElementById('budget-amount').value);
  if (!category || !(amount > 0)) return;

  if (editingBudgetId) {
    const budget = state.budgets.find(b => b.id === editingBudgetId);
    if (budget) {
      // Check no OTHER budget already uses this category.
      const clash = state.budgets.find(b => b.category === category && b.id !== editingBudgetId);
      if (clash) { clash.amount = amount; state.budgets = state.budgets.filter(b => b.id !== editingBudgetId); }
      else { budget.category = category; budget.amount = amount; }
    }
  } else {
    const existing = state.budgets.find(b => b.category === category);
    if (existing) { existing.amount = amount; }
    else { state.budgets.push({ id: uid(), category, amount }); }
  }
  editingBudgetId = null;
  saveState();
  closeModal('budget-modal-overlay');
  renderAll();
}
function deleteBudget(id) {
  state.budgets = state.budgets.filter(b => b.id !== id);
  saveState();
  renderAll();
}

/* ---------------------------------------------------------------------
   GOAL MODAL
--------------------------------------------------------------------- */
function openGoalModal() {
  document.getElementById('goal-form').reset();
  document.getElementById('goal-current').value = 0;
  openModal('goal-modal-overlay');
}
function handleGoalSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('goal-name').value.trim();
  const target = parseFloat(document.getElementById('goal-target').value);
  const current = parseFloat(document.getElementById('goal-current').value) || 0;
  if (!name || !(target > 0)) return;
  state.goals.push({ id: uid(), name, target, current });
  snapshotNetWorth();
  saveState();
  closeModal('goal-modal-overlay');
  renderAll();
}
function deleteGoal(id) {
  state.goals = state.goals.filter(g => g.id !== id);
  snapshotNetWorth();
  saveState();
  renderAll();
}
function openContributionModal(goalId) {
  document.getElementById('contribution-form').reset();
  document.getElementById('contribution-goal-id').value = goalId;
  openModal('contribution-modal-overlay');
}
function handleContributionSubmit(e) {
  e.preventDefault();
  const goalId = document.getElementById('contribution-goal-id').value;
  const amount = parseFloat(document.getElementById('contribution-amount').value);
  if (!(amount > 0)) return;
  const g = state.goals.find(x => x.id === goalId);
  if (g) g.current = Number(g.current) + amount;
  snapshotNetWorth();
  saveState();
  closeModal('contribution-modal-overlay');
  renderAll();
}

/* ---------------------------------------------------------------------
   EMERGENCY FUND MODAL
--------------------------------------------------------------------- */
function openEfModal() {
  document.getElementById('ef-target-input').value = state.emergencyFund.target || '';
  document.getElementById('ef-current-input').value = state.emergencyFund.current || '';
  openModal('ef-modal-overlay');
}
function handleEfSubmit(e) {
  e.preventDefault();
  const target = parseFloat(document.getElementById('ef-target-input').value) || 0;
  const current = parseFloat(document.getElementById('ef-current-input').value) || 0;
  state.emergencyFund = { target, current };
  snapshotNetWorth();
  saveState();
  closeModal('ef-modal-overlay');
  renderAll();
}
function deleteEmergencyFund() {
  state.emergencyFund = { target: 0, current: 0 };
  snapshotNetWorth();
  saveState();
  renderAll();
}

/* ---------------------------------------------------------------------
   ASSET / LIABILITY MODAL
--------------------------------------------------------------------- */
function openAssetModal(kind, id) {
  const form = document.getElementById('asset-form');
  form.reset();
  document.getElementById('asset-id').value = '';
  document.getElementById('asset-kind').value = kind;
  const typeSelect = document.getElementById('asset-type');
  typeSelect.innerHTML = (kind === 'asset' ? ASSET_TYPES : LIABILITY_TYPES).map(t => `<option value="${t}">${t}</option>`).join('');
  document.getElementById('asset-modal-title').textContent = (id ? 'Edit ' : 'Add ') + (kind === 'asset' ? 'asset' : 'liability');
  document.getElementById('asset-submit-btn').textContent = id ? 'Save changes' : 'Save';

  if (id) {
    const list = kind === 'asset' ? state.assets : state.liabilities;
    const item = list.find(x => x.id === id);
    if (!item) return;
    document.getElementById('asset-id').value = item.id;
    document.getElementById('asset-name').value = item.name;
    document.getElementById('asset-type').value = item.type;
    document.getElementById('asset-amount').value = item.amount;
    document.getElementById('asset-note').value = item.note || '';
  }
  openModal('asset-modal-overlay');
}
function handleAssetSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('asset-id').value;
  const kind = document.getElementById('asset-kind').value;
  const name = document.getElementById('asset-name').value.trim();
  const type = document.getElementById('asset-type').value;
  const amount = parseFloat(document.getElementById('asset-amount').value);
  const note = document.getElementById('asset-note').value.trim();
  if (!name || !(amount >= 0)) return;

  const list = kind === 'asset' ? state.assets : state.liabilities;
  if (id) {
    const item = list.find(x => x.id === id);
    Object.assign(item, { name, type, amount, note });
  } else {
    list.push({ id: uid(), name, type, amount, note, createdAt: Date.now() });
  }
  snapshotNetWorth();
  saveState();
  closeModal('asset-modal-overlay');
  renderAll();
}
function deleteAsset(kind, id) {
  if (kind === 'asset') state.assets = state.assets.filter(a => a.id !== id);
  else state.liabilities = state.liabilities.filter(l => l.id !== id);
  snapshotNetWorth();
  saveState();
  renderAll();
}

/* ---------------------------------------------------------------------
   RECURRING TRANSACTION MODAL
--------------------------------------------------------------------- */
let activeRecurringType = 'income';
function populateRecurringCategorySelect() {
  document.getElementById('recurring-category').innerHTML = CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('');
}
function setRecurringType(type) {
  activeRecurringType = type;
  document.querySelectorAll('[data-recurring-type]').forEach(btn => btn.classList.toggle('is-active', btn.dataset.recurringType === type));
}
function openRecurringModal(id) {
  populateRecurringCategorySelect();
  const form = document.getElementById('recurring-form');
  form.reset();
  document.getElementById('recurring-id').value = '';

  if (id) {
    const rt = state.recurringTransactions.find(x => x.id === id);
    if (!rt) return;
    document.getElementById('recurring-modal-title').textContent = 'Edit recurring transaction';
    document.getElementById('recurring-submit-btn').textContent = 'Save changes';
    document.getElementById('recurring-id').value = rt.id;
    document.getElementById('recurring-description').value = rt.description;
    document.getElementById('recurring-amount').value = rt.amount;
    document.getElementById('recurring-category').value = rt.category;
    document.getElementById('recurring-frequency').value = rt.frequency;
    document.getElementById('recurring-start').value = rt.startDate;
    document.getElementById('recurring-end').value = rt.endDate || '';
    setRecurringType(rt.type);
  } else {
    document.getElementById('recurring-modal-title').textContent = 'Add recurring transaction';
    document.getElementById('recurring-submit-btn').textContent = 'Save';
    document.getElementById('recurring-start').value = todayStr();
    setRecurringType('income');
  }
  openModal('recurring-modal-overlay');
}
function handleRecurringSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('recurring-id').value;
  const description = document.getElementById('recurring-description').value.trim();
  const amount = parseFloat(document.getElementById('recurring-amount').value);
  const category = document.getElementById('recurring-category').value;
  const frequency = document.getElementById('recurring-frequency').value;
  const startDate = document.getElementById('recurring-start').value;
  const endDate = document.getElementById('recurring-end').value || null;
  if (!description || !(amount > 0) || !startDate) return;

  if (id) {
    const rt = state.recurringTransactions.find(x => x.id === id);
    Object.assign(rt, { description, amount, category, frequency, startDate, endDate, type: activeRecurringType });
    rt.nextDate = computeNextOccurrence(rt, todayStr());
  } else {
    const rt = {
      id: uid(), description, amount, category, frequency, startDate, endDate,
      type: activeRecurringType, active: true, nextDate: startDate, lastGeneratedDate: null
    };
    rt.nextDate = computeNextOccurrence(rt, todayStr());
    state.recurringTransactions.push(rt);
  }
  generateDueRecurringTransactions();
  saveState();
  closeModal('recurring-modal-overlay');
  renderAll();
}
function toggleRecurring(id) {
  const rt = state.recurringTransactions.find(x => x.id === id);
  if (!rt) return;
  rt.active = !rt.active;
  if (rt.active) rt.nextDate = computeNextOccurrence(rt, todayStr());
  generateDueRecurringTransactions();
  saveState();
  renderAll();
}
function deleteRecurring(id) {
  state.recurringTransactions = state.recurringTransactions.filter(r => r.id !== id);
  saveState();
  renderAll();
}

/* ---------------------------------------------------------------------
   BILL MODAL
--------------------------------------------------------------------- */
function populateBillCategorySelect() {
  document.getElementById('bill-category').innerHTML = BILL_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('');
}
function openBillModal(id) {
  populateBillCategorySelect();
  const form = document.getElementById('bill-form');
  form.reset();
  document.getElementById('bill-id').value = '';

  if (id) {
    const b = state.bills.find(x => x.id === id);
    if (!b) return;
    document.getElementById('bill-modal-title').textContent = 'Edit bill';
    document.getElementById('bill-submit-btn').textContent = 'Save changes';
    document.getElementById('bill-id').value = b.id;
    document.getElementById('bill-name').value = b.name;
    document.getElementById('bill-amount').value = b.amount;
    document.getElementById('bill-category').value = b.category;
    document.getElementById('bill-due').value = b.dueDate;
    document.getElementById('bill-frequency').value = b.frequency || 'one-time';
    document.getElementById('bill-notes').value = b.notes || '';
  } else {
    document.getElementById('bill-modal-title').textContent = 'Add bill';
    document.getElementById('bill-submit-btn').textContent = 'Save';
    document.getElementById('bill-due').value = todayStr();
  }
  openModal('bill-modal-overlay');
}
function handleBillSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('bill-id').value;
  const name = document.getElementById('bill-name').value.trim();
  const amount = parseFloat(document.getElementById('bill-amount').value);
  const category = document.getElementById('bill-category').value;
  const dueDate = document.getElementById('bill-due').value;
  const frequency = document.getElementById('bill-frequency').value;
  const notes = document.getElementById('bill-notes').value.trim();
  if (!name || !(amount > 0) || !dueDate) return;

  if (id) {
    const b = state.bills.find(x => x.id === id);
    Object.assign(b, { name, amount, category, dueDate, frequency, notes });
  } else {
    state.bills.push({ id: uid(), name, amount, category, dueDate, frequency, notes, paid: false, paidDate: null, history: [] });
  }
  saveState();
  closeModal('bill-modal-overlay');
  renderAll();
}
function deleteBill(id) {
  state.bills = state.bills.filter(b => b.id !== id);
  saveState();
  renderAll();
}

/* ---------------------------------------------------------------------
   CONFIRM DELETE MODAL
--------------------------------------------------------------------- */
let pendingDeleteAction = null;
function openConfirmModal(title, body, onConfirm) {
  document.getElementById('confirm-modal-title').textContent = title;
  document.getElementById('confirm-modal-body').textContent = body;
  pendingDeleteAction = onConfirm;
  openModal('confirm-modal-overlay');
}

/* ---------------------------------------------------------------------
   MOBILE DRAWERS (landing + app)
--------------------------------------------------------------------- */
function openLandingDrawer() {
  document.getElementById('mobile-drawer').classList.add('is-open');
  document.getElementById('hamburger-btn').classList.add('is-open');
  document.getElementById('hamburger-btn').setAttribute('aria-expanded', 'true');
}
function closeLandingDrawer() {
  document.getElementById('mobile-drawer').classList.remove('is-open');
  document.getElementById('hamburger-btn').classList.remove('is-open');
  document.getElementById('hamburger-btn').setAttribute('aria-expanded', 'false');
}
function openAppDrawer() {
  document.getElementById('app-mobile-drawer').classList.add('is-open');
}
function closeAppDrawer() {
  document.getElementById('app-mobile-drawer').classList.remove('is-open');
}

/* ---------------------------------------------------------------------
   AUTH PANEL SWITCHING
--------------------------------------------------------------------- */
function openAuthOverlay(panel) {
  document.getElementById('auth-overlay').classList.remove('hidden');
  showAuthPanel(panel || 'signin');
  document.body.style.overflow = 'hidden';
}
function closeAuthOverlay() {
  document.getElementById('auth-overlay').classList.add('hidden');
  document.body.style.overflow = '';
}
function showAuthPanel(panel) {
  document.querySelectorAll('.auth-panel').forEach(p => p.classList.toggle('is-active', p.dataset.panel === panel));
  document.querySelectorAll('.auth-error-banner').forEach(b => {
    b.classList.remove('is-visible', 'is-info');
    b.style.color = '';
    b.style.background = '';
    b.textContent = '';
  });
}
function showAuthError(panel, message) {
  const el = document.getElementById(panel + '-error');
  if (!el) return;
  el.classList.remove('is-info');
  el.style.color = '';
  el.style.background = '';
  el.textContent = message;
  el.classList.add('is-visible');
}
function showAuthMessage(panel, message) {
  // Reuses the panel's existing error banner to show a non-error status
  // message (e.g. "check your email"), styled neutrally instead of as an
  // error so it doesn't read as something having gone wrong.
  const el = document.getElementById(panel + '-error');
  if (!el) return;
  el.textContent = message;
  el.classList.add('is-visible', 'is-info');
  el.style.color = 'inherit';
  el.style.background = 'transparent';
}

/* ---------------------------------------------------------------------
   APP <-> LANDING SWITCHING
--------------------------------------------------------------------- */
function enterApp() {
  document.getElementById('landing-page').classList.add('hidden');
  closeAuthOverlay();
  document.getElementById('app-shell').classList.add('is-active');
  goToView('dashboard');
  renderCurrencyMenu();
}
function exitToLanding() {
  document.getElementById('app-shell').classList.remove('is-active');
  document.getElementById('landing-page').classList.remove('hidden');
}

/* ---------------------------------------------------------------------
   INIT & EVENT DELEGATION
--------------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  // set default tx date
  renderCurrencyMenu();
  renderSettingsCurrencyGrid();
  initFaqCarousel();
  registerServiceWorker();

  // catch up any recurring transactions that came due while the app was closed,
  // and keep today's net worth snapshot current.
  generateDueRecurringTransactions();
  snapshotNetWorth();
  saveState();

  // session check — wait for Supabase's first session check to resolve.
  // If the page was opened via a password-reset email link, Supabase
  // establishes a recovery session and fires PASSWORD_RECOVERY instead of
  // a normal sign-in, so we send the user to the reset panel rather than
  // straight into the app.
  GroveAuth.ready.then(() => {
    if (GroveAuth.isPasswordRecovery()) {
      openAuthOverlay('reset');
    } else if (GroveAuth.currentUser()) {
      enterApp();
    }
  });

  /* ---- global click delegation ---- */
  document.body.addEventListener('click', (e) => {
    const openAuthBtn = e.target.closest('[data-open-auth]');
    if (openAuthBtn) { openAuthOverlay(openAuthBtn.dataset.openAuth); return; }

    if (e.target.closest('#auth-overlay-close')) { closeAuthOverlay(); return; }
    if (e.target === document.getElementById('auth-overlay')) { closeAuthOverlay(); return; }

    if (e.target.closest('#hamburger-btn')) {
      document.getElementById('mobile-drawer').classList.contains('is-open') ? closeLandingDrawer() : openLandingDrawer();
      return;
    }
    if (e.target.closest('#mobile-drawer-close') || e.target.closest('#mobile-drawer-backdrop')) { closeLandingDrawer(); return; }
    if (e.target.closest('.mobile-drawer-panel a, .mobile-drawer-panel button:not([data-open-auth])')) {
      if (!e.target.closest('[data-open-auth]')) closeLandingDrawer();
    }

    if (e.target.closest('#app-hamburger')) { openAppDrawer(); return; }
    if (e.target.closest('#app-drawer-close') || e.target.closest('#app-drawer-backdrop')) { closeAppDrawer(); return; }

    const drawerNavItem = e.target.closest('.drawer-nav-item');
    if (drawerNavItem) { goToView(drawerNavItem.dataset.view); return; }

    const navItem = e.target.closest('.nav-item, .bottom-nav-item');
    if (navItem && navItem.dataset.view) { goToView(navItem.dataset.view); return; }

    const viewLink = e.target.closest('[data-view-link]');
    if (viewLink) { goToView(viewLink.dataset.viewLink); return; }

    // FAQ carousel
    if (e.target.closest('#faq-prev')) { goToFaqSlide(faqIndex - 1); return; }
    if (e.target.closest('#faq-next')) { goToFaqSlide(faqIndex + 1); return; }
    const faqDot = e.target.closest('[data-faq-dot]');
    if (faqDot) { goToFaqSlide(Number(faqDot.dataset.faqDot)); return; }

    // currency picker
    if (e.target.closest('#currency-toggle')) {
      document.getElementById('currency-menu').classList.toggle('is-open');
      return;
    }
    const currencyOpt = e.target.closest('[data-currency]');
    if (currencyOpt) { setCurrency(currencyOpt.dataset.currency); document.getElementById('currency-menu').classList.remove('is-open'); return; }
    const currencyRadio = e.target.closest('[data-currency-radio]');
    if (currencyRadio) { setCurrency(currencyRadio.dataset.currencyRadio); return; }
    if (!e.target.closest('.currency-picker')) {
      document.getElementById('currency-menu').classList.remove('is-open');
    }

    // quick add / transaction modal
    if (e.target.closest('#quick-add-btn') || e.target.closest('[data-quick-add]')) { openTxModal(null); return; }
    const editTx = e.target.closest('[data-edit-tx]');
    if (editTx) { openTxModal(editTx.dataset.editTx); return; }
    const deleteTx = e.target.closest('[data-delete-tx]');
    if (deleteTx) {
      openConfirmModal('Delete transaction?', 'This transaction will be permanently removed.', () => deleteTransaction(deleteTx.dataset.deleteTx));
      return;
    }
    const txTypeBtn = e.target.closest('[data-tx-type]');
    if (txTypeBtn) { setTxType(txTypeBtn.dataset.txType); return; }

    // budgets
    if (e.target.closest('#add-budget-btn') || e.target.closest('#add-budget-btn-2')) { openBudgetModal(); return; }
    const editBudgetBtn = e.target.closest('[data-edit-budget]');
    if (editBudgetBtn) { openBudgetModal(editBudgetBtn.dataset.editBudget); return; }
    const deleteBudgetBtn = e.target.closest('[data-delete-budget]');
    if (deleteBudgetBtn) {
      openConfirmModal('Delete budget?', 'This budget will be permanently removed.', () => deleteBudget(deleteBudgetBtn.dataset.deleteBudget));
      return;
    }

    // goals
    if (e.target.closest('#add-goal-btn') || e.target.closest('#add-goal-btn-2')) { openGoalModal(); return; }
    const deleteGoalBtn = e.target.closest('[data-delete-goal]');
    if (deleteGoalBtn) {
      openConfirmModal('Delete goal?', 'This savings goal will be permanently removed.', () => deleteGoal(deleteGoalBtn.dataset.deleteGoal));
      return;
    }
    const addContribBtn = e.target.closest('[data-add-contribution]');
    if (addContribBtn) { openContributionModal(addContribBtn.dataset.addContribution); return; }

    // emergency fund
    if (e.target.closest('#edit-ef-btn') || e.target.closest('#edit-ef-btn-2')) { openEfModal(); return; }
    if (e.target.closest('#delete-ef-btn')) {
      openConfirmModal('Delete emergency fund?', 'Your emergency fund target and balance will be permanently removed.', deleteEmergencyFund);
      return;
    }
    const passwordToggleBtn = e.target.closest('[data-toggle-password]');
    if (passwordToggleBtn) {
      const input = document.getElementById(passwordToggleBtn.dataset.togglePassword);
      if (input) {
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        passwordToggleBtn.textContent = show ? '🙈' : '👁';
        passwordToggleBtn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
        passwordToggleBtn.setAttribute('aria-pressed', show ? 'true' : 'false');
      }
      return;
    }

    // net worth: assets & liabilities
    if (e.target.closest('#add-asset-btn') || e.target.closest('#add-asset-btn-2')) { openAssetModal('asset', null); return; }
    if (e.target.closest('#add-liability-btn') || e.target.closest('#add-liability-btn-2')) { openAssetModal('liability', null); return; }
    const editAssetBtn = e.target.closest('[data-edit-asset]');
    if (editAssetBtn) { openAssetModal('asset', editAssetBtn.dataset.editAsset); return; }
    const editLiabilityBtn = e.target.closest('[data-edit-liability]');
    if (editLiabilityBtn) { openAssetModal('liability', editLiabilityBtn.dataset.editLiability); return; }
    const deleteAssetBtn = e.target.closest('[data-delete-asset]');
    if (deleteAssetBtn) {
      openConfirmModal('Delete asset?', 'This asset will be permanently removed.', () => deleteAsset('asset', deleteAssetBtn.dataset.deleteAsset));
      return;
    }
    const deleteLiabilityBtn = e.target.closest('[data-delete-liability]');
    if (deleteLiabilityBtn) {
      openConfirmModal('Delete liability?', 'This liability will be permanently removed.', () => deleteAsset('liability', deleteLiabilityBtn.dataset.deleteLiability));
      return;
    }

    // recurring transactions
    if (e.target.closest('#add-recurring-btn') || e.target.closest('#add-recurring-btn-2')) { openRecurringModal(null); return; }
    const editRecurringBtn = e.target.closest('[data-edit-recurring]');
    if (editRecurringBtn) { openRecurringModal(editRecurringBtn.dataset.editRecurring); return; }
    const toggleRecurringBtn = e.target.closest('[data-toggle-recurring]');
    if (toggleRecurringBtn) { toggleRecurring(toggleRecurringBtn.dataset.toggleRecurring); return; }
    const deleteRecurringBtn = e.target.closest('[data-delete-recurring]');
    if (deleteRecurringBtn) {
      openConfirmModal('Delete recurring transaction?', 'This recurring transaction will be permanently removed. Past generated transactions are not affected.', () => deleteRecurring(deleteRecurringBtn.dataset.deleteRecurring));
      return;
    }
    const recurringTypeBtn = e.target.closest('[data-recurring-type]');
    if (recurringTypeBtn) { setRecurringType(recurringTypeBtn.dataset.recurringType); return; }

    // bills
    if (e.target.closest('#add-bill-btn') || e.target.closest('#add-bill-btn-2')) { openBillModal(null); return; }
    const editBillBtn = e.target.closest('[data-edit-bill]');
    if (editBillBtn) { openBillModal(editBillBtn.dataset.editBill); return; }
    const markPaidBtn = e.target.closest('[data-mark-paid]');
    if (markPaidBtn) { markBillPaid(markPaidBtn.dataset.markPaid); return; }
    const markUnpaidBtn = e.target.closest('[data-mark-unpaid]');
    if (markUnpaidBtn) { markBillUnpaid(markUnpaidBtn.dataset.markUnpaid); return; }
    const deleteBillBtn = e.target.closest('[data-delete-bill]');
    if (deleteBillBtn) {
      openConfirmModal('Delete bill?', 'This bill will be permanently removed.', () => deleteBill(deleteBillBtn.dataset.deleteBill));
      return;
    }

    // reports
    const reportPeriodBtn = e.target.closest('[data-report-period]');
    if (reportPeriodBtn) {
      reportPeriod = reportPeriodBtn.dataset.reportPeriod;
      if (reportPeriod === 'custom') {
        const startInput = document.getElementById('report-start');
        const endInput = document.getElementById('report-end');
        if (!startInput.value) startInput.value = toDateStr(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
        if (!endInput.value) endInput.value = todayStr();
      }
      renderReportsView();
      return;
    }
    if (e.target.closest('#report-apply-custom')) { renderReportsView(); return; }
    if (e.target.closest('#report-export-btn')) { exportReportCSV(); return; }
    if (e.target.closest('#report-export-pdf-btn')) {
  exportReportPDF();
  return;
}

    // calendar
    if (e.target.closest('#cal-prev-btn')) {
      calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; }
      calSelectedDate = null; renderCalendarView(); return;
    }
    if (e.target.closest('#cal-next-btn')) {
      calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; }
      calSelectedDate = null; renderCalendarView(); return;
    }
    const calDayBtn = e.target.closest('[data-cal-date]');
    if (calDayBtn) { calSelectedDate = calDayBtn.dataset.calDate; renderCalendarView(); return; }

    // sign out
    if (e.target.closest('#signout-btn')) {
      GroveAuth.signOut().then(exitToLanding);
      return;
    }

    // modal close
    const closeBtn = e.target.closest('[data-close-modal]');
    if (closeBtn) { closeModal(closeBtn.dataset.closeModal); return; }
    if (e.target.classList.contains('modal-overlay')) { closeModal(e.target.id); return; }

    if (e.target.closest('#confirm-modal-confirm')) {
      if (pendingDeleteAction) pendingDeleteAction();
      pendingDeleteAction = null;
      closeModal('confirm-modal-overlay');
      return;
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAllModals();
      closeAuthOverlay();
      closeLandingDrawer();
      closeAppDrawer();
      document.getElementById('currency-menu').classList.remove('is-open');
    }
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && e.target.closest('#faq-carousel')) {
      goToFaqSlide(faqIndex + (e.key === 'ArrowRight' ? 1 : -1));
    }
  });

  /* ---- forms ---- */
  document.getElementById('signin-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    const res = await GroveAuth.signIn({
      email: document.getElementById('signin-email').value,
      password: document.getElementById('signin-password').value
    });
    if (submitBtn) submitBtn.disabled = false;
    if (!res.ok) { showAuthError('signin', res.error); return; }
    enterApp();
  });

  document.getElementById('signup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    const res = await GroveAuth.signUp({
      name: document.getElementById('signup-name').value,
      email: document.getElementById('signup-email').value,
      password: document.getElementById('signup-password').value,
      confirm: document.getElementById('signup-confirm').value
    });
    if (submitBtn) submitBtn.disabled = false;
    if (!res.ok) { showAuthError('signup', res.error); return; }
    if (res.needsConfirmation) {
      document.getElementById('signup-form').reset();
      showAuthPanel('signin');
      showAuthMessage('signin', 'Check your email to confirm your account, then sign in below.');
      return;
    }
    enterApp();
  });

  document.getElementById('forgot-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    const email = document.getElementById('forgot-email').value;
    const res = await GroveAuth.requestReset(email);
    if (submitBtn) submitBtn.disabled = false;
    if (!res.ok) { showAuthError('forgot', res.error); return; }
    showAuthMessage('forgot', "If an account exists for that email, we've sent a link to reset your password.");
    document.getElementById('forgot-form').reset();
  });

  document.getElementById('reset-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    const res = await GroveAuth.resetPassword(
      document.getElementById('reset-password').value,
      document.getElementById('reset-confirm').value
    );
    if (submitBtn) submitBtn.disabled = false;
    if (!res.ok) { showAuthError('reset', res.error); return; }
    document.getElementById('reset-form').reset();
    showAuthPanel('signin');
    document.getElementById('signin-form').reset();
    showAuthMessage('signin', 'Your password has been reset. Sign in with your new password.');
  });

  // code-digit auto-advance
  document.querySelectorAll('.code-digit').forEach((input, idx, all) => {
    input.addEventListener('input', () => {
      input.value = input.value.replace(/[^0-9]/g, '').slice(0, 1);
      if (input.value && all[idx + 1]) all[idx + 1].focus();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !input.value && all[idx - 1]) all[idx - 1].focus();
    });
  });

  // live password strength checklist + confirm-match feedback
  wirePasswordChecklist('signup-password', 'password-checklist');
  wirePasswordChecklist('reset-password', 'reset-password-checklist');
  wireConfirmMatch('signup-password', 'signup-confirm', 'signup-confirm-error');
  wireConfirmMatch('reset-password', 'reset-confirm', 'reset-confirm-error');

  document.getElementById('tx-form').addEventListener('submit', handleTxSubmit);
  document.getElementById('budget-form').addEventListener('submit', handleBudgetSubmit);
  document.getElementById('goal-form').addEventListener('submit', handleGoalSubmit);
  document.getElementById('contribution-form').addEventListener('submit', handleContributionSubmit);
  document.getElementById('ef-form').addEventListener('submit', handleEfSubmit);
  document.getElementById('asset-form').addEventListener('submit', handleAssetSubmit);
  document.getElementById('recurring-form').addEventListener('submit', handleRecurringSubmit);
  document.getElementById('bill-form').addEventListener('submit', handleBillSubmit);

  document.getElementById('tx-search').addEventListener('input', renderTransactionsView);
  document.getElementById('tx-filter-type').addEventListener('change', renderTransactionsView);
  document.getElementById('tx-filter-category').addEventListener('change', renderTransactionsView);
document.getElementById('tx-filter-month').addEventListener('change', renderTransactionsView);

/* ---- appearance ---- */
document.getElementById('theme-light').addEventListener('click', () => {
  applyTheme('light');
});

document.getElementById('theme-dark').addEventListener('click', () => {
  applyTheme('dark');
});

initTheme();

});

