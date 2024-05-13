const express = require('express');
const app = express();
const port = process.env.PORT || 8000;

// Ressources statiques dont index.html
app.use(express.static('public'));

// Création du pool de connexions à la base
const { Pool } = require('pg');

const credentials = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'mvt',
  password: process.env.DB_PASSWORD || 'mvt',
  database: process.env.DB_DATABASE || 'mvt',
};

const pool = new Pool(credentials);

// Requêtes
const BATI_REQUEST = `
SELECT ST_AsMVT(q, 'bati', 4096, 'geom')
    FROM (
      SELECT ogc_fid as id, type,
        ST_AsMvtGeom(
          wkb_geometry,
          BBox($1, $2, $3),
          4096,
          256,
          true
        ) AS geom
      FROM batiments
      WHERE wkb_geometry && BBox($1, $2, $3)
      AND ST_Intersects(wkb_geometry, BBox($1, $2, $3))
    ) AS q
`;

const PARCELLE_REQUEST = `
SELECT ST_AsMVT(q, 'parcelle', 4096, 'geom')
    FROM (
      SELECT p.ogc_fid as id, p.numero, p.section, p.contenance, c.nom AS commune,
        ST_AsMvtGeom(
          p.wkb_geometry,
          BBox($1, $2, $3),
          4096,
          256,
          true
        ) AS geom
      FROM parcelles p JOIN communes c ON(c.id=p.commune)
      WHERE p.wkb_geometry && BBox($1, $2, $3)
      AND ST_Intersects(p.wkb_geometry, BBox($1, $2, $3))
    ) AS q
`;

const COMMUNE_REQUEST = `
SELECT ST_AsMVT(q, 'commune', 4096, 'geom')
    FROM (
      SELECT ogc_fid as id, id as numero, nom,
        ST_AsMvtGeom(
          wkb_geometry,
          BBox($1, $2, $3),
          4096,
          256,
          true
        ) AS geom
      FROM communes
      WHERE wkb_geometry && BBox($1, $2, $3)
      AND ST_Intersects(wkb_geometry, BBox($1, $2, $3))
    ) AS q
`;

const DEPARTEMENT_REQUEST = `
SELECT ST_AsMVT(q, 'departement', 4096, 'geom')
    FROM (
      SELECT ogc_fid as id, insee_dep as numero, nom,
        ST_AsMvtGeom(
          wkb_geometry,
          BBox($1, $2, $3),
          4096,
          256,
          true
        ) AS geom
      FROM departement
      WHERE wkb_geometry && BBox($1, $2, $3)
      AND ST_Intersects(wkb_geometry, BBox($1, $2, $3))
    ) AS q
`;

const QUERIES = [
  { name: 'bati', sql: BATI_REQUEST, min: 17, max: 20 },
  { name: 'parcelle', sql: PARCELLE_REQUEST, min: 15, max: 20 },
  { name: 'commune', sql: COMMUNE_REQUEST, min: 8, max: 20 },
  { name: 'departement', sql: DEPARTEMENT_REQUEST, min: 0, max: 20 },
];

app.get('/tiles/:z/:x/:y.pbf', (req, res) => {

  let x = req.params.x;
  let y = req.params.y;
  let z = req.params.z;

  // Toutes les couches par défaut
  let layers = req.query.layers ? req.query.layers.split(',') : QUERIES.map(q => q.name);

  // Filtre des couches : niveau de zoom et choix client
  const filteredQueries = QUERIES
    .filter(q => z >= q.min && z <= q.max)
    .filter(q => layers.find(l => l==q.name));

  const queryResultRows = filteredQueries.map(q => pool.query(q.sql, [x, y, z]));
  
  Promise.all(queryResultRows).then((resultRows) => {
    res.status(200)
      .header('Content-Type', 'application/x-protobuf')
      .send(Buffer.concat(resultRows.map(r => r.rows[0].st_asmvt)))
  }).catch(err => console.error('Erreur lors de l\'exécution de la requête', err.stack));
});

// Ecoute HTTP
app.listen(port, () => {
    console.log('Server app listening on port ' + port);
});
