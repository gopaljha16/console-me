import { getAccountCheckConsumer } from "./account-check-report-consumer";
import { getNotificationConsumer } from "./notification-consumer";
import { getPostConsumer } from "./post-consumer";
import { getDMConsumer } from "./dm-consumer";
import { ensureKafkaTopics } from "@repo/kafka";

const LAG_CHECK_INTERVAL = 30000; // 30 seconds
const HIGH_LAG_THRESHOLD = 1000;

interface BaseConsumer {
    start(): Promise<void>;
    stop?(): Promise<void>;
    getLag?(): Promise<number>;
}

const consumerGetters: (() => BaseConsumer)[] = [
    getAccountCheckConsumer,
    getNotificationConsumer,
    getPostConsumer,
    getDMConsumer,
];

let consumers: BaseConsumer[] = [];

async function initConsumers() {
    const startedConsumers: BaseConsumer[] = [];

    for (const getter of consumerGetters) {
        try {
            const consumer = getter();
            await consumer.start();
            startedConsumers.push(consumer);
            console.log(`✅ Consumer started: ${consumer.constructor?.name || "unknown"}`);
        } catch (err) {
            console.error(`❌ Failed to start a consumer:`, err);
        }
    }

    return startedConsumers;
}

function startLagMonitoring(consumers: BaseConsumer[]) {
    setInterval(async () => {
        for (const consumer of consumers) {
            if (typeof consumer.getLag !== "function") continue;
            try {
                const lag = await consumer.getLag();
                if (lag > HIGH_LAG_THRESHOLD) {
                    console.warn(
                        `⚠️ High lag detected for ${consumer.constructor?.name || "consumer"}: ${lag} messages`
                    );
                }
            } catch (error) {
                console.error(
                    `Failed to fetch lag for a consumer:`,
                    error
                );
            }
        }
    }, LAG_CHECK_INTERVAL);
}

async function runConsumer() {
    console.log("Initializing Kafka Consumer Service...");

    await ensureKafkaTopics();

    consumers = await initConsumers();

    if (consumers.length === 0) {
        console.error("CRITICAL: No consumers could be started. Exiting.");
        process.exit(1);
    }

    // Handle graceful shutdown
    const shutdown = async () => {
        console.log("\nShutdown signal received. Closing all consumers...");
        await Promise.allSettled(consumers.filter(c => c.stop).map(c => c.stop!()));
        console.log("All consumers stopped. Exiting.");
        process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    // Start lag monitoring
    startLagMonitoring(consumers);

    console.log(`Worker service is active with ${consumers.length} consumers. Press Ctrl+C to stop.\n`);
}

runConsumer().catch(err => {
    console.error("CRITICAL: Worker service failed to start:", err);
    process.exit(1);
});
