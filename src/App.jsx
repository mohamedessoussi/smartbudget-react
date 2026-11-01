
import { useEffect, useMemo, useState } from "react";
import {
  Wallet, ArrowUpRight, ArrowDownRight, Target,
  LayoutDashboard, ArrowLeftRight, ChartNoAxesCombined,
  Search, Plus, Bus, ShoppingBag, GraduationCap,
  House, Film, Trash2, Download, CalendarDays,
  TrendingUp, Menu, X, Sun, Moon,
} from "lucide-react";

import {
  ResponsiveContainer, AreaChart, Area, XAxis,
  YAxis, Tooltip, CartesianGrid,
} from "recharts";

import {
  loginUser,
  registerUser,
  logoutUser,
  getCurrentUser,
  getTransactions,
  addTransaction as createTransaction,
  deleteTransaction as removeTransaction,
} from "./api";

import "./App.css";

const categories = [
  "Alimentation",
  "Transport",
  "Logement",
  "Loisirs",
  "Études",
  "Autres",
];

const categoryIcons = {
  Alimentation: ShoppingBag,
  Transport: Bus,
  Logement: House,
  Loisirs: Film,
  Études: GraduationCap,
  Autres: Wallet,
  Revenus: ArrowUpRight,
};

const today = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
};

const currentMonth = () => today().slice(0, 7);

const money = (value) =>
  new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0) + " DH";

const formatDate = (date) => {
  if (!date) return "—";

  return new Date(date + "T12:00:00").toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatMonth = (month) => {
  const [year, number] = month.split("-").map(Number);

  const label = new Date(year, number - 1, 1).toLocaleDateString(
    "fr-FR",
    { month: "long", year: "numeric" }
  );

  return label.charAt(0).toUpperCase() + label.slice(1);
};

function loadBudget() {
  try {
    const saved = localStorage.getItem("smartbudget-budget");

    if (saved !== null && Number.isFinite(Number(saved))) {
      return Math.max(0, Number(saved));
    }
  } catch (error) {
    console.error("Erreur de chargement du budget :", error);
  }

  return 7000;
}

function loadTheme() {
  try {
    return localStorage.getItem("smartbudget-theme") === "light"
      ? "light"
      : "dark";
  } catch {
    return "dark";
  }
}

function formatApiTransaction(item) {
  const amount = Number(item.amount);
  const rawDate = item.date ?? item.transaction_date ?? "";

  return {
    id: item.id,
    description: item.title ?? item.description ?? "",
    category: item.type === "income" ? "Revenus" : item.category,
    amount: item.type === "income" ? amount : -amount,
    date: String(rawDate).slice(0, 10),
  };
}

function StatCard({ title, value, icon: Icon, type, footer }) {
  return (
    <article className="stat-card">
      <div className={`stat-icon ${type}`}>
        <Icon size={22} />
      </div>
      <p className="stat-title">{title}</p>
      <h2>{money(value)}</h2>
      <p className={`stat-footer ${type}`}>{footer}</p>
    </article>
  );
}

function App() {
  // Authentification
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");

  // Application
  const [transactions, setTransactions] = useState([]);
  const [budget, setBudget] = useState(loadBudget);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("expense");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Alimentation");
  const [date, setDate] = useState(today());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [activeNav, setActiveNav] = useState("Dashboard");
  const [theme, setTheme] = useState(loadTheme);

  // Restaurer la session si l'utilisateur est déjà connecté
  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      const token = localStorage.getItem("smartbudget-token");

      if (!token) {
        setAuthLoading(false);
        return;
      }

      try {
        const result = await getCurrentUser();
        const rows = await getTransactions();

        if (cancelled) return;

        setUser(result.user);
        setTransactions(rows.map(formatApiTransaction));
      } catch (error) {
        logoutUser();

        if (!cancelled) {
          setUser(null);
          setTransactions([]);
        }
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    }

    restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("smartbudget-budget", String(budget));
  }, [budget]);

  useEffect(() => {
    localStorage.setItem("smartbudget-theme", theme);
  }, [theme]);

  // Connexion et inscription
  async function handleAuthSubmit(event) {
    event.preventDefault();
    setAuthError("");
    setAuthBusy(true);

    try {
      if (authMode === "register") {
        await registerUser(
          authName.trim(),
          authEmail.trim(),
          authPassword
        );
      }

      await loginUser(authEmail.trim(), authPassword);

      const result = await getCurrentUser();
      const rows = await getTransactions();

      setUser(result.user);
      setTransactions(rows.map(formatApiTransaction));
      setAuthPassword("");
      setSelectedMonth(currentMonth());
    } catch (error) {
      logoutUser();
      setAuthError(error.message || "Une erreur est survenue.");
    } finally {
      setAuthBusy(false);
      setAuthLoading(false);
    }
  }

  function handleLogout() {
    logoutUser();
    setUser(null);
    setTransactions([]);
    setAuthPassword("");
    setAuthError("");
    setAuthMode("login");
    setSearch("");
    setMessage("");
  }

  function showMessage(text) {
    setMessage(text);
  }

  // Calculs du mois sélectionné
  const monthlyTransactions = useMemo(
    () =>
      transactions.filter((item) =>
        item.date?.startsWith(selectedMonth)
      ),
    [transactions, selectedMonth]
  );

  const income = monthlyTransactions
    .filter((item) => item.amount > 0)
    .reduce((sum, item) => sum + Number(item.amount), 0);

  const expenses = monthlyTransactions
    .filter((item) => item.amount < 0)
    .reduce((sum, item) => sum + Math.abs(Number(item.amount)), 0);

  const balance = income - expenses;
  const remaining = budget - expenses;

  const budgetPercentage =
    budget > 0 ? (expenses / budget) * 100 : expenses > 0 ? 100 : 0;

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();

    return monthlyTransactions.filter((item) =>
      `${item.description} ${item.category}`
        .toLowerCase()
        .includes(query)
    );
  }, [monthlyTransactions, search]);

  const chartData = useMemo(() => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();

    return Array.from({ length: daysInMonth }, (_, index) => {
      const day = String(index + 1).padStart(2, "0");
      const dateString = `${selectedMonth}-${day}`;

      const total = monthlyTransactions
        .filter(
          (item) => item.date === dateString && item.amount < 0
        )
        .reduce(
          (sum, item) => sum + Math.abs(Number(item.amount)),
          0
        );

      return { day: String(index + 1), amount: total };
    });
  }, [monthlyTransactions, selectedMonth]);

  const categoryTotals = useMemo(
    () =>
      categories.map((cat) => ({
        name: cat,
        total: monthlyTransactions
          .filter(
            (item) => item.amount < 0 && item.category === cat
          )
          .reduce(
            (sum, item) => sum + Math.abs(Number(item.amount)),
            0
          ),
      })),
    [monthlyTransactions]
  );

  const maxCategory = Math.max(
    1,
    ...categoryTotals.map((item) => item.total)
  );

  // Ajouter une transaction dans MySQL
  async function addTransaction(event) {
    event.preventDefault();

    const numericAmount = Number(amount);

    if (
      !description.trim() ||
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0 ||
      !date
    ) {
      showMessage("Entrez une description, une date et un montant valide.");
      return;
    }

    try {
      const saved = await createTransaction({
        title: description.trim(),
        amount: numericAmount,
        type: kind,
        category: kind === "income" ? "Revenus" : category,
        date,
      });

      setTransactions((previous) => [
        formatApiTransaction(saved),
        ...previous,
      ]);

      setSelectedMonth(date.slice(0, 7));
      setDescription("");
      setAmount("");
      showMessage(
        kind === "income"
          ? "Revenu enregistré dans MySQL."
          : "Dépense enregistrée dans MySQL."
      );
    } catch (error) {
      showMessage(
        error.message || "Impossible d'ajouter la transaction."
      );
    }
  }

  // Supprimer une transaction dans MySQL
  async function deleteTransaction(id) {
    if (!window.confirm("Voulez-vous supprimer cette transaction ?")) {
      return;
    }

    try {
      await removeTransaction(id);

      setTransactions((previous) =>
        previous.filter((item) => item.id !== id)
      );

      showMessage("Transaction supprimée de MySQL.");
    } catch (error) {
      showMessage(
        error.message || "Impossible de supprimer la transaction."
      );
    }
  }

  // Export CSV
  function exportCSV() {
    const headers = [
      "Description",
      "Categorie",
      "Montant (DH)",
      "Date",
    ];

    const rows = filtered.map((item) => [
      item.description,
      item.category,
      item.amount,
      item.date,
    ]);

    const escapeCSV = (value) =>
      `"${String(value ?? "").replace(/"/g, '""')}"`;

    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCSV).join(";"))
      .join("\r\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `smartbudget-${selectedMonth}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  const navItems = [
    { label: "Dashboard", icon: LayoutDashboard, href: "#dashboard" },
    { label: "Transactions", icon: ArrowLeftRight, href: "#transactions" },
    { label: "Statistics", icon: ChartNoAxesCombined, href: "#statistics" },
    { label: "Budget", icon: Target, href: "#budget" },
  ];

  // Chargement initial
  if (authLoading) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="auth-logo">
            <Wallet size={28} />
          </div>
          <h1>SmartBudget</h1>
          <p>Chargement de votre espace...</p>
        </div>
      </div>
    );
  }

  // Page de connexion et d'inscription
  if (!user) {
    return (
      <div className="auth-screen">
        <form className="auth-card" onSubmit={handleAuthSubmit}>
          <div className="auth-logo">
            <Wallet size={28} />
          </div>

          <h1>SmartBudget</h1>

          <p className="auth-subtitle">
            {authMode === "login"
              ? "Connectez-vous à votre espace financier"
              : "Créez votre compte gratuitement"}
          </p>

          {authMode === "register" && (
            <label>
              Nom complet
              <input
                type="text"
                value={authName}
                onChange={(event) => setAuthName(event.target.value)}
                placeholder="Votre nom"
                maxLength={100}
                autoComplete="name"
                required
              />
            </label>
          )}

          <label>
            Adresse e-mail
            <input
              type="email"
              value={authEmail}
              onChange={(event) => setAuthEmail(event.target.value)}
              placeholder="vous@example.com"
              autoComplete="email"
              required
            />
          </label>

          <label>
            Mot de passe
            <input
              type="password"
              value={authPassword}
              onChange={(event) => setAuthPassword(event.target.value)}
              placeholder="8 caractères minimum"
              minLength={8}
              autoComplete={
                authMode === "login"
                  ? "current-password"
                  : "new-password"
              }
              required
            />
          </label>

          {authError && (
            <p className="auth-error" role="alert">
              {authError}
            </p>
          )}

          <button
            className="auth-submit"
            type="submit"
            disabled={authBusy}
          >
            {authBusy
              ? "Veuillez patienter..."
              : authMode === "login"
                ? "Se connecter"
                : "Créer mon compte"}
          </button>

          <p className="auth-switch">
            {authMode === "login"
              ? "Vous n'avez pas de compte ?"
              : "Vous avez déjà un compte ?"}

            <button
              type="button"
              onClick={() => {
                setAuthMode((mode) =>
                  mode === "login" ? "register" : "login"
                );
                setAuthError("");
              }}
            >
              {authMode === "login"
                ? " S'inscrire"
                : " Se connecter"}
            </button>
          </p>
        </form>
      </div>
    );
  }

  // Dashboard principal
  return (
    <div className={`app-shell ${theme === "light" ? "light-mode" : ""}`}>
      <aside className={`sidebar ${mobileMenuOpen ? "sidebar-open" : ""}`}>
        <a
          className="brand"
          href="#dashboard"
          onClick={() => {
            setActiveNav("Dashboard");
            setMobileMenuOpen(false);
          }}
        >
          <span className="brand-icon">
            <Wallet size={25} />
          </span>
          <span>
            Smart<span className="purple-text">Budget</span>
          </span>
        </a>

        <p className="nav-caption">MENU PRINCIPAL</p>

        <nav className="navigation">
          {navItems.map(({ label, icon: Icon, href }) => (
            <a
              key={label}
              className={`nav-link ${
                activeNav === label ? "active" : ""
              }`}
              href={href}
              onClick={() => {
                setActiveNav(label);
                setMobileMenuOpen(false);
              }}
            >
              <Icon size={19} />
              <span>{label}</span>
            </a>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-illustration">
            <TrendingUp size={28} />
          </div>
          <h3>Take control.</h3>
          <p>
            De meilleures habitudes financières commencent ici.
          </p>
        </div>

        <div className="sidebar-footer">
          <span className="online-dot" />
          Données synchronisées avec MySQL
        </div>
      </aside>

      {mobileMenuOpen && (
        <button
          className="mobile-overlay"
          aria-label="Fermer le menu"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <main className="main-content" id="dashboard">
        <header className="topbar">
          <button
            className="mobile-menu-button"
            aria-label={mobileMenuOpen ? "Fermer le menu" : "Ouvrir le menu"}
            onClick={() => setMobileMenuOpen((open) => !open)}
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          <div className="search-box">
            <Search size={18} />
            <input
              type="search"
              placeholder="Rechercher une transaction..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <button
            type="button"
            className="theme-toggle"
            onClick={() =>
              setTheme((previous) =>
                previous === "dark" ? "light" : "dark"
              )
            }
            aria-label={
              theme === "dark"
                ? "Activer le mode clair"
                : "Activer le mode sombre"
            }
            title={theme === "dark" ? "Mode clair" : "Mode sombre"}
          >
            {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
            <span>
              {theme === "dark" ? "Mode clair" : "Mode sombre"}
            </span>
          </button>

          <div className="user-area">
            <span className="avatar">
              {(user.name || "U").charAt(0).toUpperCase()}
            </span>

            <div className="user-info">
              <strong>{user.name}</strong>
              <span>{user.email}</span>
            </div>

            <button
              type="button"
              className="logout-button"
              onClick={handleLogout}
              title="Se déconnecter"
            >
              <X size={17} />
              <span>Logout</span>
            </button>
          </div>
        </header>

        <div className="page-content">
          <section className="welcome">
            <div>
              <p className="eyebrow">VOTRE ESPACE FINANCIER</p>
              <h1>
                Bonjour {user.name} <span>👋</span>
              </h1>
              <p className="welcome-description">
                Gardez le contrôle de vos finances, un jour à la fois.
              </p>
            </div>

            <label className="month-selector">
              <CalendarDays size={18} />
              <input
                type="month"
                value={selectedMonth}
                onChange={(event) => {
                  if (event.target.value) {
                    setSelectedMonth(event.target.value);
                  }
                }}
                aria-label="Choisir le mois"
              />
            </label>
          </section>

          {message && (
            <div className="feedback-message" role="status">
              <span>{message}</span>
              <button
                type="button"
                aria-label="Fermer le message"
                onClick={() => setMessage("")}
              >
                <X size={16} />
              </button>
            </div>
          )}

          <section className="stats-grid">
            <StatCard
              title="Solde mensuel"
              value={balance}
              icon={Wallet}
              type="purple"
              footer={`Bilan de ${formatMonth(selectedMonth)}`}
            />

            <StatCard
              title="Revenus"
              value={income}
              icon={ArrowUpRight}
              type="green"
              footer="Total des entrées"
            />

            <StatCard
              title="Dépenses"
              value={expenses}
              icon={ArrowDownRight}
              type="pink"
              footer="Total des sorties"
            />

            <article className="stat-card budget-card" id="budget">
              <div className="stat-card-top">
                <div className="stat-icon purple">
                  <Target size={22} />
                </div>
                <span className="budget-percentage">
                  {Math.round(budgetPercentage)}%
                </span>
              </div>

              <p className="stat-title">Budget mensuel</p>

              <label className="budget-input-label">
                Budget en DH
                <input
                  className="budget-input"
                  type="number"
                  min="0"
                  step="100"
                  value={budget}
                  onChange={(event) => {
                    const value = event.target.value;
                    setBudget(
                      value === "" ? 0 : Math.max(0, Number(value))
                    );
                  }}
                />
              </label>

              <div
                className="progress-track"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.min(
                  100,
                  Math.round(budgetPercentage)
                )}
              >
                <div
                  className={`progress-fill ${
                    budgetPercentage >= 100 ? "over-budget" : ""
                  }`}
                  style={{
                    width: `${Math.min(100, budgetPercentage)}%`,
                  }}
                />
              </div>

              <p
                className={`stat-footer ${
                  remaining < 0 ? "pink" : "green"
                }`}
              >
                {budget <= 0
                  ? "Définissez votre budget"
                  : remaining < 0
                    ? `${money(Math.abs(remaining))} dépassés`
                    : `${money(remaining)} restants`}
              </p>

              {budget > 0 && budgetPercentage >= 80 && (
                <p className="budget-warning">
                  {budgetPercentage >= 100
                    ? "⚠️ Budget dépassé !"
                    : "⚠️ Budget presque atteint !"}
                </p>
              )}
            </article>
          </section>

          <section className="content-grid">
            <div className="left-column">
              <article className="panel chart-panel" id="statistics">
                <div className="panel-heading">
                  <div>
                    <span className="section-kicker">
                      VUE D'ENSEMBLE
                    </span>
                    <h2>
                      <ChartNoAxesCombined size={21} />
                      Évolution des dépenses
                    </h2>
                    <p>
                      Dépenses quotidiennes du mois sélectionné.
                    </p>
                  </div>

                  <span className="period-tag">
                    {formatMonth(selectedMonth)}
                  </span>
                </div>

                <div className="chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={chartData}
                      margin={{
                        top: 8,
                        right: 8,
                        left: -15,
                        bottom: 0,
                      }}
                    >
                      <defs>
                        <linearGradient
                          id="spendingGradient"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="#8065ff"
                            stopOpacity={0.42}
                          />
                          <stop
                            offset="95%"
                            stopColor="#8065ff"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>

                      <CartesianGrid
                        stroke="var(--chart-grid, #1c2941)"
                        strokeDasharray="4 4"
                        vertical={false}
                      />

                      <XAxis
                        dataKey="day"
                        stroke="var(--chart-text, #8093b4)"
                        tickLine={false}
                        axisLine={false}
                        minTickGap={22}
                        tick={{ fontSize: 11 }}
                      />

                      <YAxis
                        stroke="var(--chart-text, #8093b4)"
                        tickLine={false}
                        axisLine={false}
                        width={52}
                        tick={{ fontSize: 10 }}
                      />

                      <Tooltip
                        formatter={(value) => [
                          money(Number(value)),
                          "Dépenses",
                        ]}
                        labelFormatter={(label) => `Jour ${label}`}
                        contentStyle={{
                          background: "var(--tooltip-bg, #111c31)",
                          border:
                            "1px solid var(--panel-border, #293858)",
                          borderRadius: 12,
                          color: "var(--text-main, #fff)",
                          fontSize: 12,
                        }}
                      />

                      <Area
                        type="monotone"
                        dataKey="amount"
                        stroke="#8065ff"
                        strokeWidth={2.5}
                        fill="url(#spendingGradient)"
                        activeDot={{ r: 5, fill: "#a494ff" }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="chart-footer">
                  <span>
                    <span className="legend-dot" />
                    Dépenses quotidiennes
                  </span>
                  <strong>{money(expenses)} au total</strong>
                </div>
              </article>

              <article
                className="panel transactions-panel"
                id="transactions"
              >
                <div className="panel-heading transactions-heading">
                  <div>
                    <span className="section-kicker">HISTORIQUE</span>
                    <h2>
                      <ArrowLeftRight size={21} />
                      Transactions récentes
                    </h2>
                  </div>

                  <div className="transaction-actions">
                    <button
                      className="export-button"
                      type="button"
                      onClick={exportCSV}
                    >
                      <Download size={15} />
                      Export CSV
                    </button>

                    <span className="count-badge">
                      {filtered.length} opérations
                    </span>
                  </div>
                </div>

                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Description</th>
                        <th>Catégorie</th>
                        <th>Montant</th>
                        <th>Date</th>
                        <th>Action</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filtered.map((item) => {
                        const Icon =
                          categoryIcons[item.category] || Wallet;

                        return (
                          <tr key={item.id}>
                            <td>
                              <div className="transaction-name">
                                <span className="mini-icon">
                                  <Icon size={17} />
                                </span>
                                <span>{item.description}</span>
                              </div>
                            </td>

                            <td>
                              <span className="category-tag">
                                {item.category}
                              </span>
                            </td>

                            <td
                              className={
                                item.amount > 0
                                  ? "amount-positive"
                                  : "amount-negative"
                              }
                            >
                              {item.amount > 0 ? "+" : ""}
                              {money(item.amount)}
                            </td>

                            <td className="transaction-date">
                              {formatDate(item.date)}
                            </td>

                            <td>
                              <button
                                className="icon-button delete-button"
                                type="button"
                                title="Supprimer"
                                aria-label={`Supprimer ${item.description}`}
                                onClick={() =>
                                  deleteTransaction(item.id)
                                }
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}

                      {filtered.length === 0 && (
                        <tr>
                          <td colSpan={5} className="empty-state">
                            <Search size={25} />
                            <strong>
                              Aucune transaction trouvée
                            </strong>
                            <span>
                              Essayez une autre recherche ou ajoutez une
                              transaction.
                            </span>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </article>
            </div>

            <div className="right-column">
              <article className="panel category-panel">
                <div className="panel-heading">
                  <div>
                    <span className="section-kicker">ANALYSE</span>
                    <h2>
                      <Target size={21} />
                      Catégories
                    </h2>
                  </div>
                </div>

                <div className="category-total">
                  <span>Total des dépenses</span>
                  <strong>{money(expenses)}</strong>
                </div>

                <div className="category-summary">
                  {categoryTotals.map((item, index) => (
                    <div className="category-item" key={item.name}>
                      <div className="category-row">
                        <span className={`category-dot dot-${index}`} />
                        <span>{item.name}</span>
                        <strong>{money(item.total)}</strong>
                      </div>

                      <div className="category-progress">
                        <div
                          className={`category-progress-fill dot-fill-${index}`}
                          style={{
                            width: `${
                              (item.total / maxCategory) * 100
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <p className="small-note">
                  Répartition des dépenses du mois sélectionné.
                </p>
              </article>

              <article className="panel form-panel">
                <div className="panel-heading">
                  <div>
                    <span className="section-kicker">
                      NOUVELLE OPÉRATION
                    </span>
                    <h2>
                      <Plus size={21} />
                      Ajouter une transaction
                    </h2>
                  </div>
                </div>

                <div className="kind-switch">
                  <button
                    type="button"
                    className={
                      kind === "expense" ? "selected expense" : ""
                    }
                    onClick={() => setKind("expense")}
                  >
                    <ArrowDownRight size={17} />
                    Dépense
                  </button>

                  <button
                    type="button"
                    className={
                      kind === "income" ? "selected income" : ""
                    }
                    onClick={() => setKind("income")}
                  >
                    <ArrowUpRight size={17} />
                    Revenu
                  </button>
                </div>

                <form onSubmit={addTransaction}>
                  {kind === "expense" && (
                    <label>
                      Catégorie
                      <select
                        value={category}
                        onChange={(event) =>
                          setCategory(event.target.value)
                        }
                      >
                        {categories.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  <label>
                    Montant (DH)
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder="Ex. : 150"
                      value={amount}
                      onChange={(event) =>
                        setAmount(event.target.value)
                      }
                      required
                    />
                  </label>

                  <label>
                    Description
                    <input
                      type="text"
                      maxLength={120}
                      placeholder="Ex. : Courses, salaire..."
                      value={description}
                      onChange={(event) =>
                        setDescription(event.target.value)
                      }
                      required
                    />
                  </label>

                  <label>
                    Date
                    <input
                      type="date"
                      value={date}
                      onChange={(event) => setDate(event.target.value)}
                      required
                    />
                  </label>

                  <button className="submit-button" type="submit">
                    <Plus size={18} />
                    Ajouter la transaction
                  </button>
                </form>
              </article>
            </div>
          </section>

          <footer className="app-footer">
            <span>SmartBudget</span>
            <span>Gérez mieux. Économisez plus.</span>
          </footer>
        </div>
      </main>
    </div>
  );
}

export default App;
