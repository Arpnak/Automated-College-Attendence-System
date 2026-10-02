import 'dotenv/config';
import { kafka } from './producer.js';

// Creates and runs a Kafka consumer for a single topic.
// handler(message) receives the parsed JSON payload.
export async function startConsumer(topic, groupId, handler) {
  const consumer = kafka.consumer({ groupId });
  await consumer.connect();
  await consumer.subscribe({ topic, fromBeginning: false });
  console.log(`Kafka consumer [${groupId}] subscribed to ${topic}`);
  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        const payload = JSON.parse(message.value.toString());
        await handler(payload);
      } catch (err) {
        console.error(`Consumer [${groupId}] error:`, err.message);
      }
    },
  });
  return consumer;
}
