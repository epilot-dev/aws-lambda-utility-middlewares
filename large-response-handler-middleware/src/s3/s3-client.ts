import Log from '@dazn/lambda-powertools-logger';
import { S3 } from 'aws-sdk';

const AWS_ENDPOINT = process.env.AWS_ENDPOINT || (process.env.STAGE === 'local' ? 'http://host.docker.internal:4566' : undefined);

export const getS3Client = async (options?: S3.Types.ClientConfiguration) => {
  try {
    const client = new S3({
      endpoint: AWS_ENDPOINT,
      s3ForcePathStyle: Boolean(AWS_ENDPOINT),
      httpOptions: {
        timeout: 60_000,
      },
      ...options,
    });

    return client;
  } catch (err) {
    Log.error('Error initializing S3 client.', { err });
    throw err;
  }
};
