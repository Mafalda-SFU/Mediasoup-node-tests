# Mediasoup-node-tests

[![main](https://github.com/Mafalda-SFU/Mediasoup-node-tests/actions/workflows/main.yml/badge.svg)](https://github.com/Mafalda-SFU/Mediasoup-node-tests/actions/workflows/main.yml)
[![npm](https://img.shields.io/npm/v/@mafalda-sfu/mediasoup-node-tests.svg)](https://www.npmjs.com/package/@mafalda-sfu/mediasoup-node-tests)

Node.js tests extracted from [Mediasoup](https://mediasoup.org/)

This project host some scripts to extract, update and release the tests from
`Mediasoup` as in independent package. This is intended to validate that other
projects implementing the `Mediasoup` API like [Mafalda SFU](https://mafalda.io)
are compatible with the original.

The tests are automatically extracted from the
[Mediasoup repository](https://github.com/versatica/mediasoup) and updated for
each new release.

## Installation

```sh
npm install --save-dev jest @mafalda-sfu/mediasoup-node-tests
```

## Usage

```js
import mediasoupNodeTests from '@mafalda-sfu/mediasoup-node-tests'

import mediasoup from '...'


mediasoupNodeTests(mediasoup)
```

## License

[ISC](./LICENSE)
