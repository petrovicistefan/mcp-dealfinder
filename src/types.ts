export interface Product {
  /** Id inside its feed (e.g. SKU). Unique per feed, not globally. */
  id: string;
  title: string;
  price: number;
  currency: string;
  /** Plain merchant URL, without any tracking. */
  url: string;
  imageUrl?: string;
  brand?: string;
  category?: string;
  description?: string;
  merchant: string;
  feedId: string;
  /** Key into the `networks` map of the config. */
  network: string;
}

/** Globally unique reference used by the tools: `<feedId>:<productId>`. */
export function productRef(p: Pick<Product, "feedId" | "id">): string {
  return `${p.feedId}:${p.id}`;
}
