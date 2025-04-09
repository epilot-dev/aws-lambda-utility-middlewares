import { S3Client, type S3ClientConfig } from '@aws-sdk/client-s3';
import Log from '@dazn/lambda-powertools-logger';

const AWS_ENDPOINT =
  process.env.AWS_ENDPOINT ||
  (process.env.STAGE === 'local' || process.env.NODE_ENV === 'local' ? 'http://host.docker.internal:4566' : undefined);

export const getS3Client = async (options?: S3ClientConfig) => {
  try {
    const client = new S3Client({
      endpoint: AWS_ENDPOINT,
      forcePathStyle: Boolean(AWS_ENDPOINT),
      ...options,
    });

    return client;
  } catch (err) {
    Log.error('Error initializing S3 client.', { err });
    throw err;
  }
};
