// Business logic placeholders for reportes
const model = require('../models/reportes.model');

module.exports = {
  consolidado: async () => {
    return model.consolidado();
  },
  morosos: async () => {
    return model.morosos();
  },
  dataCredito: async () => {
    return model.dataCredito();
  },
  refinanciaciones: async () => {
    return model.refinanciaciones();
  },
};
