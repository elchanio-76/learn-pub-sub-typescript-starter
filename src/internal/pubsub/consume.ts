import amqp from "amqplib";
import {encode, decode} from "@msgpack/msgpack";
import { declareAndBind, type SimpleQueueType } from "./queue.js";
import { type AckType } from "./sub.js";

export async function subscribeMsgPack<T>(
    conn: amqp.ChannelModel,
    exchange: string,
    queueName: string,
    routingKey: string,
    simpleQueueType: SimpleQueueType,
    handler:(data: T) => Promise<AckType> | AckType,
    unmarshaller:(data: Buffer) => T
): Promise<void> {
    const [channel, queue] = await declareAndBind(conn, exchange, queueName, routingKey, simpleQueueType);
    await channel.prefetch(10);
    if(!queue) {
        throw new Error("Failed to declare and bind queue");
    }
    await channel.consume(queue.queue, async (msg) => {
    if (msg === null) return;
    const data = unmarshaller(msg.content);
    const ackType = await handler(data);
    if (ackType === "ack") {
        channel.ack(msg);
    } else if (ackType === "nack_discard") {
        channel.nack(msg, false, false);
    } else if (ackType === "nack_requeue") {
        channel.nack(msg, false, true);
    }
    });
}
