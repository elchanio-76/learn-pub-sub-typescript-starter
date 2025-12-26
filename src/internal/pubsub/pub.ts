
import amqp from "amqplib";

export async function publishJSON<T>(
  ch: amqp.ConfirmChannel,
  exchange: string,
  routingKey: string,
  value: T
): Promise<void> {
   ch.publish(
    exchange,
    routingKey,
    Buffer.from(JSON.stringify(value)),
    { 
        contentType: "application/json",
     }
  );
}
