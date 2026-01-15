export type OrderItemForWhatsApp = {
  name: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
};

export type OrderForWhatsApp = {
  orderNumber: string;
  createdAtISO: string;
  currencySymbol?: string;
  items: OrderItemForWhatsApp[];
  subtotal: number;
  discountTotal: number;
  total: number;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  comment?: string;
  catalogUrl?: string;
};

export function normalizeKzPhoneToWhatsApp(input: string): string {
  if (!input) throw new Error("Не указан номер телефона получателя.");

  const digits = String(input).replace(/\D/g, "");

  let normalized = digits;

  if (digits.length === 11 && digits.startsWith("7")) {
    normalized = digits;
  } else if (digits.length === 11 && digits.startsWith("8")) {
    normalized = "7" + digits.slice(1);
  } else if (digits.length === 10) {
    normalized = "7" + digits;
  } else {
    throw new Error("Неверный формат номера. Укажите номер в формате +7XXXXXXXXXX или 8XXXXXXXXXX.");
  }

  if (!/^7\d{10}$/.test(normalized)) {
    throw new Error("Номер должен быть в формате 7XXXXXXXXXX.");
  }

  return normalized;
}

export function formatKzt(amount: number): string {
  const n = Math.round(amount);
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function buildOrderWhatsAppText(order: OrderForWhatsApp): string {
  const cur = order.currencySymbol ?? "₸";
  const lines: string[] = [];

  lines.push(`Новый заказ №${order.orderNumber}`);
  lines.push(`Дата: ${new Date(order.createdAtISO).toLocaleString("ru-RU")}`);
  lines.push(`------------------------------`);

  if (!order.items?.length) {
    lines.push("Позиции: (пусто)");
  } else {
    order.items.forEach((it, idx) => {
      lines.push(
        `${idx + 1}) ${it.name} — ${it.qty} шт × ${formatKzt(it.unitPrice)} ${cur} = ${formatKzt(it.lineTotal)} ${cur}`
      );
    });
  }

  lines.push(`------------------------------`);
  if (order.discountTotal > 0) {
    lines.push(`Скидка: -${formatKzt(order.discountTotal)} ${cur}`);
  }
  lines.push(`Итого: ${formatKzt(order.total)} ${cur}`);

  lines.push("");
  lines.push("Контакт клиента:");
  if (order.customerName) lines.push(`Имя: ${order.customerName}`);
  if (order.customerPhone) lines.push(`Телефон: ${order.customerPhone}`);
  if (order.customerAddress) lines.push(`Адрес: ${order.customerAddress}`);
  if (order.comment) lines.push(`Комментарий: ${order.comment}`);

  if (order.catalogUrl) {
    lines.push("");
    lines.push(`Ссылка на каталог: ${order.catalogUrl}`);
  }

  return lines.join("\n");
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      ta.style.top = "-9999px";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export async function openWhatsAppOrFallback(params: { recipientPhone: string; text: string }): Promise<{ opened: boolean; url: string }> {
  const recipient = normalizeKzPhoneToWhatsApp(params.recipientPhone);
  const encoded = encodeURIComponent(params.text);

  const url = `https://wa.me/${recipient}?text=${encoded}`;

  let opened = false;
  const w = window.open(url, "_blank", "noopener,noreferrer");
  if (w && !w.closed) {
    opened = true;
  } else {
    try {
      window.location.href = url;
      opened = true;
    } catch {
      opened = false;
    }
  }

  return { opened, url };
}
