
BEGIN;

CREATE UNIQUE INDEX communes_id_unique ON communes (id);

ALTER TABLE parcelles ADD CONSTRAINT fk_parcelles_commune FOREIGN KEY (commune) REFERENCES communes (id);
ALTER TABLE batiments ADD CONSTRAINT fk_batiments_commune FOREIGN KEY (commune) REFERENCES communes (id);
ALTER TABLE sections ADD CONSTRAINT fk_sections_commune FOREIGN KEY (commune) REFERENCES communes (id);

COMMIT;