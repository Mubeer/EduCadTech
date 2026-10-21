const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

/**
 * Generate a PDF certificate stream
 * @param {Object} certData
 * @param {string} certData.certificate_number
 * @param {string} certData.student_name
 * @param {string} certData.course_title
 * @param {string} certData.start_date
 * @param {string} certData.completion_date
 * @param {string} certData.issue_date
 * @param {string} hostUrl - base url (e.g. http://localhost:3000)
 * @returns {Promise<PDFDocument>}
 */
async function generateCertificatePdf(certData, hostUrl = 'http://localhost:3000') {
  // A4 Landscape: 841.89 x 595.28
  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margin: 30,
    info: {
      Title: `Certificate - ${certData.student_name} - ${certData.certificate_number}`,
      Author: 'EduCadTech Training Institute',
      Subject: 'Certificate of Course Completion',
      Keywords: 'certificate, educadtech, training, completion'
    }
  });

  const width = doc.page.width;
  const height = doc.page.height;

  // Background subtle cream gradient/tint
  doc.rect(0, 0, width, height).fill('#faf8f5');

  // Decorative Outer Borders
  doc.save();
  // Outer Border (Gold / Bronze)
  doc.rect(20, 20, width - 40, height - 40)
     .lineWidth(4)
     .stroke('#c49b38');

  // Middle thin line
  doc.rect(26, 26, width - 52, height - 52)
     .lineWidth(1)
     .stroke('#1a2942');

  // Inner Border (Navy Blue)
  doc.rect(30, 30, width - 60, height - 60)
     .lineWidth(2)
     .stroke('#c49b38');

  // Corner decorative flourishes
  const corners = [
    [30, 30],
    [width - 50, 30],
    [30, height - 50],
    [width - 50, height - 50]
  ];
  corners.forEach(([cx, cy]) => {
    doc.rect(cx - 3, cy - 3, 26, 26).fillAndStroke('#ffffff', '#c49b38');
    doc.rect(cx, cy, 20, 20).fill('#1a2942');
  });
  doc.restore();

  // Top Institute Header
  doc.font('Helvetica-Bold')
     .fontSize(19)
     .fillColor('#1a2942')
     .text('EDUCADTECH INSTITUTE OF TECHNOLOGY', 0, 52, { align: 'center', characterSpacing: 1.5 });

  doc.font('Helvetica')
     .fontSize(8.5)
     .fillColor('#6c757d')
     .text('ACCREDITED PROFESSIONAL TECHNICAL TRAINING & ENGINEERING DEVELOPMENT', 0, 75, { align: 'center', characterSpacing: 1 });

  // Decorative divider ribbon
  doc.moveTo(width / 2 - 160, 92)
     .lineTo(width / 2 + 160, 92)
     .lineWidth(1.5)
     .stroke('#c49b38');

  doc.circle(width / 2, 92, 4).fill('#c49b38');

  // Certificate Title
  doc.font('Helvetica-Bold')
     .fontSize(27)
     .fillColor('#ac192b')
     .text('CERTIFICATE OF COMPLETION', 0, 108, { align: 'center', characterSpacing: 2 });

  doc.font('Helvetica-Oblique')
     .fontSize(11)
     .fillColor('#555555')
     .text('PROUDLY PRESENTED IN RECOGNITION OF ACADEMIC & PRACTICAL EXCELLENCE TO', 0, 142, { align: 'center', characterSpacing: 0.5 });

  // Student Name
  doc.font('Helvetica-Bold')
     .fontSize(28)
     .fillColor('#1a2942')
     .text(certData.student_name, 0, 168, { align: 'center' });

  // Underline for student name
  const nameWidth = Math.max(doc.widthOfString(certData.student_name) + 60, 320);
  doc.moveTo(width / 2 - nameWidth / 2, 202)
     .lineTo(width / 2 + nameWidth / 2, 202)
     .lineWidth(1)
     .stroke('#c49b38');

  // Fulfillment Statement
  doc.font('Helvetica')
     .fontSize(11)
     .fillColor('#444444')
     .text('for successfully fulfilling all curriculum requirements, software proficiency evaluations, and practical project assessments in the certified course:', 80, 218, {
       width: width - 160,
       align: 'center',
       lineGap: 3
     });

  // Course Title
  doc.font('Helvetica-Bold')
     .fontSize(21)
     .fillColor('#ac192b')
     .text(certData.course_title, 80, 260, {
       width: width - 160,
       align: 'center'
     });

  // Course Timeline Badge Box
  const badgeWidth = 460;
  const badgeX = (width - badgeWidth) / 2;
  const badgeY = 296;

  doc.roundedRect(badgeX, badgeY, badgeWidth, 34, 5)
     .fillAndStroke('#ffffff', '#e2e8f0');

  doc.font('Helvetica-Bold')
     .fontSize(9.5)
     .fillColor('#1a2942')
     .text(`Course Commencement: `, badgeX + 15, badgeY + 11, { continued: true })
     .font('Helvetica')
     .text(`${certData.start_date}      |      `)
     .font('Helvetica-Bold')
     .text(`Course Completion: `, { continued: true })
     .font('Helvetica')
     .text(`${certData.completion_date}`);

  // Bottom Section:
  // Left: Verification & Metadata
  // Center: Gold Seal / Badge
  // Right: Authorized Signature

  const footerY = 360;

  // Generate QR Code data URL
  const verifyUrl = `${hostUrl}/verify.html?cert=${encodeURIComponent(certData.certificate_number)}`;
  const qrBuffer = await QRCode.toBuffer(verifyUrl, {
    margin: 1,
    width: 82,
    color: {
      dark: '#1a2942',
      light: '#ffffff'
    }
  });

  // Draw QR code on left
  doc.image(qrBuffer, 65, footerY - 5, { width: 72 });

  doc.font('Helvetica-Bold')
     .fontSize(9)
     .fillColor('#1a2942')
     .text('VERIFY AUTHENTICITY', 145, footerY + 2);

  doc.font('Helvetica')
     .fontSize(8)
     .fillColor('#555555')
     .text(`Certificate ID: ${certData.certificate_number}`, 145, footerY + 16)
     .text(`Date of Issue: ${certData.issue_date}`, 145, footerY + 28)
     .text(`Scan QR or visit educadtech.com/verify`, 145, footerY + 40);

  // Center Seal
  const sealX = width / 2;
  const sealY = footerY + 30;

  doc.circle(sealX, sealY, 34).lineWidth(2).stroke('#c49b38');
  doc.circle(sealX, sealY, 30).fillAndStroke('#ffffff', '#c49b38');
  doc.circle(sealX, sealY, 26).lineWidth(1).stroke('#1a2942');

  doc.font('Helvetica-Bold')
     .fontSize(7)
     .fillColor('#c49b38')
     .text('★ EDUCADTECH ★', sealX - 35, sealY - 14, { width: 70, align: 'center' });

  doc.font('Helvetica-Bold')
     .fontSize(8)
     .fillColor('#1a2942')
     .text('OFFICIAL\nCERTIFIED', sealX - 35, sealY - 5, { width: 70, align: 'center', lineGap: 1 });

  doc.font('Helvetica-Bold')
     .fontSize(6.5)
     .fillColor('#c49b38')
     .text('SEAL OF EXCELLENCE', sealX - 45, sealY + 13, { width: 90, align: 'center' });

  // Right: Signature
  const sigX = width - 260;
  
  // Signature line
  doc.moveTo(sigX, footerY + 45)
     .lineTo(sigX + 190, footerY + 45)
     .lineWidth(1)
     .stroke('#1a2942');

  // Simulated elegant signature script
  doc.font('Helvetica-Oblique')
     .fontSize(14)
     .fillColor('#1a2942')
     .text('Dr. S. K. Narayanan', sigX, footerY + 23, { width: 190, align: 'center' });

  doc.font('Helvetica-Bold')
     .fontSize(9)
     .fillColor('#1a2942')
     .text('DIRECTOR OF ACADEMICS', sigX, footerY + 50, { width: 190, align: 'center' });

  doc.font('Helvetica')
     .fontSize(8)
     .fillColor('#6c757d')
     .text('EduCadTech Training Institute', sigX, footerY + 62, { width: 190, align: 'center' });

  // Watermark or security note at the bottom
  doc.font('Helvetica')
     .fontSize(7)
     .fillColor('#94a3b8')
     .text('This credential is registered in the official EduCadTech digital registry and can be independently verified at any time.', 0, height - 26, {
       align: 'center'
     });

  return doc;
}

module.exports = {
  generateCertificatePdf
};
