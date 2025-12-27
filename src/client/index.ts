import amqp from "amqplib";
import { clientWelcome, getInput, printClientHelp } from "../internal/gamelogic/gamelogic.js";
import { declareAndBind } from "../internal/pubsub/queue.js";
import { ExchangePerilDirect, GameLogSlug, PauseKey } from "../internal/routing/routing.js";
import { GameState } from "../internal/gamelogic/gamestate.js";
import { commandStatus } from "../internal/gamelogic/gamelogic.js"
import { commandSpawn } from "../internal/gamelogic/spawn.js";
import { commandMove } from "../internal/gamelogic/move.js";
import { subscribe } from "diagnostics_channel";
import { subscribeJSON } from "../internal/pubsub/sub.js";

import { handlerPause } from "../internal/pubsub/sub.js";

async function main() {
  console.log("Starting Peril client...");
  const connection = await amqp.connect("amqp://guest:guest@localhost:5672");
  if (!connection) {
    throw new Error("Failed to connect to RabbitMQ");
  }
  console.log("Connected to RabbitMQ");
  const username = await clientWelcome();

  declareAndBind(connection, ExchangePerilDirect, `${PauseKey}.${username}`, PauseKey, "transient");

  let game = new GameState(username);

  subscribeJSON(connection, ExchangePerilDirect, `${PauseKey}.${username}`, PauseKey, "transient", handlerPause(game))

  while (true) {
    // Client game loop would go here
    let command = await getInput();
    if(!command) continue;
    if(command[0] == "quit") {
      console.log("Quitting game...");
      break;
    } else if (command[0] == "help") {
      printClientHelp();
      continue;
    } else if (command[0] == "spam") {
      continue;
    } else if(command[0] == "spawn") {
        
        console.log("Spawning ", command);
        commandSpawn(game, command)
        continue;
    } else if(command[0] == "move") {
        let move = commandMove(game, command);
        if(move) {
        }
    } else if(command[0] == "status") {
      commandStatus(game);
    }
  }
  console.log("Shutting down Peril client...");
  await connection.close();
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
