/**
 * Skupni tipi za UI lastne tržnice (odgovor GET /api/products in
 * demo/redirect odgovor POST /api/checkout).
 */

/** Javni izdelek tržnice (GET /api/products → products[]). */
export interface MarketplaceProduct {
  slug: string;
  name: string;
  description: string;
  /** Cena v centih (EUR). */
  priceCents: number;
  kind: string;
  stock: number;
  saleCount: number;
}

/** Odgovor POST /api/checkout — DEMO veja. */
export interface CheckoutDemoResponse {
  demo: true;
  orderId: string;
  visitorKey: string | null;
  status: string;
}

/** Odgovor POST /api/checkout — PRAVA Stripe veja. */
export interface CheckoutUrlResponse {
  url: string;
  visitorKey: string | null;
}

/** Napaka API-ja ({ error } + status). */
export interface CheckoutErrorResponse {
  error: string;
}

export function isCheckoutDemoResponse(
  body: CheckoutDemoResponse | CheckoutUrlResponse | CheckoutErrorResponse
): body is CheckoutDemoResponse {
  return (body as CheckoutDemoResponse).demo === true;
}

export function isCheckoutUrlResponse(
  body: CheckoutDemoResponse | CheckoutUrlResponse | CheckoutErrorResponse
): body is CheckoutUrlResponse {
  return typeof (body as CheckoutUrlResponse).url === "string";
}

/** Formatiranje cene (centi → EUR, prilagojeno jeziku). */
export function formatPriceCents(cents: number, locale: string): string {
  const whole = cents % 100 === 0;
  return new Intl.NumberFormat(
    locale === "en" ? "en-IE" : "sl-SI",
    {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: 2,
    }
  ).format(cents / 100);
}
