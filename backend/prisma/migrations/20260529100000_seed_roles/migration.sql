INSERT INTO "Rol" ("codigo","nombre","descripcion","createdAt","updatedAt")
VALUES
  ('PASTOR_GENERAL','Pastor General','Acceso completo',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('CONSOLIDACION','Consolidacion','Consolidacion y seguimiento',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('PASTOR_CULTO','Pastor de culto','Operacion de culto',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('STAFF','Staff','Operacion general',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('LIDER','Lider','Acceso limitado',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('LECTURA','Lectura','Solo lectura',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
ON CONFLICT ("codigo") DO NOTHING;
