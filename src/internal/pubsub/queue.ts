import amqp from "amqplib";
import { ExchangeDeadLetter, ExchangePerilDirect, ExchangePerilTopic } from "../routing/routing.js";

export type SimpleQueueType =  "durable" | "transient";

export async function setupExchanges(conn: amqp.ChannelModel): Promise<void> {
    const channel = await conn.createChannel();
    await channel.assertExchange(ExchangePerilDirect, "direct", { durable: true });
    await channel.assertExchange(ExchangePerilTopic, "topic", { durable: true });
    await channel.assertExchange(ExchangeDeadLetter, "topic", { durable: true });
    await channel.close();
}

export async function declareAndBind(
    conn: amqp.ChannelModel,
    exchange: string,
    queue: string,
    routingKey: string,
    queueType: SimpleQueueType
): Promise<[amqp.Channel, amqp.Replies.AssertQueue]> {

    const channel = await conn.createChannel();
    const queueResult = await channel.assertQueue(
        queue,
        {
            durable: queueType === "durable",
            autoDelete: queueType === "transient",
            exclusive: queueType === "transient",
            arguments: {"x-dead-letter-exchange": ExchangeDeadLetter},
        }
    );
    await channel.bindQueue(queue, exchange, routingKey);
    return [channel, queueResult];
}