import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';

export const exportHtmlToPdf = async (htmlContent: string, filename: string) => {
  return new Promise<void>((resolve, reject) => {
    // Create a hidden iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '-10000px';
    iframe.style.top = '0px';
    iframe.style.width = '1200px'; // Set a fixed width for desktop-like rendering
    iframe.style.height = '100vh';
    iframe.style.border = 'none';
    iframe.style.zIndex = '-9999';
    
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document;
    if (!iframeDoc) {
      document.body.removeChild(iframe);
      reject(new Error('Could not access iframe document'));
      return;
    }

    // Write the HTML content to the iframe
    iframeDoc.open();
    iframeDoc.write(htmlContent);
    iframeDoc.close();

    // Wait for images and fonts to load
    iframe.onload = async () => {
      try {
        const body = iframeDoc.body;
        // Adjust height to fit content
        iframe.style.height = `${body.scrollHeight}px`;
        
        // Use html-to-image to capture the iframe's body
        const dataUrl = await toPng(body, {
          quality: 0.98,
          pixelRatio: 2,
          backgroundColor: '#ffffff',
          style: {
            transform: 'scale(1)',
            transformOrigin: 'top left'
          }
        });

        // Create PDF
        const pdf = new jsPDF({
          orientation: 'landscape',
          unit: 'mm',
          format: 'a4'
        });

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        
        // Calculate image dimensions to fit PDF
        const imgProps = pdf.getImageProperties(dataUrl);
        const imgRatio = imgProps.width / imgProps.height;
        const pdfRatio = pdfWidth / pdfHeight;
        
        let finalWidth = pdfWidth;
        let finalHeight = pdfWidth / imgRatio;
        
        // Add image to PDF
        pdf.addImage(dataUrl, 'PNG', 0, 0, finalWidth, finalHeight);
        
        // Save PDF
        pdf.save(filename);
        
        // Cleanup
        document.body.removeChild(iframe);
        resolve();
      } catch (error) {
        document.body.removeChild(iframe);
        reject(error);
      }
    };
  });
};
