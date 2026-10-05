// server.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

// Importação das Rotas
const authRoutes = require('./src/routes/authRoutes');
const clienteRoutes = require('./src/routes/clienteRoutes');
const designerRoutes = require('./src/routes/designerRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const oportunidadeRoutes = require('./src/routes/oportunidadeRoutes');

// Mapeamento dos Endpoints
app.use('/api/auth', authRoutes);
app.use('/api/cliente', clienteRoutes);
app.use('/api/designer', designerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/oportunidades', oportunidadeRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor a rodar na porta ${PORT}`);
});

// server.js
const path = require('path');

// Diz ao Express para servir todos os ficheiros da pasta "public"
app.use(express.static(path.join(__dirname, 'public')));