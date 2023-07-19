#!/usr/bin/env node

import {mkdir, rm, writeFile} from 'node:fs/promises';
import {basename, dirname, sep} from 'node:path';
import {Readable} from 'node:stream';
import {text} from 'node:stream/consumers';
import {createGunzip} from 'node:zlib';

import PackageJson from '@npmcli/package-json';
import gt from 'semver/functions/gt.js';
import simpleGit from 'simple-git';
import tar from 'tar-stream'


const imports = [
  'node/src/errors.ts',
  'node/src/ortc.ts',
  'node/src/RtpParameters.ts',
  'node/src/SctpParameters.ts',
  'node/src/scalabilityModes.ts',
  'node/src/supportedRtpCapabilities.ts',
  'node/src/utils.ts',
  'node/tsconfig.json'
]
const options = {force: true, recursive: true}
const repo = 'versatica/mediasoup';
const testsFolder = 'node/src/tests';

const [{tag_name: version, tarball_url}, pkgJson] = await Promise.all([
  fetch(`https://api.github.com/repos/${repo}/releases/latest`)
  .then(res => res.json()),
  PackageJson.load('.')
])

if(gt(version, pkgJson.content.version))
{
  const [{body}] = await Promise.all([
    fetch(tarball_url),
    rm('src', options)
    .then(mkdir.bind(null, 'src', options))
  ])

  const extract = Readable.fromWeb(body).pipe(createGunzip()).pipe(tar.extract())

  for await (const entry of extract)
  {
    const {name, type} = entry.header

    let path = name.split(sep)
    path.shift()
    path = path.join(sep)

    if(imports.includes(path) || path.startsWith(testsFolder))
    {
      let path2 = path.split(sep)
      path2.shift()
      path2 = path2.join(sep)

      switch(type)
      {
        case 'directory':
          await mkdir(path2, options)
          break

        case 'file':
          {
            let content = await text(entry);

            if(dirname(path) === testsFolder)
            {
              const lines = content.split('\n')
              content = []

              let indent = ''

              for(const line of lines)
              {
                if(line.startsWith('import') && line.includes('mediasoup'))
                  continue

                if(!line.length || line.startsWith('import') || line.startsWith('//'))
                {
                  content.push(line)
                  continue
                }

                if(!indent)
                {
                  indent = '\t\t'

                  if(!content[0]) content.shift()

                  const describeName = basename(path2, '.ts').slice(5)

                  // TODO: generate type for `mediasoup`, or use
                  //       `typeof mediasoup`. It's only needed for Typescript
                  content.push('export default function(mediasoup): void')
                  content.push('{')
                  content.push(`\tdescribe('${describeName}', () =>`)
                  content.push('\t{')
                }

                content.push(indent + line)
              }

              if(!content.at(-1)) content.pop()

              content.push('\t});')
              content.push('}')

              content = content.join('\n')
            }

            await writeFile(path2, content, 'utf8')
          }
          break

        default:
          throw new Error(`Unknown entry type: ${type}`)
      }
    }

    entry.resume()
  }

  const git = simpleGit()
  const {files: {length}} = await git.status()

  if(length)
  {
    pkgJson.update({version})

    await pkgJson.save()

    await git.add('.')
    await git.commit(`Update to mediasoup@${version}`)
    await git.addTag(version)

    await Promise.all([
      git.push(),
      git.pushTags()
    ])
  }
}
