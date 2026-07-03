export interface PdfProvider {
  /**
   * Render an HTML string into a PDF Buffer
   * @param html The HTML content
   */
  renderHtmlToPdf(html: string): Promise<Buffer>;
}
