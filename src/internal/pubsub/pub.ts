
import amqp from "amqplib";
import { encode, decode } from "@msgpack/msgpack";
import { ExchangePerilTopic, GameLogSlug } from "../routing/routing.js";
import type { GameLog } from "../gamelogic/logs.js";

export async function publishJSON<T>(
  ch: amqp.ConfirmChannel,
  exchange: string,
  routingKey: string,
  value: T
): Promise<boolean> {
  return ch.publish(
    exchange,
    routingKey,
    Buffer.from(JSON.stringify(value)),
    { 
        contentType: "application/json",
     }
  );
}

export async function publishMsgPack<T>(
  ch:amqp.ConfirmChannel,
  exchange: string,
  routingKey: string,
  value: T,
): Promise<boolean> {

  const encodedData: Uint8Array = encode(value);
  return ch.publish(
    exchange,
    routingKey,
    Buffer.from(encodedData),
    { contentType: "application/x-msgpack" }
  );
}

export async function publishGameLog(ch:amqp.ConfirmChannel, username: string, message: string): Promise<boolean> {
  const gameLog: GameLog = { 
    username: username, 
    message: message,
    currentTime: new Date()
  };
  return await publishMsgPack(ch, ExchangePerilTopic, `${GameLogSlug}.${username}`, gameLog);

}