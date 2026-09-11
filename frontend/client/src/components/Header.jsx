export default function Header() {
  return (
    <header className="app-header">
      <h1>Kafka Cannon</h1>
      <p>
        Live Binance trades flow producer → Kafka → this page. Each trade becomes a
        coin fired from the cannon — the aim angle stands in for how a load balancer
        routes messages across consumers.
      </p>
    </header>
  );
}
