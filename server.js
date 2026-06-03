const express = require('express');
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

// ─── Configuración de Express ────────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'database.sqlite');

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Variable global para la base de datos ──────────────────────────────────
let db;

/**
 * Guarda la base de datos en disco.
 * Se llama después de cada operación de escritura para persistencia.
 */
function saveDB() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

/**
 * Inicializa la base de datos SQLite con sql.js.
 * Carga el archivo existente o crea uno nuevo.
 */
async function initDB() {
  const SQL = await initSqlJs();

  // Cargar base de datos existente o crear una nueva
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
    console.log('✅ Base de datos SQLite cargada desde archivo.');
  } else {
    db = new SQL.Database();
    console.log('✅ Nueva base de datos SQLite creada.');
  }

  // Crear tabla si no existe
  db.run(`
    CREATE TABLE IF NOT EXISTS historias_usuario (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      titulo TEXT NOT NULL,
      descripcion TEXT,
      piloto TEXT DEFAULT NULL,
      copiloto TEXT DEFAULT NULL
    )
  `);

  saveDB();
  console.log('✅ Tabla "historias_usuario" lista.');
}

// ─── Helper: Convertir resultado de sql.js a array de objetos ────────────────
function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);

  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function queryOne(sql, params = []) {
  const results = queryAll(sql, params);
  return results.length > 0 ? results[0] : null;
}

// ─── API REST: Endpoints ─────────────────────────────────────────────────────

/**
 * GET /api/historias
 * Retorna todas las historias de usuario ordenadas por ID descendente.
 */
app.get('/api/historias', (req, res) => {
  try {
    const historias = queryAll('SELECT * FROM historias_usuario ORDER BY id DESC');
    res.json(historias);
  } catch (error) {
    console.error('Error al obtener historias:', error.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

/**
 * POST /api/historias
 * Crea una nueva historia de usuario con título y descripción.
 * Body: { titulo: string, descripcion: string }
 */
app.post('/api/historias', (req, res) => {
  const { titulo, descripcion } = req.body;

  // Validación
  if (!titulo || titulo.trim() === '') {
    return res.status(400).json({ error: 'El título es obligatorio.' });
  }

  try {
    db.run(
      'INSERT INTO historias_usuario (titulo, descripcion) VALUES (?, ?)',
      [titulo.trim(), (descripcion || '').trim()]
    );

    // Obtener el ID recién insertado (antes de saveDB para no perder contexto)
    const idRows = db.exec('SELECT last_insert_rowid() as lastId');
    const newId = idRows.length > 0 ? idRows[0].values[0][0] : null;

    saveDB();

    // Obtener la historia recién creada
    const nuevaHistoria = newId
      ? queryOne('SELECT * FROM historias_usuario WHERE id = ?', [newId])
      : queryOne('SELECT * FROM historias_usuario ORDER BY id DESC LIMIT 1');

    console.log(`📝 Historia creada: "${titulo.trim()}" (ID: ${nuevaHistoria.id})`);
    res.status(201).json(nuevaHistoria);
  } catch (error) {
    console.error('Error al crear historia:', error.message);
    res.status(500).json({ error: 'Error al crear la historia.' });
  }
});

/**
 * PUT /api/historias/:id/pareja
 * Actualiza los roles de piloto y copiloto de una historia.
 * Body: { piloto: string, copiloto: string }
 */
app.put('/api/historias/:id/pareja', (req, res) => {
  const { id } = req.params;
  const { piloto, copiloto } = req.body;

  try {
    // Verificar que la historia existe
    const historia = queryOne('SELECT * FROM historias_usuario WHERE id = ?', [Number(id)]);

    if (!historia) {
      return res.status(404).json({ error: 'Historia de usuario no encontrada.' });
    }

    db.run(
      'UPDATE historias_usuario SET piloto = ?, copiloto = ? WHERE id = ?',
      [piloto ? piloto.trim() : null, copiloto ? copiloto.trim() : null, Number(id)]
    );

    saveDB();

    const actualizada = queryOne('SELECT * FROM historias_usuario WHERE id = ?', [Number(id)]);

    console.log(`🔄 Pareja asignada en HU #${id}: Piloto="${piloto || '—'}", Copiloto="${copiloto || '—'}"`);
    res.json(actualizada);
  } catch (error) {
    console.error('Error al actualizar pareja:', error.message);
    res.status(500).json({ error: 'Error al actualizar los roles.' });
  }
});

/**
 * DELETE /api/historias/:id
 * Elimina una historia de usuario por su ID.
 */
app.delete('/api/historias/:id', (req, res) => {
  const { id } = req.params;

  try {
    const historia = queryOne('SELECT * FROM historias_usuario WHERE id = ?', [Number(id)]);

    if (!historia) {
      return res.status(404).json({ error: 'Historia de usuario no encontrada.' });
    }

    db.run('DELETE FROM historias_usuario WHERE id = ?', [Number(id)]);
    saveDB();

    console.log(`🗑️  Historia eliminada: #${id}`);
    res.json({ message: 'Historia eliminada correctamente.' });
  } catch (error) {
    console.error('Error al eliminar historia:', error.message);
    res.status(500).json({ error: 'Error al eliminar la historia.' });
  }
});

// ─── Iniciar Servidor ────────────────────────────────────────────────────────
async function start() {
  await initDB();

  app.listen(PORT, () => {
    console.log(`\n🚀 Servidor XP corriendo en http://localhost:${PORT}`);
    console.log(`   Entorno: ${process.env.NODE_ENV || 'development'}`);
    console.log(`   Base de datos: database.sqlite\n`);
  });
}

start().catch((err) => {
  console.error('❌ Error fatal al iniciar:', err);
  process.exit(1);
});
