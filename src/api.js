
const API_URL = "http://localhost:5000/api";

export async function apiRequest(path, options = {}) {
  const token = localStorage.getItem("smartbudget-token");

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.message || "Erreur de communication avec le serveur."
    );
  }

  return data;
}

export async function registerUser(name, email, password) {
  return apiRequest("/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  });
}

export async function loginUser(email, password) {
  const data = await apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  localStorage.setItem("smartbudget-token", data.token);
  return data;
}

export function logoutUser() {
  localStorage.removeItem("smartbudget-token");
}

export async function getCurrentUser() {
  return apiRequest("/auth/me");
}

export async function getTransactions() {
  return apiRequest("/transactions");
}

export async function addTransaction(transaction) {
  return apiRequest("/transactions", {
    method: "POST",
    body: JSON.stringify(transaction),
  });
}

export async function deleteTransaction(id) {
  return apiRequest(`/transactions/${id}`, {
    method: "DELETE",
  });
}
