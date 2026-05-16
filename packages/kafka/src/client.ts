import { Kafka, KafkaConfig, logLevel } from "kafkajs";
import { server_env as env } from "@repo/env";
import fs from "node:fs";
import path from "node:path";
import tls from "node:tls";
import { fileURLToPath } from "node:url";

const kafkaConfig: KafkaConfig = {
    clientId: "console-me",
    brokers: [env.KAFKA_BROKER,],
    logLevel: logLevel.ERROR,
    retry: {
        initialRetryTime: 100,
        retries: 8,
    },
};

if (env.KAFKA_SSL) {
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

    const resolveCertificatePath = (certificatePath: string) => {
        if (path.isAbsolute(certificatePath)) {
            return certificatePath;
        }

        const rootRelativePath = path.resolve(repoRoot, certificatePath);
        if (fs.existsSync(rootRelativePath)) {
            return rootRelativePath;
        }

        return path.resolve(certificatePath);
    };

    const caPath = resolveCertificatePath(env.KAFKA_CA_CERT!);
    const certPath = resolveCertificatePath(env.KAFKA_CLIENT_CERT!);
    const keyPath = resolveCertificatePath(env.KAFKA_CLIENT_KEY!);

    if (fs.existsSync(caPath) && fs.existsSync(certPath) && fs.existsSync(keyPath)) {
        kafkaConfig.ssl = {
            rejectUnauthorized: true,
            ca: [fs.readFileSync(caPath, "utf-8")],
            cert: fs.readFileSync(certPath, "utf-8"),
            key: fs.readFileSync(keyPath, "utf-8"),
            checkServerIdentity: (host, cert) => {
                if (!cert) return undefined;
                return tls.checkServerIdentity(host, cert);
            },
        };
        console.log("Kafka SSL certificates loaded");
    } else {
        throw new Error(
            `Kafka SSL is enabled, but certificate files were not found. Checked CA: ${caPath}, cert: ${certPath}, key: ${keyPath}`,
        );
    }
}

export const kafka = new Kafka(kafkaConfig);

// Kafka Topics
export const TOPICS = {
    POST: "app-post",
    DM_MESSAGES: "dm-messages",
    NOTIFICATION: "notification",
    ACCOUNT_REPORT_CHECK: "account-report-check"
} as const;

// Topic configurations
export const TOPIC_CONFIGS = {
    [TOPICS.POST]: {
        numPartitions: 1,
        replicationFactor: 1,
    },
    [TOPICS.DM_MESSAGES]: {
        numPartitions: 1,
        replicationFactor: 1,
    },
    [TOPICS.NOTIFICATION]: {
        numPartitions: 1,
        replicationFactor: 1,
    },
    [TOPICS.ACCOUNT_REPORT_CHECK]: {
        numPartitions: 1,
        replicationFactor: 1,
    },
};

export const ensureKafkaTopics = async () => {
    const admin = kafka.admin();

    await admin.connect();
    try {
        await admin.createTopics({
            waitForLeaders: true,
            topics: Object.entries(TOPIC_CONFIGS).map(([topic, config]) => ({
                topic,
                ...config,
            })),
        });
    } finally {
        await admin.disconnect();
    }
};
