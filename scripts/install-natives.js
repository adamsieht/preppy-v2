const { execSync } = require('child_process')
const path = require('path')

async function main() {
  const root = path.join(__dirname, '..')
  const electronVersion = require(path.join(root, 'node_modules/electron/package.json')).version
  const prebuildBin = path.join(root, 'node_modules/prebuild-install/bin.js')
  const betterSqlite3Dir = path.join(root, 'node_modules/better-sqlite3')

  console.log(`Setting up better-sqlite3 for Electron ${electronVersion} (${process.platform}/${process.arch})...`)

  try {
    execSync(
      `node "${prebuildBin}" --runtime electron --target ${electronVersion} --dist-url https://electronjs.org/headers`,
      { stdio: 'inherit', cwd: betterSqlite3Dir }
    )
    console.log('better-sqlite3: installed prebuilt binary.')
    return
  } catch {
    // No prebuilt available for this platform/version, fall through to compile
  }

  console.log('better-sqlite3: no prebuilt found, compiling from source...')
  const { rebuild } = require('@electron/rebuild')
  await rebuild({
    buildPath: root,
    electronVersion,
    force: true,
    onlyModules: ['better-sqlite3']
  })
  console.log('better-sqlite3: compiled successfully.')
}

main().catch(err => {
  console.error('Failed to set up native modules:', err.message)
  process.exit(1)
})
