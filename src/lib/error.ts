export class BucketError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BucketError';
  }
}