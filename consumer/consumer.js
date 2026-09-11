const { Kafka } = require("kafkajs");
const { WebSocketServer } = require("ws");

const TOPIC = "crypto-trades";
const WS_PORT = process.env.WS_PORT || 4001;
const HISTORY_SIZE = 30;

const kafka = new Kafka({
  clientId: "binance-consumer",
  brokers: [process.env.KAFKA_BROKER || "localhost:9092"],
});
const consumer = kafka.consumer({ groupId: "crypto-consumers" });

// Serves the same trade stream to browsers, since they can't speak Kafka's
// protocol directly. A client that connects mid-stream gets a burst of
// recent trades first so the UI isn't blank while waiting for the next one.
const wss = new WebSocketServer({ port: WS_PORT, path: "/ws" });
const recentTrades = [];

wss.on("connection", (socket) => {
  socket.send(JSON.stringify({ type: "history", trades: recentTrades }));
});

function broadcast(trade) {
  const payload = JSON.stringify({ type: "trade", trade });
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) client.send(payload);
  }
}

async function main() {
  await consumer.connect();
  await consumer.subscribe({ topic: TOPIC, fromBeginning: false });
  console.log("Connected to Kafka, waiting for trades...\n");
  console.log(`Serving trades to browsers on ws://localhost:${WS_PORT}/ws\n`);

  await consumer.run({
    eachMessage: async ({ message }) => {
      const trade = JSON.parse(message.value.toString());
      const time = new Date(trade.T).toLocaleTimeString();
      console.log(
        `[${time}]  ${trade.s}  price: $${trade.p}   <- read from Kafka`,
      );

      recentTrades.push(trade);
      if (recentTrades.length > HISTORY_SIZE) recentTrades.shift();
      broadcast(trade);
    },
  });
}

main().catch((e) => {
  console.error("fatal error:", e);
  process.exit(1);
});
