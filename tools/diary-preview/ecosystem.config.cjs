module.exports={apps:[
 {name:'diary-preview-rtdb',cwd:__dirname,script:'sh',args:'-c "cp ../../database.rules.json rtdb.rules.json && npx firebase emulators:start --project demo-lp-b2b-stability --config firebase.json --only database"',env:{TMPDIR:'/var/tmp',JAVA_TOOL_OPTIONS:'-Xmx512m'}},
 {name:'diary-preview-web',cwd:__dirname,script:'server.cjs',env:{FIREBASE_DATABASE_EMULATOR_HOST:'127.0.0.1:9300'}}]};
