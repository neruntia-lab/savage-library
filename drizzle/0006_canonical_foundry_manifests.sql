UPDATE "resources"
SET "manifest_url" = 'https://savage-library.vercel.app/api/foundry/modules/' || "slug" || '/module.json'
WHERE "resource_type" = 'module'
  AND "manifest_url" IS DISTINCT FROM
    'https://savage-library.vercel.app/api/foundry/modules/' || "slug" || '/module.json';
