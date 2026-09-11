export default function Header() {
  return (
    <header className="app-header">
      <h1>Kafka Cannon</h1>
      <p>
        Live Binance trades flow producer → Kafka → this page, piling up in the
        queue on the left. The gun drains one at a time — its angle stands in for
        processing latency, so a slower setting shows the backlog build up in
        real time, exactly like Kafka absorbing a burst a slow consumer can't keep up with.
      </p>
    </header>
  );
}
