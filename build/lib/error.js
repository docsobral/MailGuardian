export class BucketError extends Error {
    constructor(message) {
        super(message);
        this.name = 'BucketError';
    }
}
