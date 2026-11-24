import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Reads the files from disk with Node, so it lives at the project root (see vitest.config.ts).
const FOLDER = 'src/assets/piano'
const PIANO = 'fluidr3-gm-0-0-yamaha-grand-piano.sf2'

function sha256(bytes: Uint8Array) {
  return createHash('sha256').update(bytes).digest('hex')
}

describe('the committed piano soundfont', () => {
  const provenance = readFileSync(`${FOLDER}/fluidr3-gm-0-0-yamaha-grand-piano.provenance.txt`, 'utf8')

  it('is the file its provenance note describes', () => {
    const piano = readFileSync(`${FOLDER}/${PIANO}`)

    expect(provenance).toContain(`SHA-256: ${sha256(piano)}`)
    // A SoundFont 2 file starts "RIFF", four bytes of length, then "sfbk".
    expect(piano.subarray(0, 4).toString('latin1')).toBe('RIFF')
    expect(piano.subarray(8, 12).toString('latin1')).toBe('sfbk')
  })

  it('is under the 25 MiB that Cloudflare serves per file', () => {
    expect(readFileSync(`${FOLDER}/${PIANO}`).length).toBeLessThan(25 * 1024 * 1024)
  })

  it('has its licence notice beside it, unchanged', () => {
    const notice = readFileSync(`${FOLDER}/COPYING`)

    expect(provenance).toContain(`SHA-256 ${sha256(notice)}`)
    expect(notice.toString('utf8')).toContain('Permission is hereby granted, free of charge')
  })
})
