import { Injectable, Logger } from '@nestjs/common';
import { SignatureProvider, RequestSignaturePayload } from '../../interfaces/signature-provider.interface';
import { PDFDocument, rgb } from 'pdf-lib';
import { randomUUID } from 'crypto';

@Injectable()
export class InternalSignatureProvider implements SignatureProvider {
  private readonly logger = new Logger(InternalSignatureProvider.name);

  async requestSignature(payload: RequestSignaturePayload): Promise<{ providerRequestId: string }> {
    // For internal provider, we just generate a unique tracking ID
    // The actual flow is managed entirely in our database via SignatureRequest model
    return {
      providerRequestId: `INT-${randomUUID()}`,
    };
  }

  async applySignature(
    pdfBuffer: Buffer,
    signatureData: string, // Base64 image Data URL
    partyInfo: { name: string; role: string; email: string; signedAt: Date; ipAddress: string }
  ): Promise<Buffer> {
    try {
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      const pages = pdfDoc.getPages();
      const lastPage = pages[pages.length - 1];
      
      // Load the signature image
      // Assuming signatureData is "data:image/png;base64,....."
      const base64Data = signatureData.replace(/^data:image\/\w+;base64,/, '');
      const imageBytes = Buffer.from(base64Data, 'base64');
      
      let signatureImage;
      if (signatureData.includes('image/png')) {
        signatureImage = await pdfDoc.embedPng(imageBytes);
      } else if (signatureData.includes('image/jpeg')) {
        signatureImage = await pdfDoc.embedJpg(imageBytes);
      } else {
        // Default to PNG if not specified
        signatureImage = await pdfDoc.embedPng(imageBytes);
      }
      
      // Dimensions
      const imgDims = signatureImage.scale(0.3); // Scale down the signature
      
      // Stamp at the bottom of the last page
      // In a real app we might look for placeholders, but for now we append to bottom
      // Calculate a random offset or stack based on existing signatures? 
      // We will just put it somewhere near bottom
      const yOffset = 50 + (Math.random() * 50); // random between 50-100 to avoid complete overlap if multiple
      const xOffset = 50 + (Math.random() * 300);
      
      lastPage.drawImage(signatureImage, {
        x: xOffset,
        y: yOffset,
        width: imgDims.width,
        height: imgDims.height,
      });
      
      // Add text info
      lastPage.drawText(`Digitally Signed by: ${partyInfo.name} (${partyInfo.email})`, {
        x: xOffset,
        y: yOffset - 15,
        size: 10,
        color: rgb(0, 0, 0.5),
      });
      
      lastPage.drawText(`Date: ${partyInfo.signedAt.toLocaleString()} | IP: ${partyInfo.ipAddress}`, {
        x: xOffset,
        y: yOffset - 30,
        size: 8,
        color: rgb(0.5, 0.5, 0.5),
      });

      const savedPdf = await pdfDoc.save();
      return Buffer.from(savedPdf);
    } catch (error) {
      this.logger.error('Failed to apply internal signature to PDF', error);
      throw new Error('Failed to apply internal signature to PDF');
    }
  }
}
