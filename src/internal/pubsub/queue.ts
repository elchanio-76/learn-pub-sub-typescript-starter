import amqp from "amqplib";

export type SimpleQueueType =  "durable" | "transient";

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
        }
    );
    await channel.bindQueue(queue, exchange, routingKey);
    return [channel, queueResult];
}