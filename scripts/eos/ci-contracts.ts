export interface ArtifactStore {
    upload(filePath: string): Promise<string>;
}

export interface AttestationSigner {
    sign(payload: string): Promise<string>;
}

export interface IdentityProvider {
    getOIDCIdentity(): Promise<string>;
}

export interface TransparencyLog {
    logReceipt(receiptHash: string): Promise<string>;
}

export interface ReleaseCertifier {
    certifyRelease(gateHash: string): Promise<string>;
}

export class DefaultCIAdapter implements ArtifactStore, AttestationSigner, IdentityProvider, TransparencyLog, ReleaseCertifier {
    async upload(filePath: string): Promise<string> {
        return 'NOT_CONFIGURED';
    }
    async sign(payload: string): Promise<string> {
        return 'NOT_CONFIGURED';
    }
    async getOIDCIdentity(): Promise<string> {
        return 'NOT_CONFIGURED';
    }
    async logReceipt(receiptHash: string): Promise<string> {
        return 'NOT_CONFIGURED';
    }
    async certifyRelease(gateHash: string): Promise<string> {
        return 'NOT_CONFIGURED';
    }
}
