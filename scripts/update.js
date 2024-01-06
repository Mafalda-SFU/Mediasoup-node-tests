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
const repo = 'versatica/mediasoup'
const TransportTs = `import * as FbsTransport from '../gen/fbs/transport';

/**
 * Transport protocol.
 */
export type TransportProtocol = 'udp' | 'tcp';

export type TransportTuple =
{
  localIp: string;
  localPort: number;
  remoteIp?: string;
  remotePort?: number;
  protocol: TransportProtocol;
};

export function serializeProtocol(protocol: TransportProtocol): FbsTransport.Protocol
{
  switch (protocol)
  {
    case 'udp':
    {
      return FbsTransport.Protocol.UDP;
    }

    case 'tcp':
    {
      return FbsTransport.Protocol.TCP;
    }
  }
}`
const utilsTs = `/**
* Make an object or array recursively immutable.
* https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/freeze.
*/
export function deepFreeze<T>(object: T): T
{
 // Retrieve the property names defined on object.
 const propNames = Reflect.ownKeys(object as any);

 // Freeze properties before freezing self.
 for (const name of propNames)
 {
   const value = (object as any)[name];

   if ((value && typeof value === 'object') || typeof value === 'function')
   {
     deepFreeze(value);
   }
 }

 return Object.freeze(object);
}`


function filterOrtcUnsuportedError(line)
{
  return this.toString() !== 'ortc' || !line.includes('UnsupportedError')
}

function isNotRustRelease({tag_name})
{
  return !tag_name.startsWith('rust-')
}


(async function()
{
  const releases = await fetch(`https://api.github.com/repos/${repo}/releases`)
    .then(res => res.json())

  const {url} = releases.find(isNotRustRelease)

  const [{tag_name: version, tarball_url}, pkgJson] = await Promise.all([
    fetch(url)
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
    .then(writeFile.bind(null, 'src/Transport.ts', TransportTs, 'utf8'))
    .then(writeFile.bind(null, 'src/utils.ts', utilsTs, 'utf8'))
  ])

  const extract = Readable.fromWeb(body).pipe(createGunzip()).pipe(tar.extract())

  for await (const entry of extract)
  {
    const {name, type} = entry.header

    let path = name.split(sep)
    path.shift()
    path = path.join(sep)

    if(path === 'node/tsconfig.json')
    {
      path = path.split(sep)
      path.shift()
      path = path.join(sep)

      const content = await text(entry);

      await writeFile(path, content, 'utf8')
      continue
    }

    if(path.startsWith('worker/fbs'))
    {
      let path2 = path.split(sep)
      path2.shift()
      // Ensure path fragment is exactly `fbs/`, not something like `fbs...`
      if(path2[0] === 'fbs') path2.unshift('src')
      path2 = path2.join(sep)

      switch(type)
      {
        case 'directory':
          await mkdir(path2, options)
          break

        case 'file':
          {
            const content = await text(entry);

            await writeFile(path2, content, 'utf8')
          }
          break

        default:
          throw new Error(`Unknown entry type: ${type}`)
      }

      continue
    }

    if(path.startsWith('node/src/test'))
    {
      let path2 = path.split(sep)
      path2.shift()
      path2.shift()
      // Ensure path fragment is exactly `test/`, not something like `test...`
      if(path2[0] === 'test') path2[0] = 'src'
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
              let insideImport = false

              for(let line of lines)
              {
                if(!line.length)
                {
                  content.push(line)
                  continue
                }

                if(line.startsWith('import'))
                  insideImport = true

                if(insideImport)
                {
                  if(!line.includes('from'))
                  {
                    content.push(line)
                    continue
                  }

                  insideImport = false

                  // Ignore imports of mediasoup, since we are going to do
                  // dependency injection.
                  // TODO: generate type for `mediasoup`, or use
                  //       `typeof mediasoup`. It's only needed for Typescript
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

                  if(line.includes('../fbs'))
                    line = line.replace('../fbs', '../gen/fbs')

                  else if(line.includes('../ortc'))
                    line = line.replace(
                      '../ortc', '@mafalda-sfu/mediasoup-ortc'
                    )

                  else if(line.includes('../Transport'))
                    line = line.replace('../Transport', './Transport')

                  else if(line.includes('../utils'))
                    line = line.replace('../utils', './utils')
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

                  if(describeName === 'mediasoup')
                  {
                    content.push("import {sync} from 'pkg-dir'")

                    content.push('')
                  }

                  else if(describeName === 'Worker')
                  {
                    content.push('const skipIfHasVirtualPids =')
                    content.push('  process.env.HAS_VIRTUAL_PIDS')
                    content.push('    ? test.skip')
                    content.push('    : test')

                    content.push('')
                  }

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

                else if(describeName === 'mediasoup')
                {
                  if(line.includes('__dirname'))
                    line = line.replace(
                      "__dirname, '..', '..', '..'", 'sync(__dirname)'
                    )
                }

                else if(describeName === 'ortc')
                {
                  if(line.includes('.toThrow(UnsupportedError)'))
                    line = line.replace('UnsupportedError', 'Error')
                }

                else if(describeName === 'Worker')
                {
                  if(line.includes('Worker emits "died" if worker process died')
                  || line.includes('worker process ignores PIPE, HUP, ALRM,'))
                    line = line.replace('test', 'skipIfHasVirtualPids')
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
    dependencies,
    devDependencies: {
      ...devDependencies,
      mediasoup: `^${version}`
    },
    optionalDependencies,
    peerDependencies,
    version
  })

  await pkgJson.save()

  // Print new version
  console.log(version)
})()
