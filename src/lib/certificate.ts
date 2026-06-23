import jsPDF from 'jspdf';
import { User, QuizResult, Certificate } from './supabase';

const generateCertificateNumber = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `NAQC-${timestamp}-${random}`;
};

const generateVerificationCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 12; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

const generateQRCodeSVG = (text: string, size: number): string => {
  const moduleCount = 25;
  const cellSize = size / moduleCount;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`;
  svg += `<rect width="${size}" height="${size}" fill="white"/>`;

  const hash = text.split('').reduce((acc, char) => {
    return ((acc << 5) - acc + char.charCodeAt(0)) | 0;
  }, 0);

  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      const shouldFill = ((hash + row * col + row + col) % 3) !== 0;
      if (shouldFill) {
        svg += `<rect x="${col * cellSize}" y="${row * cellSize}" width="${cellSize}" height="${cellSize}" fill="black"/>`;
      }
    }
  }

  svg += '</svg>';
  return svg;
};

const svgToDataURL = (svgString: string): string => {
  const encoded = btoa(unescape(encodeURIComponent(svgString)));
  return `data:image/svg+xml;base64,${encoded}`;
};

export async function generateCertificatePDF(
  user: User,
  result: QuizResult,
  place: number
): Promise<Certificate> {
  const certificateNumber = generateCertificateNumber();
  const verificationCode = generateVerificationCode();

  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  let borderColor: [number, number, number];

  if (place === 1) {
    borderColor = [212, 175, 55];
  } else if (place === 2) {
    borderColor = [192, 192, 192];
  } else {
    borderColor = [205, 127, 50];
  }

  pdf.setDrawColor(...borderColor);
  pdf.setLineWidth(5);
  pdf.rect(10, 10, pageWidth - 20, pageHeight - 20);

  pdf.setDrawColor(...borderColor);
  pdf.setLineWidth(2);
  pdf.rect(15, 15, pageWidth - 30, pageHeight - 30);

  pdf.setFontSize(12);
  pdf.setTextColor(100, 100, 100);
  pdf.text('NETWORK ADMINISTRATOR QUIZ CHAMPIONSHIP', pageWidth / 2, 30, {
    align: 'center',
  });

  pdf.setFontSize(28);
  pdf.setTextColor(...borderColor);
  pdf.text('СЕРТИФІКАТ', pageWidth / 2, 50, { align: 'center' });

  pdf.setFontSize(36);
  pdf.text(place === 1 ? 'ПЕРЕМОЖЕЦЬ' : 'ПРИЗЕР', pageWidth / 2, 68, { align: 'center' });

  pdf.setDrawColor(...borderColor);
  pdf.setLineWidth(0.5);
  pdf.line(70, 75, pageWidth - 70, 75);

  pdf.setFontSize(12);
  pdf.setTextColor(100, 100, 100);
  pdf.text('Цим сертифікатом підтверджується, що', pageWidth / 2, 88, {
    align: 'center',
  });

  pdf.setFontSize(26);
  pdf.setTextColor(30, 30, 30);
  pdf.text(`${user.surname} ${user.name} ${user.patronymic}`, pageWidth / 2, 105, {
    align: 'center',
  });

  pdf.setFontSize(12);
  pdf.setTextColor(100, 100, 100);
  pdf.text('успішно пройшов вікторину для мережевих адміністраторів', pageWidth / 2, 120, {
    align: 'center',
  });

  pdf.text(`та посів ${place} місце у загальному рейтингу учасників`, pageWidth / 2, 130, {
    align: 'center',
  });

  pdf.setDrawColor(...borderColor);
  pdf.setLineWidth(0.5);
  pdf.line(70, 138, pageWidth - 70, 138);

  const statsY = 148;
  const statsSpacing = 50;

  pdf.setFontSize(14);
  pdf.setTextColor(...borderColor);
  pdf.text('РЕЗУЛЬТАТ', pageWidth / 2 - statsSpacing * 1.5, statsY, {
    align: 'center',
  });
  pdf.text('БАЛИ', pageWidth / 2 - statsSpacing * 0.5, statsY, {
    align: 'center',
  });
  pdf.text('ЧАС', pageWidth / 2 + statsSpacing * 0.5, statsY, {
    align: 'center',
  });
  pdf.text('ДАТА', pageWidth / 2 + statsSpacing * 1.5, statsY, {
    align: 'center',
  });

  pdf.setFontSize(24);
  pdf.setTextColor(30, 30, 30);
  pdf.text(`${place}`, pageWidth / 2 - statsSpacing * 1.5, statsY + 12, {
    align: 'center',
  });
  pdf.text(`${result.score}/${result.max_score}`, pageWidth / 2 - statsSpacing * 0.5, statsY + 12, {
    align: 'center',
  });
  pdf.text(
    `${Math.floor(result.duration_seconds / 60)}:${(result.duration_seconds % 60)
      .toString()
      .padStart(2, '0')}`,
    pageWidth / 2 + statsSpacing * 0.5,
    statsY + 12,
    { align: 'center' }
  );

  pdf.setFontSize(12);
  pdf.text(
    new Date(result.finished_at).toLocaleDateString('uk-UA'),
    pageWidth / 2 + statsSpacing * 1.5,
    statsY + 12,
    { align: 'center' }
  );

  pdf.setFontSize(8);
  pdf.setTextColor(100, 100, 100);
  pdf.text('Дійсність сертифіката можна перевірити за QR-кодом', 40, pageHeight - 40);

  pdf.setFontSize(7);
  pdf.text(`№ ${certificateNumber}`, 40, pageHeight - 34);
  pdf.text(`Код перевірки: ${verificationCode}`, 40, pageHeight - 28);

  const qrData = `https://quiz.example.com/verify/${verificationCode}`;
  const qrSize = 25;
  const qrX = pageWidth - 40 - qrSize;
  const qrY = pageHeight - 40 - qrSize;

  pdf.setFontSize(7);
  pdf.text('QR для перевірки', qrX + qrSize / 2, qrY - 3, { align: 'center' });

  const qrSvg = generateQRCodeSVG(qrData, 200);
  const qrDataURL = svgToDataURL(qrSvg);
  pdf.addImage(qrDataURL, 'PNG', qrX, qrY, qrSize, qrSize);

  pdf.setFontSize(8);
  pdf.setTextColor(150, 150, 150);
  pdf.text(
    `Network Administrator Quiz Championship 2024 | ${new Date().getFullYear()}`,
    pageWidth / 2,
    pageHeight - 15,
    { align: 'center' }
  );

  const certificate: Certificate = {
    id: crypto.randomUUID(),
    user_id: user.id,
    quiz_result_id: result.id,
    place,
    certificate_number: certificateNumber,
    verification_code: verificationCode,
    created_at: new Date().toISOString(),
  };

  return certificate;
}

export function createSimpleCertificate(
  user: User,
  result: QuizResult,
  place: number
): jsPDF {
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  let borderColor: [number, number, number];

  if (place === 1) {
    borderColor = [212, 175, 55];
  } else if (place === 2) {
    borderColor = [192, 192, 192];
  } else {
    borderColor = [205, 127, 50];
  }

  pdf.setDrawColor(...borderColor);
  pdf.setLineWidth(5);
  pdf.rect(10, 10, pageWidth - 20, pageHeight - 20);

  pdf.setDrawColor(...borderColor);
  pdf.setLineWidth(2);
  pdf.rect(15, 15, pageWidth - 30, pageHeight - 30);

  pdf.setFontSize(12);
  pdf.setTextColor(100, 100, 100);
  pdf.text('NETWORK ADMINISTRATOR QUIZ CHAMPIONSHIP', pageWidth / 2, 30, {
    align: 'center',
  });

  pdf.setFontSize(28);
  pdf.setTextColor(...borderColor);
  pdf.text('СЕРТИФІКАТ', pageWidth / 2, 50, { align: 'center' });

  pdf.setFontSize(24);
  pdf.text(place === 1 ? 'ПЕРЕМОЖЕЦЬ' : 'ПРИЗЕР', pageWidth / 2, 68, { align: 'center' });

  pdf.setFontSize(26);
  pdf.setTextColor(30, 30, 30);
  pdf.text(`${user.surname} ${user.name} ${user.patronymic}`, pageWidth / 2, 105, {
    align: 'center',
  });

  pdf.setFontSize(14);
  pdf.setTextColor(100, 100, 100);
  pdf.text(`${place} місце | ${result.score}/${result.max_score} балів`, pageWidth / 2, 130, {
    align: 'center',
  });

  pdf.text(
    new Date(result.finished_at).toLocaleDateString('uk-UA', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
    pageWidth / 2,
    145,
    { align: 'center' }
  );

  return pdf;
}
