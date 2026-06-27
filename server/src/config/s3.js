import { S3Client } from "@aws-sdk/client-s3";

let s3Client = null;

const configureS3 = () => {
    try {
        s3Client = new S3Client({
            endpoint: process.env.S3_ENDPOINT,
            region: process.env.S3_REGION || "us-east-1",
            credentials: {
                accessKeyId: process.env.S3_ACCESS_KEY,
                secretAccessKey: process.env.S3_SECRET_KEY,
            },
            forcePathStyle: true, // Required for MinIO
        });
        console.log("S3/MinIO client configured");
    } catch (error) {
        console.warn(`S3 / MinIO not configured: ${error.message} `);
    }
};

export { s3Client, configureS3 };

