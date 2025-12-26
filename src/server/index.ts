import amqp from "amqplib";
import { publishJSON } from "../internal/pubsub/pub.js";
import { ExchangePerilDirect, PauseKey } from "../internal/routing/routing.js";
import type { PlayingState } from "../internal/gamelogic/gamestate.js";

async function main() {
  console.log("Starting Peril server...");

  const connection = await amqp.connect("amqp://guest:guest@localhost:5672");
  if (!connection) {
    throw new Error("Failed to connect to RabbitMQ");
  } else {
    console.log("Connected to RabbitMQ");
  }

  process.on("SIGINT", async () => {
    console.log("Shutting down Peril server...");
    await connection.close();
    process.exit(0);
  });
  const confirmChannel = await connection.createConfirmChannel();
  const state:PlayingState = { isPaused: true };
  
  await publishJSON(confirmChannel, ExchangePerilDirect, PauseKey, state )

  /*const channel = await connection.createChannel();

  const queue = "peril";
  await channel.assertQueue(queue, { durable: false });

  console.log("Waiting for messages in %s. To exit press CTRL+C", queue);

  channel.consume(
    queue,
    (msg) => {
      if (msg) {
        console.log("Received:", msg.content.toString());
      }
    },
    { noAck: true }
  );*/
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
