
export type PaymentMethod = "pix" | "credito" | "debito";

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  pix: "Pix",
  credito: "Cartão de crédito",
  debito: "Cartão de débito",
};

export type PaymentResult = {
  ok: boolean;
  reference: string;
  message?: string;
};

/**
 * SIMULAÇÃO DE PAGAMENTO.
 *
 * Não realiza cobrança real.
 * Não deve ser considerada uma confirmação financeira.
 *
 * Para produção, integrar com um backend e um
 * provedor de pagamentos, como Mercado Pago ou Stripe.
 */
export async function processPayment(input: {
  amount: number;
  method: PaymentMethod;
}): Promise<PaymentResult> {
  const { amount, method } = input;

  if (!Number.isFinite(amount) || amount < 5 || amount > 500) {
    return {
      ok: false,
      reference: "",
      message: "O valor deve estar entre R$ 5,00 e R$ 500,00.",
    };
  }

  if (!["pix", "credito", "debito"].includes(method)) {
    return {
      ok: false,
      reference: "",
      message: "Método de pagamento inválido.",
    };
  }

  await new Promise((resolve) => setTimeout(resolve, 1600));

  return {
    ok: true,
    reference: `TESTE-${Date.now().toString(36).toUpperCase()}`,
    message: "Pagamento simulado. Nenhuma cobrança foi realizada.",
  };
}
