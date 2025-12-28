import amqp from "amqplib"; 
import { clientWelcome, getInput, getMaliciousLog, printClientHelp,commandStatus } from "../internal/gamelogic/gamelogic.js";
import { setupExchanges } from "../internal/pubsub/queue.js";
import { ExchangePerilDirect, ExchangePerilTopic, GameLogSlug, PauseKey, WarRecognitionsPrefix } from "../internal/routing/routing.js";
import { GameState } from "../internal/gamelogic/gamestate.js";

import { commandSpawn } from "../internal/gamelogic/spawn.js";
import { commandMove, handleMove } from "../internal/gamelogic/move.js";
import { subscribeJSON } from "../internal/pubsub/sub.js";
import { publishJSON, publishMsgPack } from "../internal/pubsub/pub.js";
import { handlerPause, handlerMove, handlerWar } from "../internal/pubsub/sub.js";
import { type GameLog } from "../internal/gamelogic/logs.js";


async function main() {
  console.log("Starting Peril client...");
  const connection = await amqp.connect("amqp://guest:guest@localhost:5672");
  if (!connection) {
    throw new Error("Failed to connect to RabbitMQ");
  }
  console.log("Connected to RabbitMQ");

  await setupExchanges(connection);
  console.log("Exchanges declared");

  const username = await clientWelcome();
  const confirmChannel = await connection.createConfirmChannel();

  let game = new GameState(username);

  subscribeJSON(connection, ExchangePerilDirect, `${PauseKey}.${username}`, PauseKey, "transient", handlerPause(connection, game));
  await subscribeJSON(connection, ExchangePerilTopic, `army_moves.${username}`, `army_moves.*`, "transient", await  handlerMove(connection, game));
  await subscribeJSON(connection, ExchangePerilTopic, 'war', `${WarRecognitionsPrefix}.*`, "durable", await handlerWar(connection, game))

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
      if(!command[1]) {
        console.log("Usage: spam <count>");
        continue;
      }
      let count = parseInt(command[1]);
      for(let i = 0; i < count; i++) {
        const maliciousLog = getMaliciousLog();
        await publishMsgPack(confirmChannel, ExchangePerilTopic, `${GameLogSlug}.${username}`, maliciousLog);
      }
      continue;
    } else if(command[0] == "spawn") {
        
        console.log("Spawning ", command);
        commandSpawn(game, command)
        continue;
    } else if(command[0] == "move") {
        let move = commandMove(game, command);
        if(move) {
          await publishJSON(confirmChannel, ExchangePerilTopic, `army_moves.${move.player.username}`, move);
          console.log("Move published");
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
