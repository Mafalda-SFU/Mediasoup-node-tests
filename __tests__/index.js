const mediasoupNodeTests = require('@mafalda-sfu/mediasoup-node-tests');
const mediasoup = require('mediasoup');


test('layout', function()
{
  expect(mediasoupNodeTests).toMatchInlineSnapshot(`[Function]`)
})

mediasoupNodeTests(mediasoup)
