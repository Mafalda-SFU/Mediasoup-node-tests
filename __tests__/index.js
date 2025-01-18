const {readFileSync} = require('fs');
const {join} = require('path');

const mediasoupNodeTests = require('@mafalda-sfu/mediasoup-node-tests');
const mediasoup = require('mediasoup');
const {sync} = require('pkg-dir');


const {version} = JSON.parse(
  readFileSync(join(sync(__dirname), 'package.json'), {encoding: 'utf-8'})
);


test('layout', function()
{
  expect(mediasoupNodeTests).toMatchInlineSnapshot(`[Function]`)
})

mediasoupNodeTests({...mediasoup, version})
