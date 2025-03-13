#!/usr/bin/env node

const {ok} = require('node:assert');
const {mkdir, rm, writeFile} = require('node:fs/promises');
const {basename, dirname, sep} = require('node:path');
const {Readable} = require('node:stream');
const {text} = require('node:stream/consumers');
const {createGunzip} = require('node:zlib');

const tar = require('tar-stream');


const options = {force: true, recursive: true}
const repo = 'versatica/mediasoup'
const TransportTs = `import * as FbsTransport from '@mafalda-sfu/mediasoup-node-fbs/transport';

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
const enhancedEventsTs = `import { EventEmitter, once } from 'node:events';

type Events = Record<string, any[]>;

/**
 * TypeScript version of events.once():
 *   https://nodejs.org/api/events.html#eventsonceemitter-name-options
 */
export async function enhancedOnce<E extends Events = Events>(
  emmiter: EventEmitter<E>,
  eventName: keyof E & string,
  options?: any
): Promise<any[]> {
  return once(emmiter, eventName, options);
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
}

export async function expect_rejects_toThrow(expression, errorMessage?: string): Promise<void>
{
  try
  {
    await expression;
  }
  catch (error)
  {
    if (!errorMessage || error.toString().includes(errorMessage)) return;

    throw error;
  }

  throw new Error('Expression did not throw');
}

export function expect_not_toThrow(fn: () => void, errorMessage?: string): void
{
  try
  {
    fn();
  }
  catch (error)
  {
    if(!errorMessage || error.toString().includes(errorMessage)) throw error;
  }
}

export function expect_toThrow(fn: () => void, errorMessage?: string): void
{
  try
  {
    fn();
  }
  catch (error)
  {
    if (!errorMessage || error.toString().includes(errorMessage)) return;

    console.log(error, error.name, error.toString(), errorMessage);
    throw error;
  }

  throw new Error('Function did not throw');
}`


async function createFiles()
{
  return Promise.all([
    writeFile('src/Transport.ts', TransportTs, 'utf8'),
    writeFile('src/enhancedEvents.ts', enhancedEventsTs, 'utf8'),
    writeFile('src/utils.ts', utilsTs, 'utf8')
  ])
}

function importUtils(line)
{
  return line.includes('import * as utils from')
}


let {argv: [,, version]} = process
if(!version?.length) ({version} = require('../package.json'));


(async function()
{
  const [response] = await Promise.all([
    fetch(`https://api.github.com/repos/${repo}/tarball/${version}`),
    rm('src', options)
    .then(mkdir.bind(null, 'src', options))
    .then(createFiles)
  ])

  ok(response.ok, response.statusText)

  const extract = Readable.fromWeb(response.body).pipe(createGunzip()).pipe(tar.extract())

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
              let expectStatement
              let importStatement
              let indent = ''
              let insideExpect = false
              let insideImport = false

              for(let line of lines)
              {
                if(!line.length)
                {
                  content.push(line)
                  continue
                }

                if(line.includes('expect('))
                {
                  expectStatement = ''
                  insideExpect = true
                }

                if(line.startsWith('import'))
                {
                  importStatement = ''
                  insideImport = true
                }

                if(insideExpect)
                {
                  if(expectStatement) expectStatement += '\n' + indent
                  expectStatement += line

                  if(!line.includes(';')) continue

                  insideExpect = false

                  // https://github.com/tc39/proposal-is-error
                  // > `instanceof Error`, of course, is unreliable because it
                  // > will provide a false negative with a cross-realm (eg, from
                  // > an iframe, or node's `vm` modules) `Error` instance.
                  let replaced = expectStatement.replace(
                    /expect\s*\((?<expression>[^;]+)\)\.rejects\.toThrow\(\s*(?<errorClass>[^;]*?)\s*\)/m,
                    `utils.expect_rejects_toThrow($<expression>, '$<errorClass>')`
                  )

                  if(replaced === expectStatement)
                  {
                    replaced = expectStatement.replace(
                      /expect\s*\((?<expression>[^;]+)\)\.toThrow\(\s*(?<errorClass>'[^']*?')\s*\)/m,
                      `utils.expect_toThrow($<expression>, $<errorClass>)`
                    )

                    if(replaced === expectStatement)
                    {
                      replaced = expectStatement.replace(
                        /expect\s*\((?<expression>[^;]+)\)\.toThrow\(\s*(?<errorClass>[^;]*?)\s*\)/m,
                        `utils.expect_toThrow($<expression>, '$<errorClass>')`
                      )

                      if(replaced === expectStatement)
                        replaced = expectStatement.replace(
                          /expect\s*\((?<expression>[^;]+)\)\.not\.toThrow\(\s*(?<errorClass>[^;]*?)\s*\)/m,
                          `utils.expect_not_toThrow($<expression>, '$<errorClass>')`
                        )
                    }
                  }

                  line = replaced
                }

                else if(insideImport)
                {
                  if(importStatement) importStatement += '\n' + indent
                  importStatement += line

                  if(!line.includes('from')) continue

                  insideImport = false

                  // Ignore imports of mediasoup, since we are going to do
                  // dependency injection.
                  // TODO: generate type for `mediasoup`, or use
                  //       `typeof mediasoup`. It's only needed for Typescript
                  if(line.includes('mediasoup')) continue

                  // Replace imports of mediasoup types.
                  if(line.includes('../errors')) continue

                  if(line.includes('../fbs'))
                    line = importStatement.replace(
                      '../fbs', '@mafalda-sfu/mediasoup-node-fbs'
                    )

                  else if(line.includes('../ortc'))
                    line = importStatement.replace(
                      '../ortc', '@mafalda-sfu/mediasoup-ortc'
                    )

                  else if(line.includes('../Transport'))
                    line = importStatement.replace(
                      '../Transport', './Transport'
                    )

                  else if(line.includes('../enhancedEvents'))
                    line = importStatement.replace(
                      '../enhancedEvents', './enhancedEvents'
                    )

                  else if(line.includes('../utils'))
                    line = importStatement.replace('../utils', './utils')

                  else
                    line = importStatement
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
                    content.push("import type {Index} from '../indexTypes'")

                    content.push('')
                  }
                  else if(
                    describeName !== 'node-sctp' &&
                    !content.some(importUtils)
                  ) {
                    content.push("import * as utils from './utils'")
                    content.push('')
                  }

                  if(describeName === 'Worker')
                  {
                    content.push('const skipIfHasVirtualPids =')
                    content.push('  process.env.HAS_VIRTUAL_PIDS')
                    content.push('    ? test.skip')
                    content.push('    : test')

                    content.push('')
                  }

                  content.push(
                    'export default function(mediasoup: Index): void'
                  )
                  content.push('{')

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

                else if(describeName === 'Worker')
                {
                  if(line.includes('Worker emits "died" if mediasoup-worker')
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
})()
