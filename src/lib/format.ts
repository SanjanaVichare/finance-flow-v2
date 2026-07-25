export function formatMoney(n: number | string | null | undefined, currency = "INR") {
  const num = Number(n ?? 0);
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(num);
  } catch {
    return `${currency} ${num.toFixed(2)}`;
  }
}

export function firstOfMonthISO(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
