const nodemailer = require('nodemailer');

let transporter;

function createTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT) || 465;

  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  const auth =
    user && pass
      ? {
          user,
          pass,
        }
      : undefined;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth,
  });
}

function getTransporter() {
  if (!transporter) {
    transporter = createTransporter();
  }
  return transporter;
}

/**
 * Envía un correo electrónico usando la configuración SMTP definida por variables de entorno.
 *
 * @param {Object} params
 * @param {string|string[]} params.to - Destinatario(s) del correo (obligatorio).
 * @param {string} params.subject - Asunto del correo.
 * @param {string} [params.html] - Contenido HTML del mensaje.
 * @param {string} [params.text] - Contenido en texto plano del mensaje.
 * @returns {Promise<import('nodemailer').SentMessageInfo>}
 */
async function sendEmail({ to, subject, html, text }) {
  if (!to) {
    throw new Error('Campo "to" es requerido para enviar un correo');
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  if (!from) {
    throw new Error('Configuración SMTP incompleta: defina SMTP_FROM o SMTP_USER');
  }

  const mailOptions = {
    from,
    to,
    subject: subject || '',
    html,
    text: text || (html ? undefined : ''),
  };

  const currentTransporter = getTransporter();
  const info = await currentTransporter.sendMail(mailOptions);
  return info;
}

module.exports = {
  sendEmail,
  getTransporter,
};

