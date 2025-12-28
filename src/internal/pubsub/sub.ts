import amqp from "amqplib";
import type { SimpleQueueType } from "./queue.js";
import { declareAndBind } from "./queue.js";
import type { GameState, PlayingState } from "../gamelogic/gamestate.js";
import { handleMove } from "../gamelogic/move.js";
import  {  MoveOutcome } from "../gamelogic/move.js";
import type { ArmyMove, RecognitionOfWar } from "../gamelogic/gamedata.js"
import { publishJSON } from "./pub.js";
import { ExchangePerilTopic, WarRecognitionsPrefix, GameLogSlug } from "../routing/routing.js";
import { WarOutcome, type WarResolution } from "../gamelogic/war.js";
import { handleWar } from "../gamelogic/war.js";
import { publishGameLog } from "./pub.js";

export type AckType = "ack" | "nack_requeue" | "nack_discard";

export async function subscribeJSON<T>(
  conn: amqp.ChannelModel,
  exchange: string,
  queueName: string,
  key: string,
  queueType: SimpleQueueType, // an enum to represent "durable" or "transient"
  handler: (conn: amqp.ChannelModel, data: T) => AckType | Promise<AckType>,
): Promise<void> {
    const [channel, queue] = await declareAndBind(conn, exchange, queueName, key, queueType);
    if(!queue) {
        throw new Error("Failed to declare and bind queue");
    }
    channel.consume(queue.queue, async (msg) => {
        if (msg) {
            const data = JSON.parse(msg.content.toString()) as T ;

            const action = await handler(conn, data);
            if (action === "ack") {
                channel.ack(msg);
                console.log("ack");
            } else if (action === "nack_requeue") {
                channel.nack(msg, false, true);
                console.log("nack_requeue");
            } else if (action === "nack_discard") {
                channel.nack(msg, false, false);
                console.log("nack_discard");
            }
        }
        console.log('>')
    });
}

export function handlerPause (conn: amqp.ChannelModel, gs: GameState): (conn: amqp.ChannelModel, ps: PlayingState) => AckType {
    return (conn: amqp.ChannelModel, ps: PlayingState) => {
        gs.isPaused() ? gs.resumeGame(): gs.pauseGame();
        ps.isPaused = gs.isPaused();
        ps.isPaused?console.log(`\nGame is paused\n`):console.log(`\nGame is resumed\n`);
        return "ack";
    }
}

export async function handlerMove (conn: amqp.ChannelModel, gs: GameState): Promise<(conn: amqp.ChannelModel, am: ArmyMove) =>  Promise<AckType>>  {
    return async (conn: amqp.ChannelModel, am: ArmyMove) => {
        const mo:MoveOutcome =  handleMove(gs, am);
        console.log(`\nMove outcome: ${mo}\n>`);
        if (mo === MoveOutcome.Safe) {
            console.log("Safe move");
            return "ack";
        } else if ( mo === MoveOutcome.MakeWar) {
            console.log("War move");
            const confCh = await conn.createConfirmChannel();
            const warRecognition: RecognitionOfWar = {
                attacker: am.player,
                defender: gs.getPlayerSnap()
            };
            const pub = await publishJSON(confCh, ExchangePerilTopic, `${WarRecognitionsPrefix}.${am.player.username}`, warRecognition);
            if (!pub) {
                return "nack_requeue";
            }
            return "ack";
        } else if (mo ===MoveOutcome.SamePlayer) {
            console.log("Same player move");
            return "nack_discard";
        }
        return "nack_discard";
    }
}



export async function handlerWar (conn: amqp.ChannelModel, gs: GameState): Promise<(conn: amqp.ChannelModel, rw: RecognitionOfWar) =>  Promise<AckType>>  {
    return async (conn: amqp.ChannelModel, rw: RecognitionOfWar) => {
        const wo:WarResolution =  handleWar(gs, rw);
        console.log(`\nMove outcome: ${wo.result}\n>`);
        if (wo.result === WarOutcome.NotInvolved) {
            return "nack_requeue";
        } else if (wo.result === WarOutcome.NoUnits) {
            return "nack_discard";
        } else if (wo.result === WarOutcome.OpponentWon || wo.result === WarOutcome.YouWon) {
            const confCh = await conn.createConfirmChannel();
            const pub = publishGameLog(confCh, rw.attacker.username, `${wo.winner} won a war against ${wo.loser}`);
            if (!pub) return "nack_requeue";
            return "ack";
        } else if(wo.result === WarOutcome.Draw) {
            const confCh = await conn.createConfirmChannel();
            const pub = publishGameLog(confCh, rw.attacker.username, `A war between ${rw.attacker.username} and ${rw.defender.username} resulted in a draw`);
            if (!pub) return "nack_requeue";
            return "ack";
        }
        return "nack_discard";
    }
}
