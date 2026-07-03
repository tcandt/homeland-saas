export interface RequestSignaturePayload {
  tenantId: string;
  documentId: string;
  documentUrl: string; // Internal storage URL
  title: string;
  message: string;
  expiresAt?: Date;
  parties: {
    name: string;
    email: string;
    role: string;
  }[];
}

export interface SignatureProvider {
  /**
   * Request a signature from multiple parties
   */
  requestSignature(payload: RequestSignaturePayload): Promise<{ providerRequestId: string }>;

  /**
   * Apply a signature to a document PDF buffer
   */
  applySignature(
    pdfBuffer: Buffer,
    signatureData: string, // Base64 image
    partyInfo: { name: string; role: string; email: string; signedAt: Date; ipAddress: string }
  ): Promise<Buffer>;
}
