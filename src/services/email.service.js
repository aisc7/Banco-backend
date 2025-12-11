const nodemailer = require('nodemailer');
const { logEmailNotification } = require('../models/notificaciones.model');

const {
  GMAIL_USER,
  GMAIL_APP_PASSWORD,
  FRONTEND_BASE_URL = 'http://localhost:5173',
} = process.env;

// Transporter SMTP básico para Gmail usando variables de entorno.
// Si la configuración es incompleta, los intentos de envío fallarán y serán capturados
// en los controladores/servicios que llamen a estas funciones.
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth:
    GMAIL_USER && GMAIL_APP_PASSWORD
      ? { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD }
      : undefined,
});

/**
 * Envía un correo electrónico y registra la notificación en la tabla NOTIFICACIONES.
 * No captura errores: se espera que la función que lo invoque haga try/catch
 * y no rompa la transacción principal.
 */
async function sendMailAndLog({
  to,
  subject,
  html,
  id_prestatario,
  id_cuota = null,
  tipo,
  mensajeLog,
}) {
  if (!to) {
    throw new Error('Destinatario de correo vacío');
  }

  const fromAddress = GMAIL_USER || to;

  await transporter.sendMail({
    from: `"LoanSphere" <${fromAddress}>`,
    to,
    subject,
    html,
  });

  await logEmailNotification({
    id_prestatario,
    id_cuota,
    tipo,
    mensaje: mensajeLog,
    enviado: 'S',
  });
}

function buildBaseTemplate({ title, color, bodyHtml, buttonLabel, buttonUrl }) {
  const buttonSection =
    buttonLabel && buttonUrl
      ? `<p style="text-align:center;margin-top:24px;">
           <a href="${buttonUrl}" style="background:${color};color:#fff;padding:10px 18px;border-radius:4px;text-decoration:none;font-weight:500;">
             ${buttonLabel}
           </a>
         </p>`
      : '';

  return `
  <div style="background:#0f172a;padding:24px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <div style="max-width:600px;margin:0 auto;background:#020617;border-radius:12px;padding:24px;border:1px solid #1e293b;">
      <h1 style="margin:0 0 16px 0;font-size:20px;color:${color};">${title}</h1>
      <div style="color:#e5e7eb;font-size:14px;line-height:1.6;">
        ${bodyHtml}
      </div>
      ${buttonSection}
      <p style="margin-top:32px;font-size:11px;color:#6b7280;">
        Este es un mensaje automático de LoanSphere. Por favor, no respondas a este correo.
      </p>
    </div>
  </div>
  `;
}

// 1. Aprobación de préstamo
async function sendLoanApprovedEmail({ prestatario, prestamo, solicitud }) {
  if (!prestatario || !prestamo || !solicitud) {
    throw new Error('Datos insuficientes para correo de aprobación de préstamo');
  }

  const idPrestatario = Number(
    prestatario.ID_PRESTATARIO ?? prestatario.id_prestatario,
  );
  const email = prestatario.EMAIL || prestatario.email;
  if (!Number.isFinite(idPrestatario) || !email) {
    throw new Error('Datos de prestatario inválidos para correo de aprobación');
  }

  const nombre = (prestatario.NOMBRE || prestatario.nombre || '').trim();
  const apellido = (prestatario.APELLIDO || prestatario.apellido || '').trim();
  const nombreCompleto = `${nombre} ${apellido}`.trim() || 'cliente';

  const idPrestamo = prestamo.ID_PRESTAMO ?? prestamo.id_prestamo;
  const monto =
    prestamo.MONTO ??
    prestamo.monto ??
    prestamo.TOTAL_PRESTADO ??
    prestamo.total_prestado;
  const nroCuotas = prestamo.NRO_CUOTAS ?? prestamo.nro_cuotas;
  const tipoInteres = prestamo.TIPO_INTERES ?? prestamo.tipo_interes ?? '';

  const idSolicitud =
    solicitud.ID_SOLICITUD_PRESTAMO ??
    solicitud.id_solicitud_prestamo ??
    solicitud.id_solicitud;

  const subject = `Tu préstamo #${idPrestamo} fue aprobado 🎉`;

  const bodyHtml = `
    <p>Hola ${nombreCompleto},</p>
    <p>Tu solicitud de préstamo <strong>#${idSolicitud}</strong> ha sido <strong>aprobada</strong>.</p>
    <p>Resumen del préstamo generado:</p>
    <ul>
      <li><strong>ID préstamo:</strong> ${idPrestamo}</li>
      <li><strong>Monto:</strong> ${monto}</li>
      <li><strong>Número de cuotas:</strong> ${nroCuotas}</li>
      <li><strong>Tipo de interés:</strong> ${tipoInteres}</li>
    </ul>
    <p>Puedes consultar el detalle de tu préstamo y sus cuotas desde el portal de clientes.</p>
  `;

  const html = buildBaseTemplate({
    title: 'Préstamo aprobado ✅',
    color: '#22c55e',
    bodyHtml,
    buttonLabel: 'Ver mis préstamos',
    buttonUrl: `${FRONTEND_BASE_URL}/mis-prestamos`,
  });

  const mensajeLog = `Préstamo ${idPrestamo} aprobado para prestatario ${idPrestatario}.`;

  await sendMailAndLog({
    to: email,
    subject,
    html,
    id_prestatario: idPrestatario,
    id_cuota: null,
    tipo: 'APROBACION_PRESTAMO',
    mensajeLog,
  });
}

// 2. Rechazo de solicitud de préstamo
async function sendLoanRejectedEmail({ prestatario, solicitud }) {
  if (!prestatario || !solicitud) {
    throw new Error('Datos insuficientes para correo de rechazo de solicitud');
  }

  const idPrestatario = Number(
    prestatario.ID_PRESTATARIO ?? prestatario.id_prestatario,
  );
  const email = prestatario.EMAIL || prestatario.email;
  if (!Number.isFinite(idPrestatario) || !email) {
    throw new Error('Datos de prestatario inválidos para correo de rechazo');
  }

  const nombre = (prestatario.NOMBRE || prestatario.nombre || '').trim();
  const apellido = (prestatario.APELLIDO || prestatario.apellido || '').trim();
  const nombreCompleto = `${nombre} ${apellido}`.trim() || 'cliente';

  const idSolicitud =
    solicitud.ID_SOLICITUD_PRESTAMO ??
    solicitud.id_solicitud_prestamo ??
    solicitud.id_solicitud;
  const monto = solicitud.MONTO ?? solicitud.monto ?? null;
  const motivoRechazo =
    solicitud.MOTIVO_RECHAZO ?? solicitud.motivo_rechazo ?? solicitud.motivo;

  const subject = 'Tu solicitud de préstamo fue rechazada';

  const bodyHtml = `
    <p>Hola ${nombreCompleto},</p>
    <p>Lamentamos informarte que tu solicitud de préstamo <strong>#${idSolicitud}</strong>${
    monto ? ` por un monto de <strong>${monto}</strong>` : ''
  } ha sido <strong>rechazada</strong>.</p>
    ${
      motivoRechazo
        ? `<p>Motivo informado por el área de crédito: <em>${motivoRechazo}</em></p>`
        : '<p>Si necesitas más información sobre esta decisión, por favor comunícate con nuestro equipo de atención.</p>'
    }
  `;

  const html = buildBaseTemplate({
    title: 'Solicitud rechazada ⚠️',
    color: '#f97316',
    bodyHtml,
    buttonLabel: 'Ver mis solicitudes',
    buttonUrl: `${FRONTEND_BASE_URL}/solicitudes`,
  });

  const mensajeLog = `Solicitud de préstamo ${idSolicitud} rechazada para prestatario ${idPrestatario}.`;

  await sendMailAndLog({
    to: email,
    subject,
    html,
    id_prestatario: idPrestatario,
    id_cuota: null,
    tipo: 'RECHAZO_SOLICITUD',
    mensajeLog,
  });
}

// 3. Recordatorio de pago de cuota
async function sendPaymentReminderEmail({ prestatario, cuota }) {
  if (!prestatario || !cuota) {
    throw new Error('Datos insuficientes para recordatorio de pago');
  }

  const idPrestatario = Number(
    prestatario.ID_PRESTATARIO ?? prestatario.id_prestatario,
  );
  const email = prestatario.EMAIL || prestatario.email;
  if (!Number.isFinite(idPrestatario) || !email) {
    throw new Error('Datos de prestatario inválidos para recordatorio de pago');
  }

  const nombre = (prestatario.NOMBRE || prestatario.nombre || '').trim();
  const apellido = (prestatario.APELLIDO || prestatario.apellido || '').trim();
  const nombreCompleto = `${nombre} ${apellido}`.trim() || 'cliente';

  const idCuota = cuota.ID_CUOTA ?? cuota.id_cuota;
  const idPrestamo = cuota.ID_PRESTAMO ?? cuota.id_prestamo;
  const nroCuota = cuota.NRO_CUOTA ?? cuota.nro_cuota;
  const montoCuota = cuota.MONTO_CUOTA ?? cuota.monto_cuota ?? cuota.MONTO ?? cuota.monto;
  const fechaVencimiento =
    cuota.FECHA_VENCIMIENTO ?? cuota.fecha_vencimiento ?? '';

  const subject = `Recordatorio de pago de cuota #${nroCuota}`;

  const bodyHtml = `
    <p>Hola ${nombreCompleto},</p>
    <p>Este es un recordatorio de pago para tu cuota <strong>#${nroCuota}</strong> del préstamo <strong>#${idPrestamo}</strong>.</p>
    <ul>
      <li><strong>Monto de la cuota:</strong> ${montoCuota}</li>
      <li><strong>Fecha de vencimiento:</strong> ${fechaVencimiento}</li>
    </ul>
    <p>Te recomendamos realizar el pago antes de la fecha de vencimiento para evitar intereses de mora.</p>
  `;

  const html = buildBaseTemplate({
    title: 'Recordatorio de pago 💳',
    color: '#3b82f6',
    bodyHtml,
    buttonLabel: 'Ver mis préstamos',
    buttonUrl: `${FRONTEND_BASE_URL}/mis-prestamos`,
  });

  const mensajeLog = `Recordatorio de pago enviado para cuota ${idCuota} (préstamo ${idPrestamo}) del prestatario ${idPrestatario}.`;

  await sendMailAndLog({
    to: email,
    subject,
    html,
    id_prestatario: idPrestatario,
    id_cuota: idCuota,
    tipo: 'RECORDATORIO_PAGO',
    mensajeLog,
  });
}

// 4. Notificación de refinanciación aprobada
async function sendRefinancingEmail({ prestatario, prestamo, refinanciacion }) {
  if (!prestatario || !prestamo || !refinanciacion) {
    throw new Error('Datos insuficientes para correo de refinanciación');
  }

  const idPrestatario = Number(
    prestatario.ID_PRESTATARIO ?? prestatario.id_prestatario,
  );
  const email = prestatario.EMAIL || prestatario.email;
  if (!Number.isFinite(idPrestatario) || !email) {
    throw new Error('Datos de prestatario inválidos para refinanciación');
  }

  const nombre = (prestatario.NOMBRE || prestatario.nombre || '').trim();
  const apellido = (prestatario.APELLIDO || prestatario.apellido || '').trim();
  const nombreCompleto = `${nombre} ${apellido}`.trim() || 'cliente';

  const idPrestamo = prestamo.ID_PRESTAMO ?? prestamo.id_prestamo;
  const nuevoNroCuotas =
    refinanciacion.NRO_CUOTAS_NUEVAS ??
    refinanciacion.nro_cuotas_nuevas ??
    refinanciacion.NRO_CUOTAS ??
    refinanciacion.nro_cuotas;
  const fechaRef =
    refinanciacion.FECHA_REFINANCIACION ??
    refinanciacion.fecha_refinanciacion ??
    null;

  const subject = 'Tu préstamo fue refinanciado';

  const bodyHtml = `
    <p>Hola ${nombreCompleto},</p>
    <p>Tu préstamo <strong>#${idPrestamo}</strong> ha sido <strong>refinanciado</strong>.</p>
    <ul>
      <li><strong>Número de cuotas nuevo:</strong> ${nuevoNroCuotas}</li>
      ${
        fechaRef
          ? `<li><strong>Fecha de refinanciación:</strong> ${fechaRef}</li>`
          : ''
      }
    </ul>
    <p>Las nuevas cuotas han sido generadas y podrás consultarlas en el portal de clientes.</p>
  `;

  const html = buildBaseTemplate({
    title: 'Refinanciación registrada 🔁',
    color: '#a855f7',
    bodyHtml,
    buttonLabel: 'Ver mis préstamos',
    buttonUrl: `${FRONTEND_BASE_URL}/mis-prestamos`,
  });

  const mensajeLog = `Préstamo ${idPrestamo} refinanciado para prestatario ${idPrestatario}.`;

  await sendMailAndLog({
    to: email,
    subject,
    html,
    id_prestatario: idPrestatario,
    id_cuota: null,
    tipo: 'REFINANCIACION_APROBADA',
    mensajeLog,
  });
}

// 4b. Notificación de refinanciación rechazada
async function sendRefinancingRejectedEmail({ prestatario, solicitud }) {
  if (!prestatario || !solicitud) {
    throw new Error(
      'Datos insuficientes para correo de refinanciación rechazada',
    );
  }

  const idPrestatario = Number(
    prestatario.ID_PRESTATARIO ?? prestatario.id_prestatario,
  );
  const email = prestatario.EMAIL || prestatario.email;
  if (!Number.isFinite(idPrestatario) || !email) {
    throw new Error(
      'Datos de prestatario inválidos para refinanciación rechazada',
    );
  }

  const nombre = (prestatario.NOMBRE || prestatario.nombre || '').trim();
  const apellido = (prestatario.APELLIDO || prestatario.apellido || '').trim();
  const nombreCompleto = `${nombre} ${apellido}`.trim() || 'cliente';

  const idSolicitud =
    solicitud.ID_SOLICITUD_REFINANCIACION ??
    solicitud.id_solicitud_refinanciacion ??
    solicitud.id_solicitud;
  const idPrestamo = solicitud.ID_PRESTAMO ?? solicitud.id_prestamo ?? null;

  const subject = 'Tu solicitud de refinanciación fue rechazada';

  const bodyHtml = `
    <p>Hola ${nombreCompleto},</p>
    <p>Lamentamos informarte que tu solicitud de refinanciación <strong>#${idSolicitud}</strong>${
      idPrestamo ? ` sobre el préstamo <strong>#${idPrestamo}</strong>` : ''
    } ha sido <strong>rechazada</strong>.</p>
    <p>Si necesitas más información sobre esta decisión, por favor comunícate con nuestro equipo de atención.</p>
  `;

  const html = buildBaseTemplate({
    title: 'Refinanciación rechazada ⚠️',
    color: '#f97316',
    bodyHtml,
    buttonLabel: 'Ver mis préstamos',
    buttonUrl: `${FRONTEND_BASE_URL}/mis-prestamos`,
  });

  const mensajeLog = `Solicitud de refinanciación ${idSolicitud} rechazada para prestatario ${idPrestatario}.`;

  await sendMailAndLog({
    to: email,
    subject,
    html,
    id_prestatario: idPrestatario,
    id_cuota: null,
    tipo: 'REFINANCIACION_RECHAZADA',
    mensajeLog,
  });
}

module.exports = {
  sendLoanApprovedEmail,
  sendLoanRejectedEmail,
  sendPaymentReminderEmail,
  sendRefinancingEmail,
  sendRefinancingRejectedEmail,
};
