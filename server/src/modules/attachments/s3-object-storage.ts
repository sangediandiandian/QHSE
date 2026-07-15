import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { ObjectStorage } from './object-storage';

export class S3ObjectStorage implements ObjectStorage {
  readonly provider = 's3' as const;
  readonly bucket = process.env.QHSE_S3_BUCKET;
  private readonly client = new S3Client({
    region: process.env.QHSE_S3_REGION || 'us-east-1',
    endpoint: process.env.QHSE_S3_ENDPOINT,
    forcePathStyle: process.env.QHSE_S3_FORCE_PATH_STYLE === 'true',
  });

  async put(key: string, body: Buffer, contentType: string) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.requiredBucket(),
        Key: key,
        Body: body,
        ContentType: contentType,
        Metadata: { managedBy: 'qhse-api' },
      }),
    );
  }

  async read(key: string) {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.requiredBucket(),
        Key: key,
      }),
    );
    if (!response.Body) throw new Error('STORAGE_OBJECT_EMPTY');
    return Buffer.from(await response.Body.transformToByteArray());
  }

  private requiredBucket() {
    if (!this.bucket) throw new Error('QHSE_S3_BUCKET_REQUIRED');
    return this.bucket;
  }
}
