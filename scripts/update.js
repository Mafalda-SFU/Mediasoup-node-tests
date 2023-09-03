#!/usr/bin/env node

const {mkdir, rm, writeFile} = require('node:fs/promises');
const {basename, dirname, sep} = require('node:path');
const {Readable} = require('node:stream');
const {text} = require('node:stream/consumers');
const {createGunzip} = require('node:zlib');

const PackageJson = require('@npmcli/package-json');
const eq = require('semver/functions/eq.js');
const lt = require('semver/functions/lt.js');
const simpleGit = require('simple-git');
const tar = require('tar-stream');


const options = {force: true, recursive: true}
const repo = 'versatica/mediasoup';


function filterOrtcUnsuportedError(line)
{
  return this.toString() !== 'ortc' || !line.includes('UnsupportedError')
}


(async function()
{
  const [{tag_name: version, tarball_url}, pkgJson] = await Promise.all([
    fetch(`https://api.github.com/repos/${repo}/releases/latest`)
    .then(res => res.json()),
    PackageJson.load('.')
  ])

  if(lt(version, pkgJson.content.version))
    throw new Error(
      `Published mediasoup version ${version} is older than version ` +
      `${pkgJson.content.version} from the package.json file. Maybe there's ` +
      `a mistake in the package.json version?`
    )

  if(eq(version, pkgJson.content.version)) return

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

              let describeName
              let imports = []
              let indent = ''

              for(let line of lines)
              {
                if(!line.length)
                {
                  content.push(line)
                  continue
                }

                if(line.startsWith('import'))
                {
                  // Ignore imports of mediasoup, since we are going to do
                  // dependency injection.
                  if(line.includes('mediasoup')) continue

                  // Replace imports of mediasoup types.
                  if(line.includes('../errors'))
                  {
                    imports.push(
                      line
                        .replace('import', 'const')
                        .replace("from '../errors'", '= mediasoup.types')
                    )
                    continue
                  }

                  if(line.includes('../ortc'))
                    line = line.replace('../ortc', 'mediasoup/node/lib/ortc')
                }

                else if(!indent)
                {
                  if(line.startsWith('//'))
                  {
                    content.push(line)
                    continue
                  }

                  indent = '\t\t'

                  if(!content[0]) content.shift()

                  describeName = basename(path2, '.ts').slice(5)

                  // TODO: generate type for `mediasoup`, or use
                  //       `typeof mediasoup`. It's only needed for Typescript
                  content.push('export default function(mediasoup): void')
                  content.push('{')

                  imports = imports.filter(
                    filterOrtcUnsuportedError, describeName
                  )

                  if(imports.length)
                  {
                    for(const line of imports) content.push('\t' + line)

                    content.push('')
                  }

                  content.push(`\tdescribe('${describeName}', () =>`)
                  content.push('\t{')
                }

                else if(describeName === 'ortc')
                {
                  if(line.includes('.toThrow(UnsupportedError)'))
                    line = line.replace('UnsupportedError', '')
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
  if(!length) return

  const {
    content: {
      dependencies, devDependencies, optionalDependencies, peerDependencies
    }
  } = pkgJson

  pkgJson.update({
    dependencies: {
      ...dependencies,
      mediasoup: `^${version}`
    },
    devDependencies,
    optionalDependencies,
    peerDependencies,
    version
  })

  await pkgJson.save()

  // Print version
  console.log(version)
})()
