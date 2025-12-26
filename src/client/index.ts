import amqp from "amqplib";
import { clientWelcome } from "../internal/gamelogic/gamelogic.js";
import { declareAndBind } from "../internal/pubsub/queue.js";
import { ExchangePerilDirect, GameLogSlug, PauseKey } from "../internal/routing/routing.js";

async function main() {
  console.log("Starting Peril client...");
  const connection = await amqp.connect("amqp://guest:guest@localhost:5672");
  if (!connection) {
    throw new Error("Failed to connect to RabbitMQ");
  }
  console.log("Connected to RabbitMQ");
  const username = await clientWelcome();

  declareAndBind(connection, ExchangePerilDirect, `${PauseKey}.${username}`, PauseKey, "transient");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
