const WebSocket = require("ws");
const { Kafka } = require("kafkajs");

const STREAM_URL = "wss://stream.binance.com:9443/ws";

const TOPIC = "crypto-trades";
const LOG_TRADES = process.env.LOG_TRADES !== "false";

// Real trade volume, no fabricated load: every live USDT pair instead of a
// hand-picked few, so the combined trade rate is genuine market activity
// (hundreds of pairs trading at once) rather than something we made up.
async function fetchUsdtSymbols() {
  const res = await fetch("https://api.binance.com/api/v3/exchangeInfo");
  const info = await res.json();
  return info.symbols
    .filter((s) => s.status === "TRADING" && s.quoteAsset === "USDT")
    .map((s) => s.symbol.toLowerCase());
}

const kafka = new Kafka({
  clientId: "binance-producer",
  brokers: [process.env.KAFKA_BROKER || "localhost:9092"],
});
const producer = kafka.producer();

const admin = kafka.admin();

async function ensureTopic() {
  await admin.connect();
  try {
    await admin.createTopics({ topics: [{ topic: TOPIC, numPartitions: 1 }] });
    console.log(`topic ${TOPIC} ready`);
  } catch (e) {
    console.log(`topic already exists: ${e.message}`);
  }
  await admin.disconnect();
}
async function main() {
  await ensureTopic();
  await producer.connect();
  console.log("Connected to Kafka.");

  const symbols = await fetchUsdtSymbols();
  const streams = symbols.map((s) => `${s}@trade`);
  const ws = new WebSocket(STREAM_URL);

  ws.on("open", () => {
    // Raw /ws endpoint instead of the /stream?streams=... combined URL:
    // a query string listing hundreds of streams risks hitting URL length
    // limits, while SUBSCRIBE-after-connect has no such limit on stream
    // count (Binance allows up to 1024 streams per connection). But a
    // single SUBSCRIBE message listing all of them at once is still too
    // big a payload (Binance closes with code 1008), so send it in
    // batches instead, spaced out to stay under Binance's 5-messages/sec
    // limit on incoming control messages.
    const BATCH_SIZE = 50;
    let id = 1;
    for (let i = 0; i < streams.length; i += BATCH_SIZE) {
      const batch = streams.slice(i, i + BATCH_SIZE);
      setTimeout(() => {
        ws.send(JSON.stringify({ method: "SUBSCRIBE", params: batch, id: id++ }));
      }, (i / BATCH_SIZE) * 300);
    }
    console.log(
      `Connected to Binance. Listening to ${symbols.length} coins...\n`,
    );
  });

  // Trades land here the instant they arrive; a separate timer below
  // drains the buffer into one Kafka call instead of one call per trade.
  // Sending one-by-one meant each trade waited its turn behind every
  // trade ahead of it on the same connection, so the backlog (and lag)
  // only ever grew during a real burst. Batching means the queue drains
  // in groups instead of one slow round-trip at a time.
  const FLUSH_MS = 20;
  let buffer = [];

  ws.on("message", (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.e !== "trade") return; // subscription ack, not a trade event
    buffer.push(msg);
  });

  setInterval(async () => {
    if (buffer.length === 0) return;
    const batch = buffer;
    buffer = [];

    await producer.send({
      topic: TOPIC,
      messages: batch.map((trade) => ({ value: JSON.stringify(trade) })),
    });

    if (LOG_TRADES) {
      for (const trade of batch) {
        const time = new Date(trade.T).toLocaleTimeString();
        const lagMs = Date.now() - trade.T;
        console.log(`[${time}]  ${trade.s}  price: $${trade.p}   -> sent to Kafka  (lag: ${lagMs}ms)`);
      }
    }
  }, FLUSH_MS);

  ws.on("error", (err) => console.error("WebSocket error:", err.message));
  ws.on("close", (code, reason) =>
    console.log(`Connection closed. code=${code} reason=${reason || "(none)"}`),
  );
}

main().catch((e) => {
  console.error("fatal error:", e);
  process.exit(1);
});
