require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const oracle = require('./config/oracle');

// Routes
const prestatariosRoutes = require('./routes/prestatarios.routes');
const prestamosRoutes = require('./routes/prestamos.routes');
const cuotasRoutes = require('./routes/cuotas.routes');
const reportesRoutes = require('./routes/reportes.routes');
const notificacionesRoutes = require('./routes/notificaciones.routes');
const auditoriaRoutes = require('./routes/auditoria.routes');
const empleadosRoutes = require('./routes/empleados.routes');
const authRoutes = require('./routes/auth.routes');

const app = express();

// Core middleware
// Habilitar CORS antes de montar las rutas para permitir llamadas desde el frontend (Vite en 5173).
app.use(
  cors({
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  })
);
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Health
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Mount modules
app.use('/api/prestatarios', prestatariosRoutes);
app.use('/api/prestamos', prestamosRoutes);
app.use('/api/cuotas', cuotasRoutes);
app.use('/api/reportes', reportesRoutes);
app.use('/api/notificaciones', notificacionesRoutes);
app.use('/api/auditoria', auditoriaRoutes);
app.use('/api/empleados', empleadosRoutes);
app.use('/api/auth', authRoutes);

// Boot Oracle pool when app starts (server.js awaits this)
app.initDb = async () => {
  await oracle.init();
};

module.exports = app;
