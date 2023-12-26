import { S3 } from 'aws-sdk';
export declare const getS3Client: (options?: S3.Types.ClientConfiguration) => Promise<S3>;
