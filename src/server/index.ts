import amqp from "amqplib";
import { publishJSON } from "../internal/pubsub/pub.js";
import { ExchangePerilDirect, PauseKey, ExchangePerilTopic, GameLogSlug } from "../internal/routing/routing.js";
import type { PlayingState } from "../internal/gamelogic/gamestate.js";
import { getInput, printServerHelp } from "../internal/gamelogic/gamelogic.js";
import { declareAndBind, setupExchanges } from "../internal/pubsub/queue.js";
import { subscribeMsgPack } from "../internal/pubsub/consume.js";
import { writeLog, type GameLog } from "../internal/gamelogic/logs.js";
import { decode } from "@msgpack/msgpack";
import { type SimpleQueueType } from "../internal/pubsub/queue.js";

async function main() {
  console.log("Starting Peril server...");

  const connection = await amqp.connect("amqp://guest:guest@localhost:5672");
  if (!connection) {
    throw new Error("Failed to connect to RabbitMQ");
  } else {
    console.log("Connected to RabbitMQ");
  }

  await setupExchanges(connection);
  console.log("Exchanges declared");

  printServerHelp()
  process.on("SIGINT", async () => {
    console.log("Shutting down Peril server...");
    await connection.close();
    process.exit(0);
  });
  const confirmChannel = await connection.createConfirmChannel();
  let state:PlayingState = { isPaused: true };

  // Subscribe to the logs queue
  subscribeMsgPack(connection, ExchangePerilTopic, GameLogSlug, `${GameLogSlug}.*`, "durable", (data: GameLog) => {
    writeLog(data);
    return "ack";
  }, (data) => {
    const decoded:GameLog = decode(data) as GameLog;   
    return decoded;
  });

  while(true) {
    let words = await getInput();
    if(!words) continue;
    if(words[0] == "pause") {
      state.isPaused = true;
      const pub = await publishJSON(confirmChannel, ExchangePerilDirect, PauseKey, state);

    } else if(words[0] == "resume") {
      state.isPaused = false;
      const pub = await publishJSON(confirmChannel, ExchangePerilDirect, PauseKey, state);

    } else if(words[0] == "help") {
      printServerHelp()
    } else if(words[0] == "quit") {
      break;
    } else {
      console.log("Unknown command")
    }
    console.log(state)
  }

  console.log("Shutting down Peril server...");
  await connection.close();
  process.exit(0);

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
