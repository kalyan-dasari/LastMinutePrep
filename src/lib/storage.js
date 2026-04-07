const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseBucket = process.env.SUPABASE_BUCKET || "notes";
const supabaseEnabled = Boolean(supabaseUrl && supabaseServiceRoleKey);

const supabase = supabaseEnabled
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

function isSupabaseEnabled() {
  return supabaseEnabled;
}

function getPublicUrl(storagePath) {
  if (!supabaseEnabled) {
    return null;
  }

  return supabase.storage.from(supabaseBucket).getPublicUrl(storagePath).data.publicUrl;
}

async function uploadPdf({ localPath, fileName, contentType }) {
  if (!supabaseEnabled) {
    return {
      publicUrl: `/uploads/${fileName}`,
      storagePath: fileName,
    };
  }

  try {
    const objectPath = `notes/${Date.now()}-${fileName}`;
    const fileBuffer = fs.readFileSync(localPath);
    const { error } = await supabase.storage.from(supabaseBucket).upload(objectPath, fileBuffer, {
      contentType,
      upsert: false,
    });

    if (error) {
      throw error;
    }

    return {
      publicUrl: getPublicUrl(objectPath),
      storagePath: objectPath,
    };
  } catch (error) {
    console.warn("Supabase upload failed, falling back to local file storage.", error.message);
    return {
      publicUrl: `/uploads/${fileName}`,
      storagePath: fileName,
    };
  }
}

async function deleteStoredFile({ storagePath, filePath }) {
  if (!supabaseEnabled) {
    return;
  }

  const targetPath = storagePath || (filePath ? filePath.replace(/^.*notes\//, "notes/") : null);
  if (!targetPath) {
    return;
  }

  try {
    await supabase.storage.from(supabaseBucket).remove([targetPath]);
  } catch (error) {
    console.warn("Supabase delete failed, continuing with local cleanup.", error.message);
  }
}

module.exports = {
  isSupabaseEnabled,
  uploadPdf,
  deleteStoredFile,
};
