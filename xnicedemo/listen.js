const WebSocket = require("ws");
const { Kafka } = require("kafkajs");

const SYMBOLS = [
  "btcusdt",
  "ethusdt",
  "bnbusdt",
  "solusdt",
  "xrpusdt",
  "dogeusdt",
  "adausdt",
  "avaxusdt",
];
const streams = SYMBOLS.map((s) => `${s}@trade`).join("/");
const STREAM_URL = `wss://stream.binance.com:9443/stream?streams=${streams}`;

const TOPIC = "crypto-trades";

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

  const ws = new WebSocket(STREAM_URL);

  ws.on("open", () => {
    console.log(
      `Connected to Binance. Listening to ${SYMBOLS.length} coins...\n`,
    );
  });

  ws.on("message", async (data) => {
    const msg = JSON.parse(data.toString());
    const trade = msg.data;

    await producer.send({
      topic: TOPIC,
      messages: [{ value: JSON.stringify(trade) }],
    });

    const time = new Date(trade.T).toLocaleTimeString();
    console.log(`[${time}]  ${trade.s}  price: $${trade.p}   -> sent to Kafka`);
  });

  ws.on("error", (err) => console.error("WebSocket error:", err.message));
  ws.on("close", () => console.log("Connection closed."));
}

main().catch((e) => {
  console.error("fatal error:", e);
  process.exit(1);
});
