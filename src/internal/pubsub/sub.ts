import amqp from "amqplib";
import type { SimpleQueueType } from "./queue.js";
import { declareAndBind } from "./queue.js";
import type { GameState, PlayingState } from "../gamelogic/gamestate.js";

export async function subscribeJSON<T>(
  conn: amqp.ChannelModel,
  exchange: string,
  queueName: string,
  key: string,
  queueType: SimpleQueueType, // an enum to represent "durable" or "transient"
  handler: (data: T) => void,
): Promise<void> {
    const [channel, queue] = await declareAndBind(conn, exchange, queueName, key, queueType);
    if(!queue) {
        throw new Error("Failed to declare and bind queue");
    }
    channel.consume(queue.queue, (msg) => {
        if (msg) {
            const data = JSON.parse(msg.content.toString()) as T ;

            handler(data);
            channel.ack(msg);
        }
        console.log('>')
    });
}

export function handlerPause (gs: GameState): (ps: PlayingState) => void {
    return (ps: PlayingState) => {
        gs.isPaused() ? gs.resumeGame(): gs.pauseGame();
        ps.isPaused = gs.isPaused();
        ps.isPaused?console.log(`\nGame is paused\n`):console.log(`\nGame is resumed\n`);
    }
}