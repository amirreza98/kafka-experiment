# Kafka Demo — Binance trades through Kafka

A small, real, working example of the producer → Kafka → consumer pattern,
using live Bitcoin/crypto trade data from Binance as the real-world trigger.

## What it does

Binance (live trades, WebSocket) → producer → Kafka → consumer → (prints trades)

- **`xnicedemo/`** (the producer) — connects to Binance's public WebSocket
  stream for several coins, and for every trade it receives, publishes it as
  a message to a Kafka topic called `crypto-trades`.
- **`consumer/`** — reads messages off that Kafka topic and prints each
  trade as it arrives.
- **`kafka`** — a single-node Kafka broker (via Docker), running in KRaft
  mode (no ZooKeeper needed).

This proves out the core Kafka pattern — a producer that never blocks, a
durable queue in between, and a consumer that reads at its own pace — using
real, continuously-flowing data instead of fake test traffic.

## Prerequisites

- Docker Desktop installed and running

## Run it

From the `kafkademo` folder:

docker compose watch

This builds the producer and consumer images, starts all three services
(kafka, producer, consumer), and then watches `xnicedemo/` and `consumer/`
for file changes — saving a file automatically syncs it into the running
container and restarts that service, no manual rebuild needed.

## Check it's working

In a second terminal:

docker compose logs -f producer consumer

You should see lines like:

[14:32:01] BTCUSDT price: $61234.50 -> sent to Kafka
[14:32:01] BTCUSDT price: $61234.50 <- read from Kafka

To look inside the Kafka topic directly (bypassing the consumer entirely):

docker exec -it kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic crypto-trades

## How the pieces connect

- Kafka exposes two listeners: one for tools running directly on your
  machine (`localhost:9092`), and one for other containers on the same
  Docker network (`kafka:19092`).
- The producer and consumer read the broker address from the
  `KAFKA_BROKER` environment variable, set to `kafka:19092` in
  `docker-compose.yml` — this is what lets them find Kafka from inside
  their own containers.
- The producer creates the `crypto-trades` topic itself on startup
  (`ensureTopic()`), before connecting to Binance — this avoids a race
  where the consumer tries to read a topic that doesn't exist yet.
- Both services have `restart: on-failure` as a safety net in case that
  race happens anyway.

## Frontend — Kafka Cannon

`frontend/` is a React visualization of the pipeline: every trade Kafka
delivers is fired as a coin from an aimable cannon into one of three pools
(standing in for consumers), so the aim angle demonstrates how a load
balancer routes messages.

Browsers can't speak Kafka's protocol directly, so `consumer/` doubles as
the bridge: alongside printing each trade, it also broadcasts it over a
plain WebSocket (`:4001/ws`) using the same Kafka connection.

`docker compose watch` starts it along with everything else. Open
http://localhost:5173 once containers are up.

## Folder structure

kafkademo/
docker-compose.yml
xnicedemo/ # producer: Binance -> Kafka
listen.js
Dockerfile
package.json
consumer/ # consumer: Kafka -> prints + broadcasts over WebSocket
consumer.js
Dockerfile
package.json
frontend/ # React app: cannon/pools visualization
src/
Dockerfile
package.json

## Next steps

This currently just proves the pipe works end to end. The next part of the
experiment is: have the consumer call a real HTTP endpoint (simulating your
downstream platform) instead of just printing, and build a second "direct,
no Kafka" path calling the same endpoint — to compare success/failure rates
and latency between the two approaches under real, bursty traffic.
