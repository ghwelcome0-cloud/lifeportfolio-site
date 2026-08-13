import crypto from "node:crypto";
import fs from "node:fs";
export function verifyComposedSource(manifestPath,expected){
  if(!expected||!/^[0-9a-f]{40}$/.test(expected.head_sha)||!Number.isSafeInteger(expected.expected_file_count)||expected.expected_file_count<=0||!/^[0-9a-f]{64}$/.test(expected.manifest_sha256))throw new Error("Invalid composed source contract");
  const bytes=fs.readFileSync(manifestPath),manifest=JSON.parse(bytes);
  if(!Array.isArray(manifest.files)||manifest.files.length!==expected.expected_file_count)throw new Error("Composed source file count mismatch");
  const digest=crypto.createHash("sha256").update(bytes).digest("hex");
  if(digest!==expected.manifest_sha256)throw new Error("Composed source manifest SHA mismatch");
  return {file_count:manifest.files.length,manifest_sha256:digest};
}
