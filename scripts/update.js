#!/usr/bin/env node

const {mkdir, rm, writeFile} = require('node:fs/promises');
const {basename, dirname, sep} = require('node:path');
const {Readable} = require('node:stream');
const {text} = require('node:stream/consumers');
const {createGunzip} = require('node:zlib');

const PackageJson = require('@npmcli/package-json');
const lte = require('semver/functions/lte.js');
const simpleGit = require('simple-git');
const tar = require('tar-stream');


const options = {force: true, recursive: true}
const repo = 'versatica/mediasoup';

(async function()
{
  const [{tag_name: version, tarball_url}, pkgJson] = await Promise.all([
    fetch(`https://api.github.com/repos/${repo}/releases/latest`)
    .then(res => res.json()),
    PackageJson.load('.')
  ])

  if(lte(version, pkgJson.content.version)) return

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
    path.shift()
    path = path.join(sep)

    if(path === 'tsconfig.json')
    {
      const content = await text(entry);

      await writeFile(path, content, 'utf8')
      continue
    }

    if(path.startsWith('src/tests'))
    {
      let path2 = path.split(sep)
      path2.shift()
      if(path2[0] === 'tests') path2[0] = 'src'
      path2 = path2.join(sep)

      switch(type)
      {
        case 'directory':
          await mkdir(path2, options)
          break

        case 'file':
          {
            let content = await text(entry);

            if(dirname(path2) === 'src')
            {
              const lines = content.split('\n')
              content = []

              let indent = ''

              for(let line of lines)
              {
                if(line.startsWith('import'))
                {
                  if(line.includes('mediasoup')) continue

                  if(line.includes('../errors'))
                    line = line.replace('../errors', 'mediasoup/node/lib/errors')
                  if(line.includes('../ortc'))
                    line = line.replace('../ortc', 'mediasoup/node/lib/ortc')
                }

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
})()
