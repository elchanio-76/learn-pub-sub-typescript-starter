
import amqp from "amqplib";
import { encode, decode } from "@msgpack/msgpack";

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