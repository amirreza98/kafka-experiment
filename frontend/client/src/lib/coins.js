// Appearance for each coin the producer streams from Binance (see
// xnicedemo/listen.js SYMBOLS). Keyed by Binance's uppercase trade symbol.
export const COINS = {
  BTCUSDT: { label: "BTC", name: "Bitcoin", color: "#f7931a", text: "#1a1200" },
  ETHUSDT: { label: "ETH", name: "Ethereum", color: "#627eea", text: "#ffffff" },
  BNBUSDT: { label: "BNB", name: "BNB", color: "#f3ba2f", text: "#1a1200" },
  SOLUSDT: { label: "SOL", name: "Solana", color: "#9945ff", text: "#ffffff" },
  XRPUSDT: { label: "XRP", name: "XRP", color: "#23292f", text: "#ffffff" },
  DOGEUSDT: { label: "DOGE", name: "Dogecoin", color: "#c2a633", text: "#1a1200" },
  ADAUSDT: { label: "ADA", name: "Cardano", color: "#0033ad", text: "#ffffff" },
  AVAXUSDT: { label: "AVAX", name: "Avalanche", color: "#e84142", text: "#ffffff" },
};

const FALLBACK = { label: "?", name: "Unknown", color: "#888888", text: "#ffffff" };

export function coinFor(symbol) {
  return COINS[symbol] || FALLBACK;
}
