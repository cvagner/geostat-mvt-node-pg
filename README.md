
# MVT fourni par PostGIS et Node

L'objectif de cet exemple est de montrer comment :
* **charger dans une base PostGIS** des données administratives ou du cadastre diffusées en opendata par Etalab et l'IGN avec [`GDAL`](https://gdal.org/).
* **fournir des tuiles vectorielles dans un mode minimaliste** en exploitant :
  * la fonction [`ST_AsMvtGeom`](https://postgis.net/docs/ST_AsMVTGeom.html) de PostGIS pour produire les tuiles
  * un mini serveur node avec [`express`](https://expressjs.com/) pour les diffuser au protocole HTTP

Deux exemples sont proposés :

**🏠 Administratif**
* La carte est constituée de la couche de fond Orthophotos de la Géoplateforme et d'une couche MVT composée de trois types de données : communes, parcelles cadastrales et bâtiments.
* Cet exemple démontre :
  * **la fluidité d'affichage des tuiles vectorielles** : tuiles avec vecteurs simplifiés + possibilité de mettre en cache
  * **l'exploitation des attributs** : ici affichés dans des étiquettes au survol
  * et le **contrôle du style d'affichage côté client uniquement**, c'est à dire sans réaliser un nouvel appel serveur.

![Administratif](administratif.gif)

**🗺 Géostatistiques**
* La carte est constituée d'une couche MVT composée de deux types de données : départements et communes.
* Ici, les données sont rattachées à l'échelon communal.
* Cet exemple démontre :
  * qu'il est possible de **croiser les données avec de différentes sources**. Ici, un indicateur est associé à chaque commune et celui-ci n'a pas nécessairement le même cycle de vie que la commune en question.
  * les possibibilité **d'analyses thématiques avancées avec une classification** des données réalisée côté client également : par effectifs ou intervalles égaux et nombre de classes. 

![Géostatistiques](geostatistiques.gif)

## (Re)démarrage ultra rapide

Outils nécessaires : [docker](https://docs.docker.com/get-docker/), [7-Zip](https://www.7-zip.org/), [curl](https://curl.se/), [ogr2ogr](https://gdal.org/programs/ogr2ogr.html) de GDAL, [node 20+](https://github.com/nvm-sh/nvm)

### Dépendances
```sh
# Nettoyage éventuel : conteneurs, réseaux, volumes
docker compose down --remove-orphans --volumes

# Dépendances : création et initialisation de la base de données
docker compose up --force-recreate -d
```

### Injection des données

Départements [Admin express](https://www.data.gouv.fr/fr/datasets/admin-express/) de l'IGN :
```sh
VERSION=2024-04-23
LIVRAISON=2024-04-00115

# Admin express pour les départements
OBJET=DEPARTEMENT &&\
  curl -O "https://data.geopf.fr/telechargement/download/ADMIN-EXPRESS/ADMIN-EXPRESS_3-2__SHP_WGS84G_FRA_${VERSION}/ADMIN-EXPRESS_3-2__SHP_WGS84G_FRA_${VERSION}.7z" &&\
  7z e ADMIN-EXPRESS_3-2__SHP_WGS84G_FRA_${VERSION}.7z -o${PWD} "ADMIN-EXPRESS_3-2__SHP_WGS84G_FRA_${VERSION}/ADMIN-EXPRESS/1_DONNEES_LIVRAISON_${LIVRAISON}/ADE_3-2_SHP_WGS84G_FRA-ED${VERSION}/DEPARTEMENT.*" &&\
  rm -f "ADMIN-EXPRESS_3-2__SHP_WGS84G_FRA_${VERSION}.7z" &&\
  ogr2ogr -f "PostgreSQL" PG:"dbname='mvt' host='localhost' port='5432' user='mvt' password='mvt'" ${OBJET}.shp -nln departement -nlt multipolygon -t_srs EPSG:3857 &&\
  rm -rf ${OBJET}.*
```

Communes, sections, parcelles et bâtiments du [Cadastre](https://cadastre.data.gouv.fr/datasets/cadastre-etalab) d'Etalab :
```sh
# Version des données
VERSION=latest
DEP=21

# Communes de France
OBJET=communes &&\
  curl "https://cadastre.data.gouv.fr/data/etalab-cadastre/${VERSION}/shp/france/cadastre-france-${OBJET}-shp.zip" > o.zip &&\
  unzip o.zip && rm -f o.zip &&\
  PGCLIENTENCODING=LATIN1 ogr2ogr -f "PostgreSQL" PG:"dbname='mvt' host='localhost' port='5432' user='mvt' password='mvt'" ${OBJET}.shp -nln ${OBJET} -nlt multipolygon -t_srs EPSG:3857 &&\
  rm -rf ${OBJET}.*

# Sections, parcelles et bâtiments du département 21
DEP=21

OBJET=sections &&\
  curl "https://cadastre.data.gouv.fr/data/etalab-cadastre/${VERSION}/shp/departements/${DEP}/cadastre-${DEP}-${OBJET}-shp.zip" > o.zip &&\
  unzip o.zip && rm -f o.zip &&\
  PGCLIENTENCODING=LATIN1 ogr2ogr -f "PostgreSQL" PG:"dbname='mvt' host='localhost' port='5432' user='mvt' password='mvt'" ${OBJET}.shp -nln ${OBJET} -nlt multipolygon -t_srs EPSG:3857 &&\
  rm -rf ${OBJET}.*

OBJET=parcelles &&\
  curl "https://cadastre.data.gouv.fr/data/etalab-cadastre/${VERSION}/shp/departements/${DEP}/cadastre-${DEP}-${OBJET}-shp.zip" > o.zip &&\
  unzip o.zip && rm -f o.zip &&\
  PGCLIENTENCODING=LATIN1 ogr2ogr -f "PostgreSQL" PG:"dbname='mvt' host='localhost' port='5432' user='mvt' password='mvt'" ${OBJET}.shp -nln ${OBJET} -nlt multipolygon -t_srs EPSG:3857 &&\
  rm -rf ${OBJET}.*

OBJET=batiments &&\
  curl "https://cadastre.data.gouv.fr/data/etalab-cadastre/${VERSION}/shp/departements/${DEP}/cadastre-${DEP}-${OBJET}-shp.zip" > o.zip &&\
  unzip o.zip && rm -f o.zip &&\
  PGCLIENTENCODING=LATIN1 ogr2ogr -f "PostgreSQL" PG:"dbname='mvt' host='localhost' port='5432' user='mvt' password='mvt'" ${OBJET}.shp -nln ${OBJET} -nlt multipolygon -t_srs EPSG:3857 &&\
  rm -rf ${OBJET}.*

# Indexes et clés étrangères
docker exec -it mvt-db psql -U mvt -d mvt -f /sql-data/set-foreign-keys.sql
```

Vérifier que la base est remontée en inspectant les journaux : 
```sh
docker logs -f  mvt-db
```

Ou en exécutant une requête :
```sh
docker exec -it mvt-db psql -U mvt -d mvt -c 'select count(*) from communes'
```

### Serveur de tuiles
Installer les dépendances
```sh
# Dernières versions
yarn

# Ou telles quelles
# yarn install --frozen-lockfile
```

Démarrer le serveur en local :
```sh
yarn start
```

Ouvrir http://localhost:8000/.

Remarque : les pages html sont servies directement par le serveur et ne nécessitent pas de compilation.


## Nettoyage
```sh
# Nettoyage : conteneurs, réseaux, volumes, images
docker compose down --remove-orphans --volumes --rmi all

# Modules nodes téléchargés
rm -rf node_modules
```
