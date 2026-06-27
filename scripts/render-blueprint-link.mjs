#!/usr/bin/env node
/**
 * Genera el deeplink de Render Blueprint desde el remote git actual.
 */

import { execSync } from 'node:child_process'

function remoteToHttps(remote) {
  const trimmed = remote.trim()
  if (trimmed.startsWith('git@')) {
    return trimmed
      .replace(/^git@([^:]+):/, 'https://$1/')
      .replace(/\.git$/, '')
  }
  return trimmed.replace(/\.git$/, '')
}

let remote = ''
try {
  remote = execSync('git remote get-url origin', { encoding: 'utf8' }).trim()
} catch {
  console.error('No se pudo leer git remote origin. Configurá un remoto GitHub/GitLab/Bitbucket primero.')
  process.exit(1)
}

const repoUrl = remoteToHttps(remote)
const link = `https://dashboard.render.com/blueprint/new?repo=${encodeURIComponent(repoUrl)}`

console.log('\nRender Blueprint deeplink')
console.log(`Repo: ${repoUrl}`)
console.log(`Link: ${link}`)
