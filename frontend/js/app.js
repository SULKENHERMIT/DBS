/**
 * Precision Portfolio Manager - Unified Responsive Frontend Controller
 * Fully wired to FastAPI Backend with live CoinGecko & Finnhub Valuations + Price History Chart
 */

// Global State
const state = {
  currentView: 'login', // 'login', 'signup', 'dashboard', 'portfolio-detail', 'activity', 'market'
  selectedPortfolioId: null,
  portfolios: [],
  currentPortfolio: null,
  currentValuation: null,
  symbolStats: { stocks_count: 30963, crypto_count: 18434, total_count: 49397 },
  clientCatalog: { stock: null, crypto: null },
  activeChartInstance: null,
};

// Utilities
function formatCurrency(num) {
  if (num === null || num === undefined || isNaN(num)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

function formatPercent(num) {
  if (num === null || num === undefined || isNaN(num)) return '0.00%';
  const prefix = num > 0 ? '+' : '';
  return `${prefix}${num.toFixed(2)}%`;
}

function formatNumber(num) {
  if (num === null || num === undefined || isNaN(num)) return '0';
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 6,
  }).format(num);
}

function debounce(func, wait = 150) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = 'info';
  if (type === 'success') icon = 'check_circle';
  if (type === 'error') icon = 'error';

  toast.innerHTML = `
    <span class="material-symbols-outlined text-[20px]">${icon}</span>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 200);
  }, 4000);
}

// Background Pre-fetching of full catalogs
async function preloadSymbolCatalogs() {
  try {
    const stats = await window.api.getSymbolStats().catch(() => null);
    if (stats) {
      state.symbolStats = stats;
    }
    // Load catalogs asynchronously into memory & localStorage
    window.api.getAllSymbols('stock').then(data => {
      if (data) state.clientCatalog.stock = data;
    }).catch(() => {});

    window.api.getAllSymbols('crypto').then(data => {
      if (data) state.clientCatalog.crypto = data;
    }).catch(() => {});
  } catch (e) {
    console.warn('Symbol preload notice:', e);
  }
}

// Session Expired Event Listener
window.addEventListener('session-expired', () => {
  openSessionExpiredModal();
});

// App Router & View Switching
function navigateTo(view, params = {}) {
  state.currentView = view;
  if (params.portfolioId) {
    state.selectedPortfolioId = params.portfolioId;
  }
  render();
}

function checkAuth() {
  const token = window.api.getToken();
  if (!token) {
    if (state.currentView !== 'signup') {
      state.currentView = 'login';
    }
  } else {
    if (state.currentView === 'login' || state.currentView === 'signup') {
      state.currentView = 'dashboard';
    }
  }
}

// --- Main Render Engine ---
async function render() {
  checkAuth();
  const root = document.getElementById('app-root');
  if (!root) return;

  if (state.currentView === 'login') {
    root.innerHTML = renderLoginView();
    attachLoginEvents();
  } else if (state.currentView === 'signup') {
    root.innerHTML = renderSignupView();
    attachSignupEvents();
  } else {
    // Authenticated Shell with Responsive Desktop Sidebar & Mobile Bottom Navigation
    root.innerHTML = renderAppShell();
    attachShellEvents();

    if (state.currentView === 'dashboard') {
      await loadDashboard();
    } else if (state.currentView === 'portfolio-detail') {
      await loadPortfolioDetail(state.selectedPortfolioId);
    } else if (state.currentView === 'activity') {
      await loadActivity();
    } else if (state.currentView === 'market') {
      await loadMarket();
    }
  }
}

// ==========================================
// 1. LOGIN VIEW
// ==========================================
function renderLoginView() {
  return `
    <main class="w-full flex items-center justify-center min-h-screen bg-background font-body text-on-background p-4">
      <div class="relative w-full max-w-[420px] animate-fade-in">
        <div class="absolute -inset-1 bg-gradient-to-r from-primary/10 to-surface-tint/10 rounded-xl blur-lg z-0"></div>
        <div class="relative z-10 bg-surface-container-lowest rounded-2xl p-6 sm:p-8 shadow-md flex flex-col gap-6 border border-outline-variant/20">
          <div class="flex flex-col items-center justify-center gap-2 text-center">
            <div class="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-1 text-primary">
              <span class="material-symbols-outlined" style="font-size: 28px; font-variation-settings: 'FILL' 1;">security</span>
            </div>
            <h1 class="font-headline text-2xl sm:text-headline text-on-surface font-bold">Welcome Back</h1>
            <p class="font-body text-sm sm:text-body text-on-surface-variant">Sign in to your portfolio dashboard</p>
          </div>

          <form id="login-form" class="flex flex-col gap-4">
            <div class="flex flex-col gap-1 group relative">
              <label class="font-data-sm text-data-sm text-on-surface-variant uppercase tracking-wider pl-1" for="login-email">Email Address</label>
              <div class="relative">
                <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors duration-200 pointer-events-none" style="font-size: 20px;">mail</span>
                <input autocomplete="email" class="w-full bg-surface-container-low text-on-surface font-body text-body py-3 pl-10 pr-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-outline-variant" id="login-email" placeholder="name@company.com" required type="email"/>
              </div>
            </div>

            <div class="flex flex-col gap-1 group relative">
              <label class="font-data-sm text-data-sm text-on-surface-variant uppercase tracking-wider pl-1" for="login-password">Password</label>
              <div class="relative">
                <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors duration-200 pointer-events-none" style="font-size: 20px;">lock</span>
                <input autocomplete="current-password" class="w-full bg-surface-container-low text-on-surface font-body text-body py-3 pl-10 pr-10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-outline-variant" id="login-password" placeholder="••••••••" required type="password"/>
                <button aria-label="Toggle password visibility" id="toggle-login-pass" class="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors focus:outline-none" type="button">
                  <span class="material-symbols-outlined" style="font-size: 20px;">visibility</span>
                </button>
              </div>
            </div>

            <div id="login-error" class="hidden p-3 bg-error-container/50 border border-error/20 text-on-error-container rounded-lg text-body-sm flex items-center gap-2">
              <span class="material-symbols-outlined text-[18px] text-error">error</span>
              <span id="login-error-text"></span>
            </div>

            <button id="login-submit-btn" class="w-full bg-primary text-on-primary font-title text-title py-3 rounded-lg hover:bg-primary-container focus:outline-none focus:ring-4 focus:ring-primary/20 active:scale-[0.98] transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2 mt-2" type="submit">
              <span>Sign In</span>
              <span class="material-symbols-outlined" style="font-size: 20px;">arrow_forward</span>
            </button>
          </form>

          <div class="text-center pt-4 border-t border-outline-variant/20">
            <p class="font-body text-body text-on-surface-variant">
              Don't have an account? 
              <button id="goto-signup-btn" class="font-title text-body text-primary hover:underline font-semibold cursor-pointer">Sign Up</button>
            </p>
          </div>
        </div>
      </div>
    </main>
  `;
}

function attachLoginEvents() {
  const form = document.getElementById('login-form');
  const toggleBtn = document.getElementById('toggle-login-pass');
  const passInput = document.getElementById('login-password');
  const gotoSignup = document.getElementById('goto-signup-btn');

  toggleBtn?.addEventListener('click', () => {
    passInput.type = passInput.type === 'password' ? 'text' : 'password';
  });

  gotoSignup?.addEventListener('click', () => {
    navigateTo('signup');
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const submitBtn = document.getElementById('login-submit-btn');
    const errBox = document.getElementById('login-error');
    const errText = document.getElementById('login-error-text');

    errBox.classList.add('hidden');
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="animate-spin material-symbols-outlined text-[20px]">sync</span> Signing In...`;

    try {
      await window.api.login(email, password);
      showToast('Logged in successfully', 'success');
      preloadSymbolCatalogs();
      navigateTo('dashboard');
    } catch (err) {
      errText.textContent = err.message || 'Login failed. Please check your credentials.';
      errBox.classList.remove('hidden');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<span>Sign In</span><span class="material-symbols-outlined" style="font-size: 20px;">arrow_forward</span>`;
    }
  });
}

// ==========================================
// 2. SIGNUP VIEW
// ==========================================
function renderSignupView() {
  return `
    <main class="w-full flex items-center justify-center min-h-screen bg-background font-body text-on-background p-4">
      <div class="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 bg-surface-container-lowest rounded-2xl shadow-xl overflow-hidden border border-outline-variant/20 my-4 animate-fade-in">
        <!-- Desktop Promotional Left Column -->
        <div class="hidden md:flex flex-col justify-between p-8 bg-surface-tint text-on-primary relative overflow-hidden">
          <div class="absolute inset-0 bg-gradient-to-t from-surface-tint via-surface-tint/80 to-transparent"></div>
          <div class="relative z-10">
            <div class="flex items-center gap-2 mb-8">
              <span class="material-symbols-outlined text-[32px]">account_balance</span>
              <span class="font-headline text-headline font-bold tracking-tight">Precision Portfolio</span>
            </div>
            <h2 class="font-display text-display mb-3">Live Stock & Crypto Analytics.</h2>
            <p class="font-body text-body text-primary-fixed-dim max-w-sm">Manage multi-asset portfolios, track live CoinGecko & Finnhub prices, and analyze interactive price history charts.</p>
          </div>
          <div class="relative z-10 mt-8">
            <div class="flex items-center gap-3 bg-on-primary-fixed-variant/40 backdrop-blur-md rounded-xl p-4 border border-on-primary/10">
              <span class="material-symbols-outlined text-primary-fixed-dim">verified_user</span>
              <div>
                <p class="font-data-sm text-data-sm text-primary-fixed-dim uppercase tracking-wider">FastAPI & MongoDB Atlas</p>
                <p class="font-body-sm text-body-sm">Real-time asset prices & historical candle charts.</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Signup Form Right Column -->
        <div class="p-6 sm:p-8 flex flex-col justify-center bg-surface-container-lowest">
          <div class="mb-6">
            <h1 class="font-headline text-2xl font-bold text-on-surface mb-1">Create your account</h1>
            <p class="font-body text-sm text-on-surface-variant">Enter your email and choose a secure password.</p>
          </div>
          <form id="signup-form" class="space-y-4 w-full">
            <div class="space-y-1 relative">
              <label class="font-data-sm text-data-sm text-on-surface-variant uppercase tracking-wider block pl-1" for="signup-email">Email Address</label>
              <div class="relative group">
                <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors">mail</span>
                <input class="w-full bg-surface-container-low border border-outline-variant/50 rounded-lg py-3 pl-10 pr-3 font-body text-body text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-outline/50" id="signup-email" placeholder="trader@company.com" required type="email"/>
              </div>
            </div>

            <div class="space-y-1 relative">
              <label class="font-data-sm text-data-sm text-on-surface-variant uppercase tracking-wider block pl-1" for="signup-password">Password</label>
              <div class="relative group">
                <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors">lock</span>
                <input class="w-full bg-surface-container-low border border-outline-variant/50 rounded-lg py-3 pl-10 pr-3 font-body text-body text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-outline/50" id="signup-password" placeholder="••••••••" required type="password"/>
              </div>
            </div>

            <div class="space-y-1 relative">
              <label class="font-data-sm text-data-sm text-on-surface-variant uppercase tracking-wider block pl-1" for="signup-currency">Base Currency</label>
              <select class="w-full bg-surface-container-low border border-outline-variant/50 rounded-lg py-3 px-3 font-body text-body text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" id="signup-currency">
                <option value="USD">USD ($ - United States Dollar)</option>
                <option value="EUR">EUR (€ - Euro)</option>
                <option value="GBP">GBP (£ - British Pound)</option>
              </select>
            </div>

            <div id="signup-error" class="hidden p-3 bg-error-container/50 border border-error/20 text-on-error-container rounded-lg text-body-sm flex items-center gap-2">
              <span class="material-symbols-outlined text-[18px] text-error">error</span>
              <span id="signup-error-text"></span>
            </div>

            <button id="signup-submit-btn" class="w-full bg-primary text-on-primary font-title text-title py-3 rounded-lg hover:bg-primary-container focus:outline-none focus:ring-4 focus:ring-primary/20 active:scale-[0.98] transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2 mt-2" type="submit">
              <span>Create Account</span>
              <span class="material-symbols-outlined" style="font-size: 20px;">arrow_forward</span>
            </button>
          </form>

          <div class="text-center mt-6 pt-4 border-t border-outline-variant/20">
            <p class="font-body text-body text-on-surface-variant">
              Already have an account? 
              <button id="goto-login-btn" class="font-title text-body text-primary hover:underline font-semibold cursor-pointer">Sign In</button>
            </p>
          </div>
        </div>
      </div>
    </main>
  `;
}

function attachSignupEvents() {
  const form = document.getElementById('signup-form');
  const gotoLogin = document.getElementById('goto-login-btn');

  gotoLogin?.addEventListener('click', () => {
    navigateTo('login');
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const currency = document.getElementById('signup-currency').value;
    const submitBtn = document.getElementById('signup-submit-btn');
    const errBox = document.getElementById('signup-error');
    const errText = document.getElementById('signup-error-text');

    errBox.classList.add('hidden');
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="animate-spin material-symbols-outlined text-[20px]">sync</span> Creating...`;

    try {
      await window.api.signup(email, password, currency);
      showToast('Account created! Logging in...', 'success');
      await window.api.login(email, password);
      preloadSymbolCatalogs();
      navigateTo('dashboard');
    } catch (err) {
      errText.textContent = err.message || 'Registration failed.';
      errBox.classList.remove('hidden');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<span>Create Account</span><span class="material-symbols-outlined" style="font-size: 20px;">arrow_forward</span>`;
    }
  });
}

// ==========================================
// 3. RESPONSIVE APP SHELL (Desktop Sidebar + Mobile Bottom Nav)
// ==========================================
function renderAppShell() {
  const user = window.api.getUser() || { email: 'User' };
  const userEmail = user.email || 'User';

  return `
    <div class="flex bg-background min-h-screen">
      <!-- 1. DESKTOP SIDEBAR (Visible on >= 768px) -->
      <aside class="hidden md:flex fixed left-0 top-0 h-full w-64 bg-surface-container-low z-40 flex-col border-r border-outline-variant/30">
        <div class="p-6 mb-2 flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-on-primary shadow-sm">
            <span class="material-symbols-outlined text-[20px]">show_chart</span>
          </div>
          <span class="font-title text-title text-on-surface font-bold">Portfolio Pro</span>
        </div>

        <nav class="flex-1 px-4 space-y-1">
          <button id="nav-dashboard" class="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${state.currentView === 'dashboard' || state.currentView === 'portfolio-detail' ? 'bg-primary-container text-on-primary-container font-semibold shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'}">
            <span class="material-symbols-outlined text-[20px]">dashboard</span>
            <span class="font-body text-body">Dashboard</span>
          </button>
          <button id="nav-activity" class="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${state.currentView === 'activity' ? 'bg-primary-container text-on-primary-container font-semibold shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'}">
            <span class="material-symbols-outlined text-[20px]">history</span>
            <span class="font-body text-body">Activity Logs</span>
          </button>
          <button id="nav-market" class="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${state.currentView === 'market' ? 'bg-primary-container text-on-primary-container font-semibold shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'}">
            <span class="material-symbols-outlined text-[20px]">public</span>
            <span class="font-body text-body">Market & News</span>
          </button>
        </nav>

        <div class="p-6 border-t border-outline-variant/20 flex flex-col gap-3">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary font-bold text-xs">
              ${userEmail.charAt(0).toUpperCase()}
            </div>
            <div class="flex flex-col truncate">
              <span class="font-body text-body text-on-surface font-medium truncate" title="${userEmail}">${userEmail}</span>
              <span class="font-body-sm text-body-sm text-on-surface-variant">Live Portfolio</span>
            </div>
          </div>
          <button id="logout-btn" class="mt-2 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-error hover:bg-error-container/20 text-body-sm transition-colors w-full font-medium">
            <span class="material-symbols-outlined text-[18px]">logout</span>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      <!-- 2. MAIN CONTENT AREA (Responsive margins & padding) -->
      <div class="w-full md:pl-64 flex flex-col min-h-screen pb-20 md:pb-6">
        <!-- Top App Header -->
        <header class="h-16 bg-surface/90 backdrop-blur-xl sticky top-0 z-30 border-b border-outline-variant/20 flex items-center justify-between px-4 sm:px-8">
          <div class="flex items-center gap-3">
            <!-- Mobile Brand Indicator -->
            <div class="flex md:hidden items-center gap-2">
              <div class="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-on-primary shadow-sm">
                <span class="material-symbols-outlined text-[18px]">show_chart</span>
              </div>
              <span class="font-title text-base font-bold text-on-surface">Portfolio Pro</span>
            </div>
            <!-- Desktop Header Title -->
            <span class="hidden md:inline font-title text-title text-on-surface font-semibold" id="header-title">Live Portfolio Analytics</span>
          </div>
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs" title="${userEmail}">
              ${userEmail.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        <!-- Dynamic View Content Container -->
        <main id="view-content" class="flex-1 p-4 sm:p-6 lg:p-8">
          <div class="flex items-center justify-center h-64">
            <div class="animate-spin material-symbols-outlined text-primary text-[32px]">sync</div>
          </div>
        </main>
      </div>

      <!-- 3. MOBILE BOTTOM NAVIGATION BAR (Visible on < 768px) -->
      <nav class="flex md:hidden fixed bottom-0 left-0 right-0 h-16 bg-surface-container-lowest/95 backdrop-blur-md border-t border-outline-variant/20 z-50 items-center justify-around px-2 shadow-lg">
        <button id="mobile-nav-dashboard" class="flex flex-col items-center justify-center py-1 px-3 rounded-lg transition-colors ${state.currentView === 'dashboard' || state.currentView === 'portfolio-detail' ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-on-surface'}">
          <span class="material-symbols-outlined text-[22px]">dashboard</span>
          <span class="font-data-sm text-[10px] mt-0.5">Portfolios</span>
        </button>
        <button id="mobile-nav-activity" class="flex flex-col items-center justify-center py-1 px-3 rounded-lg transition-colors ${state.currentView === 'activity' ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-on-surface'}">
          <span class="material-symbols-outlined text-[22px]">history</span>
          <span class="font-data-sm text-[10px] mt-0.5">Activity</span>
        </button>
        <button id="mobile-nav-market" class="flex flex-col items-center justify-center py-1 px-3 rounded-lg transition-colors ${state.currentView === 'market' ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-on-surface'}">
          <span class="material-symbols-outlined text-[22px]">public</span>
          <span class="font-data-sm text-[10px] mt-0.5">Market</span>
        </button>
        <button id="mobile-nav-logout" class="flex flex-col items-center justify-center py-1 px-3 rounded-lg text-error hover:bg-error-container/20 transition-colors">
          <span class="material-symbols-outlined text-[22px]">logout</span>
          <span class="font-data-sm text-[10px] mt-0.5">Sign Out</span>
        </button>
      </nav>
    </div>
  `;
}

function attachShellEvents() {
  // Desktop navigation
  document.getElementById('nav-dashboard')?.addEventListener('click', () => navigateTo('dashboard'));
  document.getElementById('nav-activity')?.addEventListener('click', () => navigateTo('activity'));
  document.getElementById('nav-market')?.addEventListener('click', () => navigateTo('market'));
  document.getElementById('logout-btn')?.addEventListener('click', () => {
    window.api.clearAuth();
    showToast('Logged out', 'info');
    navigateTo('login');
  });

  // Mobile navigation
  document.getElementById('mobile-nav-dashboard')?.addEventListener('click', () => navigateTo('dashboard'));
  document.getElementById('mobile-nav-activity')?.addEventListener('click', () => navigateTo('activity'));
  document.getElementById('mobile-nav-market')?.addEventListener('click', () => navigateTo('market'));
  document.getElementById('mobile-nav-logout')?.addEventListener('click', () => {
    window.api.clearAuth();
    showToast('Logged out', 'info');
    navigateTo('login');
  });
}

// ==========================================
// 4. DASHBOARD VIEW
// ==========================================
async function loadDashboard() {
  const content = document.getElementById('view-content');
  if (!content) return;

  try {
    const portfolios = await window.api.getPortfolios();
    state.portfolios = portfolios;

    // Fetch valuations for all portfolios in parallel using real IDs
    const valuations = await Promise.all(
      portfolios.map(p => {
        const pId = p.id || p._id;
        return pId ? window.api.getPortfolioValuation(pId).catch(() => null) : null;
      })
    );

    let totalNetValue = 0;
    let totalInvested = 0;
    let totalCryptoValue = 0;
    let totalStockValue = 0;

    valuations.forEach(val => {
      if (val) {
        totalNetValue += val.total_current_value || 0;
        totalInvested += val.total_invested || 0;
        (val.holdings_valuation || val.holdings_valuations || []).forEach(h => {
          if (h.type === 'crypto') totalCryptoValue += h.current_value || 0;
          else totalStockValue += h.current_value || 0;
        });
      }
    });

    const totalGainLoss = totalNetValue - totalInvested;
    const totalGainLossPct = totalInvested > 0 ? (totalGainLoss / totalInvested) * 100 : 0;

    const totalAssets = totalCryptoValue + totalStockValue;
    const stockPct = totalAssets > 0 ? Math.round((totalStockValue / totalAssets) * 100) : 50;
    const cryptoPct = totalAssets > 0 ? Math.round((totalCryptoValue / totalAssets) * 100) : 50;

    content.innerHTML = `
      <div class="flex flex-col gap-6 animate-fade-in">
        <!-- Top Title & Action Bar -->
        <div class="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-end">
          <div class="flex flex-col gap-1">
            <h1 class="font-headline text-2xl sm:text-headline text-on-surface font-bold">Portfolio Overview</h1>
            <span class="font-body text-xs sm:text-body text-on-surface-variant">Live CoinGecko & Finnhub Analytics</span>
          </div>
          <div class="flex items-center gap-2 w-full sm:w-auto">
            <button id="refresh-dashboard-btn" class="flex-1 sm:flex-none bg-surface-container hover:bg-surface-container-high text-on-surface font-data-md text-data-md px-4 py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2">
              <span class="material-symbols-outlined text-[18px]">sync</span>
              <span>Refresh</span>
            </button>
            <button id="create-portfolio-btn" class="flex-1 sm:flex-none bg-primary hover:bg-primary-container text-on-primary font-data-md text-data-md px-4 py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm">
              <span class="material-symbols-outlined text-[18px]">add</span>
              <span>New Portfolio</span>
            </button>
          </div>
        </div>

        <!-- Metric KPI Cards (Responsive 1-col on mobile, 3-col on desktop) -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <!-- Total Net Value -->
          <div class="bg-surface-container-lowest rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col gap-3 border border-outline-variant/20">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2 text-on-surface-variant">
                <div class="w-8 h-8 rounded-full bg-primary-fixed flex items-center justify-center">
                  <span class="material-symbols-outlined text-on-primary-fixed text-[18px]">account_balance_wallet</span>
                </div>
                <span class="font-body text-sm font-medium">Total Net Value</span>
              </div>
            </div>
            <div class="flex flex-col">
              <span class="font-display text-2xl sm:text-[32px] text-on-surface font-data-lg tracking-tight">${formatCurrency(totalNetValue)}</span>
              <div class="flex items-center gap-2 mt-1">
                <span class="font-data-md text-data-md ${totalGainLoss >= 0 ? 'text-[#00875A]' : 'text-error'} font-semibold">${formatPercent(totalGainLossPct)}</span>
                <span class="font-body-sm text-body-sm text-on-surface-variant">overall return</span>
              </div>
            </div>
          </div>

          <!-- Total Gain / Loss -->
          <div class="bg-surface-container-lowest rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col gap-3 border border-outline-variant/20">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2 text-on-surface-variant">
                <div class="w-8 h-8 rounded-full ${totalGainLoss >= 0 ? 'bg-tertiary-fixed' : 'bg-error-container'} flex items-center justify-center">
                  <span class="material-symbols-outlined ${totalGainLoss >= 0 ? 'text-on-tertiary-fixed' : 'text-on-error-container'} text-[18px]">${totalGainLoss >= 0 ? 'trending_up' : 'trending_down'}</span>
                </div>
                <span class="font-body text-sm font-medium">Total Profit/Loss</span>
              </div>
            </div>
            <div class="flex flex-col">
              <span class="font-display text-2xl sm:text-[32px] font-data-lg tracking-tight ${totalGainLoss >= 0 ? 'text-tertiary' : 'text-error'}">${formatCurrency(totalGainLoss)}</span>
              <div class="flex items-center gap-2 mt-1">
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded ${totalGainLoss >= 0 ? 'bg-tertiary-fixed text-on-tertiary-fixed' : 'bg-error-container text-on-error-container'} font-data-sm text-data-sm font-bold">
                  <span class="material-symbols-outlined text-[14px]">${totalGainLoss >= 0 ? 'arrow_upward' : 'arrow_downward'}</span>
                  ${Math.abs(totalGainLossPct).toFixed(2)}%
                </span>
                <span class="font-body-sm text-body-sm text-on-surface-variant">Cost: ${formatCurrency(totalInvested)}</span>
              </div>
            </div>
          </div>

          <!-- Asset Allocation -->
          <div class="bg-surface-container-lowest rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col gap-3 border border-outline-variant/20">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2 text-on-surface-variant">
                <div class="w-8 h-8 rounded-full bg-secondary-fixed flex items-center justify-center">
                  <span class="material-symbols-outlined text-on-secondary-fixed text-[18px]">pie_chart</span>
                </div>
                <span class="font-body text-sm font-medium">Asset Allocation</span>
              </div>
            </div>
            <div class="flex flex-col gap-2 mt-1">
              <div class="w-full h-3 bg-surface-container-high rounded-full overflow-hidden flex">
                <div class="h-full bg-primary" style="width: ${stockPct}%;" title="Stocks: ${stockPct}%"></div>
                <div class="h-full bg-tertiary-container" style="width: ${cryptoPct}%;" title="Crypto: ${cryptoPct}%"></div>
              </div>
              <div class="flex justify-between mt-1 text-xs text-on-surface-variant font-medium">
                <span class="flex items-center gap-1.5"><div class="w-2.5 h-2.5 rounded-full bg-primary"></div>Stocks: ${formatCurrency(totalStockValue)} (${stockPct}%)</span>
                <span class="flex items-center gap-1.5"><div class="w-2.5 h-2.5 rounded-full bg-tertiary-container"></div>Crypto: ${formatCurrency(totalCryptoValue)} (${cryptoPct}%)</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Portfolios Section -->
        <div class="flex flex-col gap-4 mt-2">
          <div class="flex items-center justify-between">
            <span class="font-title text-title text-on-surface font-bold">Your Portfolios (${portfolios.length})</span>
          </div>

          ${portfolios.length === 0 ? `
            <div class="bg-surface-container-lowest rounded-2xl p-8 border border-outline-variant/20 flex flex-col items-center justify-center text-center gap-3 py-16">
              <div class="w-16 h-16 rounded-full bg-primary-container/20 flex items-center justify-center text-primary">
                <span class="material-symbols-outlined text-[32px]">folder_open</span>
              </div>
              <div class="flex flex-col gap-1">
                <h3 class="font-headline text-lg font-bold text-on-surface">No Portfolios Found</h3>
                <p class="font-body text-sm text-on-surface-variant max-w-sm">Create your first portfolio to start tracking your stocks and crypto holdings.</p>
              </div>
              <button id="empty-create-btn" class="bg-primary hover:bg-primary-container text-on-primary px-6 py-2.5 rounded-xl font-title text-sm flex items-center gap-2 mt-2 shadow-sm">
                <span class="material-symbols-outlined text-[18px]">add</span>
                <span>Create Portfolio</span>
              </button>
            </div>
          ` : `
            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              ${portfolios.map((p, idx) => {
                const pId = p.id || p._id;
                const val = valuations[idx];
                const holdingCount = (p.holdings || []).length;
                const pVal = val ? val.total_current_value : 0;
                const pGain = val ? val.total_gain_loss : 0;
                const pGainPct = val ? val.total_gain_loss_pct : 0;

                return `
                  <div class="bg-surface-container-lowest rounded-2xl p-5 shadow-sm hover:shadow-md transition-all border border-outline-variant/20 cursor-pointer flex flex-col justify-between group" data-portfolio-id="${pId}">
                    <div class="flex flex-col gap-3">
                      <div class="flex items-center justify-between">
                        <div class="flex items-center gap-3">
                          <div class="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-title text-lg font-bold">
                            ${p.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h3 class="font-title text-base text-on-surface group-hover:text-primary transition-colors font-bold">${p.name}</h3>
                            <span class="font-body-sm text-xs text-on-surface-variant">${holdingCount} ${holdingCount === 1 ? 'Holding' : 'Holdings'}</span>
                          </div>
                        </div>
                        <button class="delete-portfolio-btn text-on-surface-variant hover:text-error transition-colors p-1.5 rounded-full hover:bg-error-container/20" data-del-id="${pId}" title="Delete Portfolio">
                          <span class="material-symbols-outlined text-[20px]">delete</span>
                        </button>
                      </div>

                      <div class="flex flex-col mt-2">
                        <span class="font-data-lg text-2xl font-bold text-on-surface">${formatCurrency(pVal)}</span>
                        <div class="flex items-center gap-1.5 mt-1">
                          <span class="font-data-sm text-xs font-semibold ${pGain >= 0 ? 'text-[#00875A]' : 'text-error'}">${formatPercent(pGainPct)}</span>
                          <span class="font-body-sm text-xs text-on-surface-variant">(${formatCurrency(pGain)})</span>
                        </div>
                      </div>
                    </div>

                    <div class="mt-4 pt-3 border-t border-outline-variant/20 flex items-center justify-between text-primary font-title text-sm group-hover:translate-x-1 transition-transform">
                      <span class="font-semibold">View Holdings</span>
                      <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>
      </div>
    `;

    // Attach Dashboard Events
    document.getElementById('refresh-dashboard-btn')?.addEventListener('click', () => {
      showToast('Refreshing live prices...', 'info');
      loadDashboard();
    });

    document.getElementById('create-portfolio-btn')?.addEventListener('click', openCreatePortfolioModal);
    document.getElementById('empty-create-btn')?.addEventListener('click', openCreatePortfolioModal);

    document.querySelectorAll('[data-portfolio-id]').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.delete-portfolio-btn')) return;
        const pId = card.getAttribute('data-portfolio-id');
        if (pId && pId !== 'undefined') {
          navigateTo('portfolio-detail', { portfolioId: pId });
        } else {
          showToast('Invalid portfolio ID', 'error');
        }
      });
    });

    document.querySelectorAll('.delete-portfolio-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const pId = btn.getAttribute('data-del-id');
        if (!pId || pId === 'undefined') {
          showToast('Invalid portfolio ID for deletion', 'error');
          return;
        }
        if (confirm('Are you sure you want to delete this portfolio? All holdings will be removed.')) {
          try {
            await window.api.deletePortfolio(pId);
            showToast('Portfolio deleted', 'success');
            loadDashboard();
          } catch (err) {
            showToast(err.message, 'error');
          }
        }
      });
    });
  } catch (err) {
    content.innerHTML = `
      <div class="p-8 bg-error-container/20 rounded-2xl border border-error text-center flex flex-col items-center gap-4">
        <span class="material-symbols-outlined text-error text-[40px]">warning</span>
        <h2 class="font-headline text-lg font-bold text-on-surface">Error Loading Dashboard</h2>
        <p class="font-body text-sm text-on-surface-variant">${err.message}</p>
        <button onclick="window.location.reload()" class="bg-primary text-on-primary px-6 py-2 rounded-xl font-title text-sm">Retry</button>
      </div>
    `;
  }
}

// ==========================================
// 5. PORTFOLIO DETAIL VIEW & INTERACTIVE CHART MODAL
// ==========================================
async function loadPortfolioDetail(portfolioId) {
  const content = document.getElementById('view-content');
  if (!content) return;

  if (!portfolioId || portfolioId === 'undefined') {
    content.innerHTML = `
      <div class="p-8 bg-error-container/20 rounded-2xl border border-error text-center flex flex-col items-center gap-4">
        <span class="material-symbols-outlined text-error text-[40px]">warning</span>
        <h2 class="font-headline text-lg font-bold text-on-surface">Invalid Portfolio ID</h2>
        <p class="font-body text-sm text-on-surface-variant">Cannot load portfolio details without a valid ID.</p>
        <button onclick="navigateTo('dashboard')" class="bg-primary text-on-primary px-6 py-2 rounded-xl font-title text-sm">Back to Dashboard</button>
      </div>
    `;
    return;
  }

  try {
    const [portfolio, valuation] = await Promise.all([
      window.api.getPortfolio(portfolioId),
      window.api.getPortfolioValuation(portfolioId),
    ]);

    state.currentPortfolio = portfolio;
    state.currentValuation = valuation;

    const holdings = portfolio.holdings || [];
    const valMap = {};
    (valuation.holdings_valuation || valuation.holdings_valuations || []).forEach(v => {
      const hId = v.holding_id || v.id || v._id;
      if (hId) valMap[hId] = v;
    });

    content.innerHTML = `
      <div class="flex flex-col gap-6 animate-fade-in">
        <!-- Header / Breadcrumb & Actions -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <button id="back-to-dash-btn" class="p-2 rounded-full hover:bg-surface-container text-on-surface-variant transition-colors" title="Back to Dashboard">
              <span class="material-symbols-outlined text-[24px]">arrow_back</span>
            </button>
            <div>
              <h1 class="font-headline text-2xl font-bold text-on-surface flex items-center gap-2">
                ${portfolio.name}
              </h1>
              <p class="font-body-sm text-xs text-on-surface-variant">Created on ${new Date(portfolio.created_at).toLocaleDateString()} • Tap any holding to view price chart</p>
            </div>
          </div>
          <div class="flex items-center gap-2 w-full sm:w-auto">
            <button id="refresh-detail-btn" class="flex-1 sm:flex-none bg-surface-container hover:bg-surface-container-high text-on-surface font-body-sm text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-1.5 transition-colors">
              <span class="material-symbols-outlined text-[16px]">sync</span>
              <span>Refresh</span>
            </button>
            <button id="add-holding-btn" class="flex-1 sm:flex-none bg-primary hover:bg-primary-container text-on-primary py-2.5 px-4 rounded-xl font-body-sm text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors font-semibold">
              <span class="material-symbols-outlined text-[16px]">add</span>
              <span>Add Holding</span>
            </button>
          </div>
        </div>

        <!-- Metric KPI Cards -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <div class="bg-surface-container-lowest p-4 sm:p-5 rounded-2xl shadow-sm border border-outline-variant/20">
            <p class="font-body-sm text-[11px] text-on-surface-variant uppercase tracking-wider mb-1">Total Market Value</p>
            <p class="font-display text-xl sm:text-2xl text-on-surface font-bold">${formatCurrency(valuation.total_current_value)}</p>
            <div class="mt-1 flex items-center gap-1">
              <span class="font-data-sm text-[11px] text-on-surface-variant">Cost: ${formatCurrency(valuation.total_invested)}</span>
            </div>
          </div>

          <div class="bg-surface-container-lowest p-4 sm:p-5 rounded-2xl shadow-sm border border-outline-variant/20">
            <p class="font-body-sm text-[11px] text-on-surface-variant uppercase tracking-wider mb-1">Profit / Loss</p>
            <p class="font-display text-xl sm:text-2xl font-bold ${valuation.total_gain_loss >= 0 ? 'text-[#00875A]' : 'text-error'}">${formatCurrency(valuation.total_gain_loss)}</p>
            <div class="mt-1 flex items-center gap-1">
              <span class="font-data-sm text-[11px] font-semibold ${valuation.total_gain_loss >= 0 ? 'text-[#00875A]' : 'text-error'}">${formatPercent(valuation.total_gain_loss_pct)}</span>
            </div>
          </div>

          <div class="bg-surface-container-lowest p-4 sm:p-5 rounded-2xl shadow-sm border border-outline-variant/20">
            <p class="font-body-sm text-[11px] text-on-surface-variant uppercase tracking-wider mb-1">Active Positions</p>
            <p class="font-display text-xl sm:text-2xl text-on-surface font-bold">${holdings.length}</p>
            <div class="mt-1 flex items-center gap-1">
              <span class="font-data-sm text-[11px] text-on-surface-variant">Assets Tracked</span>
            </div>
          </div>

          <div class="bg-surface-container-lowest p-4 sm:p-5 rounded-2xl shadow-sm border border-outline-variant/20 flex flex-col justify-center">
            <p class="font-body-sm text-[11px] text-on-surface-variant uppercase tracking-wider mb-2">Live Feeds</p>
            <div class="flex flex-wrap items-center gap-1.5">
              <span class="px-2 py-0.5 rounded bg-primary/10 text-primary font-data-sm text-[10px] font-semibold">CoinGecko</span>
              <span class="px-2 py-0.5 rounded bg-secondary/10 text-secondary font-data-sm text-[10px] font-semibold">Finnhub</span>
            </div>
          </div>
        </div>

        <!-- Holdings Table Card -->
        <div class="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/20 overflow-hidden flex-1 flex flex-col">
          <div class="p-4 border-b border-outline-variant/20 bg-surface-container-low/50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
            <div class="flex items-center gap-2 bg-surface-container-low px-3 py-1.5 rounded-xl border border-outline-variant/30">
              <span class="material-symbols-outlined text-on-surface-variant text-[18px]">search</span>
              <input id="holding-search-input" class="bg-transparent border-none font-body text-sm text-on-surface focus:outline-none placeholder:text-on-surface-variant/50 w-full sm:w-64" placeholder="Filter positions..." type="text"/>
            </div>
            <span class="text-xs text-on-surface-variant hidden sm:inline">💡 Click any row to open the interactive price history chart</span>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr class="border-b border-outline-variant/20 bg-surface-container-lowest font-body-sm text-xs text-on-surface-variant uppercase tracking-wider font-semibold">
                  <th class="py-3 px-4 w-12 text-center"></th>
                  <th class="py-3 px-4">Symbol</th>
                  <th class="py-3 px-4">Name</th>
                  <th class="py-3 px-4">Type</th>
                  <th class="py-3 px-4 text-right">Quantity</th>
                  <th class="py-3 px-4 text-right">Avg Price</th>
                  <th class="py-3 px-4 text-right">Live Price</th>
                  <th class="py-3 px-4 text-right">Market Value</th>
                  <th class="py-3 px-4 text-right">Gain/Loss ($)</th>
                  <th class="py-3 px-4 text-right">Gain/Loss (%)</th>
                  <th class="py-3 px-4 w-20 text-center">Chart / Del</th>
                </tr>
              </thead>
              <tbody id="holdings-tbody" class="font-body text-sm text-on-surface divide-y divide-outline-variant/10">
                ${renderHoldingRows(holdings, valMap)}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    // Attach Detail Events
    document.getElementById('back-to-dash-btn')?.addEventListener('click', () => navigateTo('dashboard'));
    document.getElementById('refresh-detail-btn')?.addEventListener('click', () => {
      showToast('Refreshing live prices...', 'info');
      loadPortfolioDetail(portfolioId);
    });
    document.getElementById('add-holding-btn')?.addEventListener('click', () => openAddHoldingModal(portfolioId));

    document.getElementById('holding-search-input')?.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      const filtered = holdings.filter(h => (h.symbol || '').toLowerCase().includes(q) || (h.name || '').toLowerCase().includes(q));
      const tbody = document.getElementById('holdings-tbody');
      if (tbody) tbody.innerHTML = renderHoldingRows(filtered, valMap);
      attachHoldingRowActions(portfolioId, holdings, valMap);
    });

    attachHoldingRowActions(portfolioId, holdings, valMap);
  } catch (err) {
    content.innerHTML = `
      <div class="p-8 bg-error-container/20 rounded-2xl border border-error text-center flex flex-col items-center gap-4">
        <span class="material-symbols-outlined text-error text-[40px]">warning</span>
        <h2 class="font-headline text-lg font-bold text-on-surface">Error Loading Portfolio</h2>
        <p class="font-body text-sm text-on-surface-variant">${err.message}</p>
        <button onclick="navigateTo('dashboard')" class="bg-primary text-on-primary px-6 py-2 rounded-xl font-title text-sm">Back to Dashboard</button>
      </div>
    `;
  }
}

function renderHoldingRows(holdings, valMap) {
  if (holdings.length === 0) {
    return `
      <tr>
        <td colspan="11" class="py-12 text-center text-on-surface-variant font-body">
          <div class="flex flex-col items-center gap-2">
            <span class="material-symbols-outlined text-[32px] text-outline">account_balance_wallet</span>
            <span>No holdings in this portfolio yet.</span>
          </div>
        </td>
      </tr>
    `;
  }

  return holdings.map(h => {
    const hId = h.id || h._id;
    const val = valMap[hId] || {};
    const livePrice = val.current_price !== undefined ? val.current_price : null;
    const currentVal = val.current_value !== undefined ? val.current_value : (h.quantity * h.average_buy_price);
    const gain = val.gain_loss !== undefined ? val.gain_loss : 0;
    const gainPct = val.gain_loss_pct !== undefined ? val.gain_loss_pct : 0;

    return `
      <tr class="holding-row hover:bg-surface-container-low/70 transition-colors group cursor-pointer" data-holding-row-id="${hId}">
        <td class="py-3 px-4 text-center">
          <div class="w-8 h-8 rounded-full ${h.type === 'crypto' ? 'bg-tertiary-fixed text-on-tertiary-fixed' : 'bg-primary-fixed text-on-primary-fixed'} flex items-center justify-center font-data-sm text-[11px] font-bold">
            ${(h.symbol || '---').slice(0, 3)}
          </div>
        </td>
        <td class="py-3 px-4 font-title text-sm font-bold text-primary group-hover:underline">${h.symbol}</td>
        <td class="py-3 px-4 text-on-surface-variant font-medium text-xs truncate max-w-[150px]">${h.name || h.symbol}</td>
        <td class="py-3 px-4">
          <span class="px-2 py-0.5 rounded ${h.type === 'crypto' ? 'bg-tertiary-fixed text-on-tertiary-fixed' : 'bg-primary-fixed text-on-primary-fixed'} font-body-sm text-[10px] uppercase font-bold">
            ${h.type}
          </span>
        </td>
        <td class="py-3 px-4 font-data-md text-sm text-right text-on-surface">${formatNumber(h.quantity)}</td>
        <td class="py-3 px-4 font-data-md text-sm text-right text-on-surface-variant">${formatCurrency(h.average_buy_price)}</td>
        <td class="py-3 px-4 font-data-md text-sm text-right text-on-surface font-semibold">${livePrice !== null ? formatCurrency(livePrice) : '<span class="text-outline">Syncing...</span>'}</td>
        <td class="py-3 px-4 font-data-md text-sm text-right text-on-surface font-bold">${formatCurrency(currentVal)}</td>
        <td class="py-3 px-4 font-data-md text-sm text-right ${gain >= 0 ? 'text-[#00875A]' : 'text-error'} font-semibold">${formatCurrency(gain)}</td>
        <td class="py-3 px-4 font-data-md text-sm text-right ${gain >= 0 ? 'text-[#00875A]' : 'text-error'} font-semibold">
          <span class="inline-flex items-center gap-0.5">
            <span class="material-symbols-outlined text-[14px]">${gain >= 0 ? 'arrow_upward' : 'arrow_downward'}</span>
            ${Math.abs(gainPct).toFixed(2)}%
          </span>
        </td>
        <td class="py-3 px-4 text-center">
          <div class="flex items-center justify-center gap-1">
            <button class="open-chart-btn text-primary hover:bg-primary/10 transition-colors p-1.5 rounded-full" data-holding-id="${hId}" title="View Price Chart">
              <span class="material-symbols-outlined text-[18px]">show_chart</span>
            </button>
            <button class="delete-holding-btn text-outline hover:text-error transition-colors p-1.5 rounded-full hover:bg-error-container/20" data-holding-id="${hId}" data-symbol="${h.symbol}" title="Delete Holding">
              <span class="material-symbols-outlined text-[18px]">delete</span>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function attachHoldingRowActions(portfolioId, holdings, valMap) {
  // Row Click & Chart Icon Click -> Open Interactive Price History Chart Modal
  const openChartForHolding = (hId) => {
    const holding = holdings.find(h => (h.id || h._id) === hId);
    if (holding) {
      const val = valMap[hId] || {};
      openHoldingChartModal(portfolioId, holding, val);
    }
  };

  document.querySelectorAll('.holding-row').forEach(row => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('.delete-holding-btn')) return;
      const hId = row.getAttribute('data-holding-row-id');
      openChartForHolding(hId);
    });
  });

  document.querySelectorAll('.open-chart-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const hId = btn.getAttribute('data-holding-id');
      openChartForHolding(hId);
    });
  });

  // Delete Holding
  document.querySelectorAll('.delete-holding-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const holdingId = btn.getAttribute('data-holding-id');
      const symbol = btn.getAttribute('data-symbol');
      if (!holdingId || holdingId === 'undefined') {
        showToast('Invalid holding ID', 'error');
        return;
      }
      if (confirm(`Remove holding ${symbol} from this portfolio?`)) {
        try {
          await window.api.deleteHolding(portfolioId, holdingId);
          showToast(`Removed ${symbol}`, 'success');
          loadPortfolioDetail(portfolioId);
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    });
  });
}

// ==========================================
// 6. INTERACTIVE PRICE HISTORY CHART MODAL
// ==========================================
function openHoldingChartModal(portfolioId, holding, val = {}) {
  const modalContainer = document.getElementById('modal-container');
  if (!modalContainer) return;

  const symbol = holding.symbol || '---';
  const name = holding.name || symbol;
  const type = holding.type || 'stock';
  const qty = holding.quantity || 0;
  const avgBuy = holding.average_buy_price || 0;
  const invested = qty * avgBuy;
  const livePrice = val.current_price !== undefined ? val.current_price : avgBuy;
  const currentVal = val.current_value !== undefined ? val.current_value : (qty * livePrice);
  const gain = val.gain_loss !== undefined ? val.gain_loss : (currentVal - invested);
  const gainPct = val.gain_loss_pct !== undefined ? val.gain_loss_pct : (invested > 0 ? (gain / invested) * 100 : 0);

  let activeInterval = '1M';

  modalContainer.innerHTML = `
    <div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 animate-fade-in">
      <div class="bg-surface-container-lowest rounded-2xl shadow-2xl max-w-2xl w-full p-5 sm:p-6 flex flex-col gap-4 border border-outline-variant/30 max-h-[92vh] overflow-y-auto">
        <!-- Modal Header -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl ${type === 'crypto' ? 'bg-tertiary-fixed text-on-tertiary-fixed' : 'bg-primary-fixed text-on-primary-fixed'} flex items-center justify-center font-bold text-sm">
              ${symbol.slice(0, 3)}
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h2 class="font-headline text-lg sm:text-xl font-bold text-on-surface">${symbol}</h2>
                <span class="px-2 py-0.5 rounded ${type === 'crypto' ? 'bg-tertiary-fixed text-on-tertiary-fixed' : 'bg-primary-fixed text-on-primary-fixed'} font-data-sm text-[10px] uppercase font-bold">
                  ${type}
                </span>
              </div>
              <p class="font-body-sm text-xs text-on-surface-variant truncate max-w-[280px]">${name}</p>
            </div>
          </div>
          <button id="close-chart-modal-btn" class="text-outline hover:text-on-surface p-1.5 rounded-full hover:bg-surface-container transition-colors">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <!-- Live Price & Period Change Banner -->
        <div class="flex flex-wrap items-end justify-between gap-2 p-4 bg-surface-container-low rounded-xl">
          <div>
            <span class="font-body-sm text-[11px] text-on-surface-variant uppercase tracking-wider">Current Market Price</span>
            <div class="flex items-baseline gap-2">
              <span id="chart-live-price" class="font-data-lg text-2xl font-bold text-on-surface">${formatCurrency(livePrice)}</span>
              <span id="chart-interval-change" class="font-data-sm text-xs font-bold text-[#00875A]">Loading history...</span>
            </div>
          </div>
          <!-- Interval Selector Tabs -->
          <div class="flex items-center gap-1 bg-surface-container-high p-1 rounded-xl">
            ${['1D', '1W', '1M', '3M', '1Y'].map(inv => `
              <button class="interval-btn px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${inv === activeInterval ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}" data-interval="${inv}">
                ${inv}
              </button>
            `).join('')}
          </div>
        </div>

        <!-- Canvas Chart Container -->
        <div class="relative w-full h-64 bg-surface-container-lowest rounded-xl p-2 border border-outline-variant/20 flex items-center justify-center">
          <div id="chart-loading-overlay" class="absolute inset-0 bg-surface-container-lowest/80 backdrop-blur-xs flex items-center justify-center z-10">
            <div class="flex flex-col items-center gap-2 text-primary font-body-sm text-xs font-medium">
              <span class="animate-spin material-symbols-outlined text-[24px]">sync</span>
              <span>Fetching price history...</span>
            </div>
          </div>
          <canvas id="holding-price-chart" class="w-full h-full"></canvas>
        </div>

        <!-- Holding Position Statistics -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 p-3 bg-surface-container-low rounded-xl">
          <div class="flex flex-col">
            <span class="font-body-sm text-[10px] text-on-surface-variant uppercase">Quantity</span>
            <span class="font-data-md text-xs sm:text-sm font-bold text-on-surface">${formatNumber(qty)}</span>
          </div>
          <div class="flex flex-col">
            <span class="font-body-sm text-[10px] text-on-surface-variant uppercase">Avg Buy Price</span>
            <span class="font-data-md text-xs sm:text-sm font-bold text-on-surface">${formatCurrency(avgBuy)}</span>
          </div>
          <div class="flex flex-col">
            <span class="font-body-sm text-[10px] text-on-surface-variant uppercase">Total Position Value</span>
            <span class="font-data-md text-xs sm:text-sm font-bold text-on-surface">${formatCurrency(currentVal)}</span>
          </div>
          <div class="flex flex-col">
            <span class="font-body-sm text-[10px] text-on-surface-variant uppercase">Unrealized Gain</span>
            <span class="font-data-md text-xs sm:text-sm font-bold ${gain >= 0 ? 'text-[#00875A]' : 'text-error'}">
              ${formatCurrency(gain)} (${formatPercent(gainPct)})
            </span>
          </div>
        </div>
      </div>
    </div>
  `;

  const close = () => {
    if (state.activeChartInstance) {
      state.activeChartInstance.destroy();
      state.activeChartInstance = null;
    }
    modalContainer.innerHTML = '';
  };

  document.getElementById('close-chart-modal-btn')?.addEventListener('click', close);

  const renderChart = async (interval) => {
    activeInterval = interval;
    const loadingOverlay = document.getElementById('chart-loading-overlay');
    const changeBadge = document.getElementById('chart-interval-change');
    const livePriceEl = document.getElementById('chart-live-price');
    const canvas = document.getElementById('holding-price-chart');

    if (loadingOverlay) loadingOverlay.classList.remove('hidden');

    // Update interval buttons styling
    document.querySelectorAll('.interval-btn').forEach(btn => {
      const isCurrent = btn.getAttribute('data-interval') === interval;
      btn.className = `interval-btn px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${isCurrent ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`;
    });

    try {
      const history = await window.api.getPriceHistory(symbol, type, interval);
      if (loadingOverlay) loadingOverlay.classList.add('hidden');

      const points = history.data || [];
      if (points.length === 0) {
        if (changeBadge) changeBadge.textContent = 'No historical points';
        return;
      }

      const currP = history.current_price || points[points.length - 1].price;
      const chg = history.change || 0;
      const chgPct = history.change_pct || 0;
      const isPositive = chg >= 0;

      if (livePriceEl) livePriceEl.textContent = formatCurrency(currP);
      if (changeBadge) {
        changeBadge.className = `font-data-sm text-xs font-bold ${isPositive ? 'text-[#00875A]' : 'text-error'}`;
        changeBadge.textContent = `${isPositive ? '+' : ''}${formatCurrency(chg)} (${isPositive ? '+' : ''}${chgPct.toFixed(2)}%) past ${interval}`;
      }

      if (!canvas || !window.Chart) return;

      if (state.activeChartInstance) {
        state.activeChartInstance.destroy();
      }

      const ctx = canvas.getContext('2d');
      const gradient = ctx.createLinearGradient(0, 0, 0, 240);
      if (isPositive) {
        gradient.addColorStop(0, 'rgba(0, 135, 90, 0.25)');
        gradient.addColorStop(1, 'rgba(0, 135, 90, 0.0)');
      } else {
        gradient.addColorStop(0, 'rgba(186, 26, 26, 0.25)');
        gradient.addColorStop(1, 'rgba(186, 26, 26, 0.0)');
      }

      const labels = points.map(pt => {
        const d = new Date(pt.timestamp);
        return interval === '1D' 
          ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
      });

      const prices = points.map(pt => pt.price);

      state.activeChartInstance = new window.Chart(ctx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: `${symbol} Price`,
            data: prices,
            borderColor: isPositive ? '#00875A' : '#BA1A1A',
            borderWidth: 2.2,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: isPositive ? '#00875A' : '#BA1A1A',
            pointHoverBorderColor: '#ffffff',
            pointHoverBorderWidth: 2,
            backgroundColor: gradient,
            fill: true,
            tension: 0.25,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: 'index',
            intersect: false,
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#1a1c1d',
              titleColor: '#f9f9fb',
              bodyColor: '#ffffff',
              borderColor: 'rgba(193, 198, 215, 0.3)',
              borderWidth: 1,
              padding: 10,
              displayColors: false,
              callbacks: {
                label: (context) => `Price: ${formatCurrency(context.raw)}`,
                title: (context) => {
                  const idx = context[0].dataIndex;
                  const pt = points[idx];
                  return new Date(pt.timestamp).toLocaleString();
                }
              }
            }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: {
                color: '#717786',
                font: { family: 'Inter', size: 10 },
                maxTicksLimit: 6,
              }
            },
            y: {
              grid: {
                color: 'rgba(193, 198, 215, 0.15)',
                drawBorder: false,
              },
              ticks: {
                color: '#717786',
                font: { family: 'JetBrains Mono', size: 10 },
                callback: (val) => formatCurrency(val),
              }
            }
          }
        }
      });
    } catch (err) {
      if (loadingOverlay) loadingOverlay.classList.add('hidden');
      if (changeBadge) changeBadge.textContent = 'Failed to load history';
    }
  };

  // Attach Interval Buttons Click
  document.querySelectorAll('.interval-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const inv = btn.getAttribute('data-interval');
      renderChart(inv);
    });
  });

  // Initial render with default 1M
  renderChart('1M');
}

// ==========================================
// 7. ACTIVITY & MARKET VIEWS
// ==========================================
async function loadActivity() {
  const content = document.getElementById('view-content');
  if (!content) return;

  try {
    const transactions = await window.api.getTransactions();
    content.innerHTML = `
      <div class="flex flex-col gap-6 animate-fade-in">
        <div>
          <h1 class="font-headline text-2xl font-bold text-on-surface">Activity & Trade Logs</h1>
          <p class="font-body text-sm text-on-surface-variant">Historical transaction ledger</p>
        </div>

        <div class="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/20 overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr class="border-b border-outline-variant/20 bg-surface-container-lowest font-body-sm text-xs text-on-surface-variant uppercase tracking-wider font-semibold">
                  <th class="py-3 px-4">Date</th>
                  <th class="py-3 px-4">Action</th>
                  <th class="py-3 px-4">Symbol</th>
                  <th class="py-3 px-4 text-right">Quantity</th>
                  <th class="py-3 px-4 text-right">Price</th>
                  <th class="py-3 px-4 text-right">Total Amount</th>
                </tr>
              </thead>
              <tbody class="font-body text-sm text-on-surface divide-y divide-outline-variant/10">
                ${transactions.length === 0 ? `
                  <tr><td colspan="6" class="py-8 text-center text-on-surface-variant text-sm">No recorded transactions yet.</td></tr>
                ` : transactions.map(t => `
                  <tr>
                    <td class="py-3 px-4 text-on-surface-variant font-data-sm text-xs">${new Date(t.timestamp).toLocaleString()}</td>
                    <td class="py-3 px-4 font-semibold"><span class="px-2 py-0.5 rounded bg-primary-fixed text-on-primary-fixed font-data-sm text-[11px]">${t.type}</span></td>
                    <td class="py-3 px-4 font-title text-sm font-bold">${t.symbol}</td>
                    <td class="py-3 px-4 text-right font-data-md text-xs">${formatNumber(t.quantity)}</td>
                    <td class="py-3 px-4 text-right font-data-md text-xs">${formatCurrency(t.price_at_transaction)}</td>
                    <td class="py-3 px-4 text-right font-data-md text-xs font-bold">${formatCurrency(t.quantity * t.price_at_transaction)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadMarket() {
  const content = document.getElementById('view-content');
  if (!content) return;

  try {
    const [exchanges, news] = await Promise.all([
      window.api.getExchanges(),
      window.api.getNews(),
    ]);

    content.innerHTML = `
      <div class="flex flex-col gap-6 animate-fade-in">
        <div>
          <h1 class="font-headline text-2xl font-bold text-on-surface">Market Intelligence & News</h1>
          <p class="font-body text-sm text-on-surface-variant">Supported trading venues & latest financial headlines</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Exchanges -->
          <div class="bg-surface-container-lowest p-5 rounded-2xl shadow-sm border border-outline-variant/20 flex flex-col gap-3">
            <h2 class="font-title text-base font-bold text-on-surface flex items-center gap-2">
              <span class="material-symbols-outlined text-primary">account_balance</span>
              Supported Exchanges
            </h2>
            <div class="divide-y divide-outline-variant/10">
              ${exchanges.map(ex => `
                <div class="py-3 flex items-center justify-between">
                  <div>
                    <span class="font-title text-sm font-semibold text-on-surface">${ex.name}</span>
                    <p class="font-body-sm text-xs text-on-surface-variant">${ex.country}</p>
                  </div>
                  ${ex.url ? `<a href="${ex.url}" target="_blank" class="text-primary font-body-sm text-xs hover:underline flex items-center gap-1 font-semibold">Visit <span class="material-symbols-outlined text-[14px]">open_in_new</span></a>` : ''}
                </div>
              `).join('')}
            </div>
          </div>

          <!-- News -->
          <div class="bg-surface-container-lowest p-5 rounded-2xl shadow-sm border border-outline-variant/20 flex flex-col gap-3">
            <h2 class="font-title text-base font-bold text-on-surface flex items-center gap-2">
              <span class="material-symbols-outlined text-tertiary">newspaper</span>
              Market News Feed
            </h2>
            <div class="divide-y divide-outline-variant/10">
              ${news.length === 0 ? `<p class="py-4 text-on-surface-variant text-sm">No recent market news.</p>` : news.map(n => `
                <div class="py-3 flex flex-col gap-1">
                  <a href="${n.url}" target="_blank" class="font-title text-sm font-semibold text-on-surface hover:text-primary transition-colors">${n.headline}</a>
                  <div class="flex items-center gap-2 text-xs text-on-surface-variant">
                    <span>${n.source}</span>
                    <span>•</span>
                    <span>${new Date(n.published_at).toLocaleDateString()}</span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ==========================================
// 8. MODALS (Create Portfolio, Searchable Add Holding, Session Expired)
// ==========================================
function openCreatePortfolioModal() {
  const modalContainer = document.getElementById('modal-container');
  if (!modalContainer) return;

  modalContainer.innerHTML = `
    <div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div class="bg-surface-container-lowest rounded-2xl shadow-2xl max-w-md w-full p-6 flex flex-col gap-4 border border-outline-variant/20">
        <div class="flex items-center justify-between">
          <h2 class="font-headline text-lg font-bold text-on-surface">New Portfolio</h2>
          <button id="close-modal-btn" class="text-outline hover:text-on-surface p-1 rounded-full">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form id="create-portfolio-form" class="flex flex-col gap-4">
          <div class="flex flex-col gap-1">
            <label class="font-data-sm text-data-sm text-on-surface-variant uppercase tracking-wide" for="new-p-name">Portfolio Name</label>
            <input id="new-p-name" class="w-full bg-surface-container h-12 rounded-xl px-4 font-body text-body text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-on-surface-variant/50" placeholder="e.g. High Growth Fund" required type="text"/>
          </div>

          <div class="flex items-center justify-end gap-2 mt-2">
            <button type="button" id="cancel-portfolio-btn" class="px-4 py-2.5 rounded-xl bg-surface-container text-on-surface font-title text-sm">Cancel</button>
            <button type="submit" id="save-portfolio-btn" class="px-5 py-2.5 rounded-xl bg-primary text-on-primary font-title text-sm hover:bg-primary-container transition-colors font-semibold">Create</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const close = () => modalContainer.innerHTML = '';
  document.getElementById('close-modal-btn')?.addEventListener('click', close);
  document.getElementById('cancel-portfolio-btn')?.addEventListener('click', close);

  document.getElementById('create-portfolio-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('new-p-name').value.trim();
    if (!name) return;

    try {
      await window.api.createPortfolio(name);
      showToast(`Portfolio "${name}" created!`, 'success');
      close();
      loadDashboard();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

function openAddHoldingModal(portfolioId) {
  const modalContainer = document.getElementById('modal-container');
  if (!modalContainer) return;

  // Holding Modal State
  let selectedAsset = null;
  let currentType = 'stock'; // 'stock' or 'crypto'

  const stockCount = state.symbolStats.stocks_count.toLocaleString();
  const cryptoCount = state.symbolStats.crypto_count.toLocaleString();

  modalContainer.innerHTML = `
    <div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 animate-fade-in">
      <div class="bg-surface-container-lowest rounded-2xl shadow-2xl max-w-lg w-full p-5 sm:p-6 flex flex-col gap-4 border border-outline-variant/20 max-h-[92vh] overflow-y-auto">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <span class="material-symbols-outlined text-[18px]">add_circle</span>
            </div>
            <div>
              <h2 class="font-headline text-lg font-bold text-on-surface">Add New Holding</h2>
              <p id="catalog-stat-banner" class="font-data-sm text-[11px] text-primary font-semibold">
                Searching across ${stockCount} US Stocks & ETFs (Finnhub)
              </p>
            </div>
          </div>
          <button id="close-modal-btn" class="text-outline hover:text-on-surface p-1 rounded-full">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form id="add-holding-form" class="flex flex-col gap-4">
          <!-- Asset Type Selection Tabs -->
          <div class="flex flex-col gap-1">
            <label class="font-body-sm text-xs text-on-surface-variant font-medium">Select Asset Class</label>
            <div class="grid grid-cols-2 gap-1 bg-surface-container p-1 rounded-xl">
              <button type="button" id="tab-stock" class="py-2 rounded-lg font-title text-xs font-bold transition-all bg-surface-container-lowest text-primary shadow-sm flex items-center justify-center gap-1.5">
                <span class="material-symbols-outlined text-[18px]">show_chart</span>
                <span>Stock (${stockCount})</span>
              </button>
              <button type="button" id="tab-crypto" class="py-2 rounded-lg font-title text-xs font-bold transition-all text-on-surface-variant hover:text-on-surface flex items-center justify-center gap-1.5">
                <span class="material-symbols-outlined text-[18px]">currency_bitcoin</span>
                <span>Crypto (${cryptoCount})</span>
              </button>
            </div>
          </div>

          <!-- Searchable Symbol Autocomplete Input -->
          <div class="flex flex-col gap-1 relative">
            <label class="font-body-sm text-xs text-on-surface-variant font-medium">Search Ticker & Company Name</label>
            <div class="relative">
              <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline" style="font-size: 20px;">search</span>
              <input id="symbol-search-input" class="w-full bg-surface-container rounded-xl h-11 pl-10 pr-10 font-body text-sm text-on-surface uppercase outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-on-surface-variant/40" placeholder="Type symbol or name (e.g. AAPL, NVDA, BTC, ETH)..." autocomplete="off" type="text"/>
              <div id="search-spinner" class="hidden absolute right-3 top-1/2 -translate-y-1/2">
                <span class="animate-spin material-symbols-outlined text-[18px] text-primary">sync</span>
              </div>
            </div>

            <!-- Autocomplete Dropdown Menu -->
            <div id="symbol-dropdown" class="hidden absolute top-full left-0 right-0 mt-1 bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant/30 max-h-60 overflow-y-auto z-50 divide-y divide-outline-variant/10">
              <!-- Search items populated dynamically -->
            </div>

            <!-- Selected Asset Badge -->
            <div id="selected-asset-box" class="hidden mt-2 p-3 bg-primary-fixed/30 border border-primary/20 rounded-xl flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div id="selected-asset-avatar" class="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center font-data-sm text-[11px] font-bold">
                  AAPL
                </div>
                <div>
                  <div class="flex items-center gap-1.5">
                    <span id="selected-symbol-text" class="font-title text-sm font-bold text-on-surface">AAPL</span>
                    <span id="selected-type-badge" class="px-2 py-0.5 rounded bg-primary-fixed text-on-primary-fixed font-data-sm text-[9px] uppercase font-bold">Stock</span>
                  </div>
                  <p id="selected-name-text" class="font-body-sm text-xs text-on-surface-variant truncate max-w-[200px]">Apple Inc.</p>
                </div>
              </div>
              <button type="button" id="change-asset-btn" class="text-primary text-xs font-semibold hover:underline flex items-center gap-1">
                <span class="material-symbols-outlined text-[16px]">edit</span>
                <span>Change</span>
              </button>
            </div>
          </div>

          <!-- Quantity and Buy Price Inputs -->
          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1">
              <label class="font-body-sm text-xs text-on-surface-variant font-medium" for="h-qty">Quantity</label>
              <input id="h-qty" class="bg-surface-container h-11 rounded-xl px-3 font-data-md text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/20" placeholder="0.00" step="any" min="0.00000001" required type="number"/>
            </div>
            <div class="flex flex-col gap-1">
              <label class="font-body-sm text-xs text-on-surface-variant font-medium" for="h-price">Avg Price ($ USD)</label>
              <input id="h-price" class="bg-surface-container h-11 rounded-xl px-3 font-data-md text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/20" placeholder="0.00" step="any" min="0" required type="number"/>
            </div>
          </div>

          <!-- Dynamic Total Calculation -->
          <div class="flex items-center justify-between p-3 bg-surface-container-low rounded-xl">
            <span class="font-body-sm text-xs text-on-surface-variant">Estimated Total Cost:</span>
            <span id="h-total-calc" class="font-data-md text-sm font-bold text-primary">$0.00</span>
          </div>

          <div id="add-holding-error" class="hidden p-3 bg-error-container/50 border border-error/20 text-on-error-container rounded-lg text-body-sm flex items-center gap-2">
            <span class="material-symbols-outlined text-[18px] text-error">error</span>
            <span id="add-holding-error-text"></span>
          </div>

          <div class="flex items-center justify-end gap-2 mt-2">
            <button type="button" id="cancel-holding-btn" class="px-4 py-2.5 rounded-xl bg-surface-container text-on-surface font-title text-sm">Cancel</button>
            <button type="submit" id="save-holding-btn" class="px-5 py-2.5 rounded-xl bg-primary text-on-primary font-title text-sm hover:bg-primary-container transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold">Save Holding</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const close = () => modalContainer.innerHTML = '';
  document.getElementById('close-modal-btn')?.addEventListener('click', close);
  document.getElementById('cancel-holding-btn')?.addEventListener('click', close);

  const searchInput = document.getElementById('symbol-search-input');
  const searchSpinner = document.getElementById('search-spinner');
  const dropdown = document.getElementById('symbol-dropdown');
  const tabStock = document.getElementById('tab-stock');
  const tabCrypto = document.getElementById('tab-crypto');
  const statBanner = document.getElementById('catalog-stat-banner');
  const selectedBox = document.getElementById('selected-asset-box');
  const selectedAvatar = document.getElementById('selected-asset-avatar');
  const selectedSymbolText = document.getElementById('selected-symbol-text');
  const selectedTypeText = document.getElementById('selected-type-badge');
  const selectedNameText = document.getElementById('selected-name-text');
  const changeAssetBtn = document.getElementById('change-asset-btn');
  const qtyInput = document.getElementById('h-qty');
  const priceInput = document.getElementById('h-price');
  const calcDisplay = document.getElementById('h-total-calc');
  const errBox = document.getElementById('add-holding-error');
  const errText = document.getElementById('add-holding-error-text');

  const updateCost = () => {
    const q = parseFloat(qtyInput.value) || 0;
    const p = parseFloat(priceInput.value) || 0;
    calcDisplay.textContent = formatCurrency(q * p);
  };
  qtyInput?.addEventListener('input', updateCost);
  priceInput?.addEventListener('input', updateCost);

  // Tab Switching
  const setType = (type) => {
    currentType = type;
    selectedAsset = null;
    selectedBox.classList.add('hidden');
    searchInput.classList.remove('hidden');
    searchInput.value = '';
    
    if (type === 'stock') {
      tabStock.className = 'py-2 rounded-lg font-title text-xs font-bold transition-all bg-surface-container-lowest text-primary shadow-sm flex items-center justify-center gap-1.5';
      tabCrypto.className = 'py-2 rounded-lg font-title text-xs font-bold transition-all text-on-surface-variant hover:text-on-surface flex items-center justify-center gap-1.5';
      statBanner.textContent = `Searching across ${state.symbolStats.stocks_count.toLocaleString()} US Stocks & ETFs (Finnhub)`;
      searchInput.placeholder = `Search all ${state.symbolStats.stocks_count.toLocaleString()} stocks (e.g. AAPL, NVDA, PLTR)...`;
    } else {
      tabCrypto.className = 'py-2 rounded-lg font-title text-xs font-bold transition-all bg-surface-container-lowest text-primary shadow-sm flex items-center justify-center gap-1.5';
      tabStock.className = 'py-2 rounded-lg font-title text-xs font-bold transition-all text-on-surface-variant hover:text-on-surface flex items-center justify-center gap-1.5';
      statBanner.textContent = `Searching across ${state.symbolStats.crypto_count.toLocaleString()} Cryptocurrencies (CoinGecko)`;
      searchInput.placeholder = `Search all ${state.symbolStats.crypto_count.toLocaleString()} coins (e.g. BTC, ETH, SOL)...`;
    }
    fetchAndDisplaySymbols('');
  };

  tabStock?.addEventListener('click', () => setType('stock'));
  tabCrypto?.addEventListener('click', () => setType('crypto'));

  // Local Client Filtering
  const filterCatalogLocally = (catalog, q, limit = 50) => {
    if (!catalog || catalog.length === 0) return null;
    const query = q.trim().toUpperCase();
    if (!query) return catalog.slice(0, limit);

    const exact = [];
    const prefix = [];
    const word = [];
    const substring = [];

    for (let i = 0; i < catalog.length; i++) {
      const it = catalog[i];
      const sym = it.symbol.toUpperCase();
      const name = (it.name || '').toUpperCase();

      if (sym === query) {
        exact.push(it);
      } else if (sym.startsWith(query)) {
        prefix.push(it);
      } else if (name.startsWith(query) || name.includes(` ${query}`)) {
        word.push(it);
      } else if (sym.includes(query) || name.includes(query)) {
        substring.push(it);
      }

      if (exact.length + prefix.length >= limit) break;
    }

    const combined = [...exact, ...prefix, ...word, ...substring];
    return combined.slice(0, limit);
  };

  const renderDropdownList = (results, countLabel) => {
    if (!results || results.length === 0) {
      dropdown.innerHTML = `<div class="p-4 text-center text-on-surface-variant font-body-sm text-xs">No matching ${currentType === 'crypto' ? 'coins' : 'stocks'} found.</div>`;
      dropdown.classList.remove('hidden');
      return;
    }

    dropdown.innerHTML = `
      <div class="px-4 py-2 bg-surface-container-low font-data-sm text-[10px] text-on-surface-variant flex items-center justify-between border-b border-outline-variant/10">
        <span>${countLabel || `Found ${results.length} matches`}</span>
        <span class="text-primary font-semibold">${currentType === 'crypto' ? 'CoinGecko' : 'Finnhub'} Verified</span>
      </div>
      ${results.map(item => `
        <div class="symbol-option p-3 hover:bg-surface-container-high transition-colors cursor-pointer flex items-center justify-between" data-symbol="${item.symbol}" data-name="${item.name}" data-type="${item.type}">
          <div class="flex items-center gap-2.5">
            <div class="w-7 h-7 rounded-full ${item.type === 'crypto' ? 'bg-tertiary-fixed text-on-tertiary-fixed' : 'bg-primary-fixed text-on-primary-fixed'} flex items-center justify-center font-data-sm text-[10px] font-bold">
              ${item.symbol.slice(0, 3)}
            </div>
            <div>
              <span class="font-title text-xs font-bold text-on-surface">${item.symbol}</span>
              <p class="font-body-sm text-[11px] text-on-surface-variant truncate max-w-[220px]">${item.name}</p>
            </div>
          </div>
          <span class="px-2 py-0.5 rounded ${item.type === 'crypto' ? 'bg-tertiary-fixed text-on-tertiary-fixed' : 'bg-primary-fixed text-on-primary-fixed'} font-data-sm text-[9px] uppercase font-bold">
            ${item.type}
          </span>
        </div>
      `).join('')}
    `;

    dropdown.classList.remove('hidden');

    // Attach item click handlers
    dropdown.querySelectorAll('.symbol-option').forEach(option => {
      option.addEventListener('click', () => {
        const sym = option.getAttribute('data-symbol');
        const name = option.getAttribute('data-name');
        const type = option.getAttribute('data-type');
        selectAsset({ symbol: sym, name, type });
      });
    });
  };

  // Autocomplete Search with Debounce & Local Instant Fallback
  const fetchAndDisplaySymbols = async (query) => {
    // Try instant client-side catalog filtering first (0ms)
    const localCatalog = state.clientCatalog[currentType];
    if (localCatalog && localCatalog.length > 0) {
      const localResults = filterCatalogLocally(localCatalog, query, 50);
      const totalAvailable = currentType === 'crypto' ? state.symbolStats.crypto_count : state.symbolStats.stocks_count;
      renderDropdownList(localResults, query ? `Matching results from ${totalAvailable.toLocaleString()} symbols` : `Popular assets (or type to search all ${totalAvailable.toLocaleString()} symbols)`);
      return;
    }

    // Fallback to server search
    searchSpinner.classList.remove('hidden');
    try {
      const results = await window.api.searchSymbols(currentType, query, 50);
      searchSpinner.classList.add('hidden');
      const totalAvailable = currentType === 'crypto' ? state.symbolStats.crypto_count : state.symbolStats.stocks_count;
      renderDropdownList(results, query ? `Matching results from ${totalAvailable.toLocaleString()} symbols` : `Popular assets (or type to search all ${totalAvailable.toLocaleString()} symbols)`);
    } catch (err) {
      searchSpinner.classList.add('hidden');
      dropdown.innerHTML = `<div class="p-4 text-center text-error font-body-sm text-xs">Error searching: ${err.message}</div>`;
      dropdown.classList.remove('hidden');
    }
  };

  const debouncedSearch = debounce((q) => fetchAndDisplaySymbols(q), 150);

  searchInput?.addEventListener('input', (e) => {
    debouncedSearch(e.target.value);
  });

  searchInput?.addEventListener('focus', () => {
    if (!dropdown.classList.contains('hidden') || searchInput.value === '') {
      fetchAndDisplaySymbols(searchInput.value);
    }
  });

  const selectAsset = (asset) => {
    selectedAsset = asset;
    dropdown.classList.add('hidden');
    searchInput.classList.add('hidden');
    selectedBox.classList.remove('hidden');

    selectedSymbolText.textContent = asset.symbol;
    selectedNameText.textContent = asset.name;
    selectedTypeText.textContent = asset.type;
    selectedAvatar.textContent = asset.symbol.slice(0, 3);
    selectedAvatar.className = `w-8 h-8 rounded-full ${asset.type === 'crypto' ? 'bg-tertiary-fixed text-on-tertiary-fixed' : 'bg-primary'} text-on-primary flex items-center justify-center font-data-sm text-[11px] font-bold`;

    errBox.classList.add('hidden');
    qtyInput.focus();
  };

  changeAssetBtn?.addEventListener('click', () => {
    selectedAsset = null;
    selectedBox.classList.add('hidden');
    searchInput.classList.remove('hidden');
    searchInput.value = '';
    searchInput.focus();
    fetchAndDisplaySymbols('');
  });

  // Form Submit
  document.getElementById('add-holding-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    errBox.classList.add('hidden');

    if (!selectedAsset) {
      errText.textContent = 'Please search and select a verified stock or crypto symbol from the autocomplete list.';
      errBox.classList.remove('hidden');
      searchInput.focus();
      return;
    }

    const quantity = parseFloat(qtyInput.value);
    const average_buy_price = parseFloat(priceInput.value);

    if (isNaN(quantity) || quantity <= 0) {
      errText.textContent = 'Quantity must be greater than 0.';
      errBox.classList.remove('hidden');
      return;
    }

    if (isNaN(average_buy_price) || average_buy_price < 0) {
      errText.textContent = 'Average buy price must be 0 or greater.';
      errBox.classList.remove('hidden');
      return;
    }

    const saveBtn = document.getElementById('save-holding-btn');
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<span class="animate-spin material-symbols-outlined text-[18px]">sync</span> Saving...`;

    try {
      await window.api.addHolding(portfolioId, {
        symbol: selectedAsset.symbol,
        name: selectedAsset.name,
        type: selectedAsset.type,
        quantity,
        average_buy_price,
      });

      showToast(`Added ${selectedAsset.symbol} holding successfully!`, 'success');
      close();
      loadPortfolioDetail(portfolioId);
    } catch (err) {
      errText.textContent = err.message || 'Failed to save holding.';
      errBox.classList.remove('hidden');
      saveBtn.disabled = false;
      saveBtn.innerHTML = `Save Holding`;
    }
  });

  // Initial load of default top symbols
  fetchAndDisplaySymbols('');
}

function openSessionExpiredModal() {
  const modalContainer = document.getElementById('modal-container');
  if (!modalContainer) return;

  modalContainer.innerHTML = `
    <div class="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
      <div class="max-w-sm w-full flex flex-col items-center text-center space-y-4 p-6 bg-surface-container rounded-2xl shadow-2xl border border-outline-variant/30">
        <div class="w-14 h-14 rounded-full bg-error-container flex items-center justify-center relative overflow-hidden mb-1 shadow-inner">
          <span class="material-symbols-outlined text-[28px] text-error" style="font-variation-settings: 'FILL' 1;">lock_clock</span>
        </div>
        <div class="space-y-1 w-full">
          <h2 class="font-headline text-lg font-bold text-on-surface">Session Expired</h2>
          <p class="font-body text-xs text-on-surface-variant max-w-[260px] mx-auto">
            Your JWT access token has expired. Please sign in again to access your portfolios.
          </p>
        </div>
        <div class="w-full pt-2 flex flex-col gap-2">
          <button id="session-login-btn" class="w-full h-11 bg-primary text-on-primary font-title text-sm font-semibold rounded-xl shadow-sm hover:bg-primary-container transition-colors flex items-center justify-center gap-1.5">
            <span class="material-symbols-outlined text-[18px]">arrow_back</span>
            <span>Back to Login</span>
          </button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('session-login-btn')?.addEventListener('click', () => {
    modalContainer.innerHTML = '';
    window.api.clearAuth();
    navigateTo('login');
  });
}

// Global Initialization
document.addEventListener('DOMContentLoaded', () => {
  render();
  preloadSymbolCatalogs();
});
