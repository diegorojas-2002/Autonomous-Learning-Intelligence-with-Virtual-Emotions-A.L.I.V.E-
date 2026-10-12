import app from '../server.js';

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`A.L.I.V.E. disponible en http://localhost:${PORT}`);
});
