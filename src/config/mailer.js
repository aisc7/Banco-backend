const nodemailer = require('nodemailer');

/**
 * Crea y exporta un transporter SMTP para Gmail (u otro servidor compatible),
 * usando únicamente variables de entorno. Si la configuración es incompleta,
 * el transporter sigue existiendo pero los errores se registran en consola
 * cuando se intenta enviar correo.
 */
const host = process.env.SMTP_HOST || 'smtp.gmail.com';
const port = Number(process.env.SMTP_PORT) || 587;
const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;

const user = process.env.SMTP_USER || undefined;
const pass = process.env.SMTP_PASS || undefined;

const auth =
  user && pass
    ? {
        user,
        pass,
      }
    : undefined;

const transporter = nodemailer.createTransport({
  host,
  port,
  secure,
  auth,
});

// Verificación opcional en background: loguea problemas de configuración
transporter.verify().catch((err) => {
  // eslint-disable-next-line no-console
  console.warn(
    '[mailer] No se pudo verificar la configuración SMTP:',
    err && err.message
  );
});

module.exports = transporter;

