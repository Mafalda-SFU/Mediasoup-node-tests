const {ok} = require('node:assert/strict')

const {
  default: testActiveSpeakerObserver
} = require('@mafalda-sfu/mediasoup-node-tests/ActiveSpeakerObserver')
const {
  default: testAudioLevelObserver
} = require('@mafalda-sfu/mediasoup-node-tests/AudioLevelObserver')
const {
  default: testConsumer
} = require('@mafalda-sfu/mediasoup-node-tests/Consumer')
const {
  default: testDataConsumer
} = require('@mafalda-sfu/mediasoup-node-tests/DataConsumer')
const {
  default: testDataProducer
} = require('@mafalda-sfu/mediasoup-node-tests/DataProducer')
const {
  default: testDirectTransport
} = require('@mafalda-sfu/mediasoup-node-tests/DirectTransport')
const {
  default: testMediasoup
} = require('@mafalda-sfu/mediasoup-node-tests/mediasoup')
const {
  default: testMultiopus
} = require('@mafalda-sfu/mediasoup-node-tests/multiopus')
const {
  default: testNodeSctp
} = require('@mafalda-sfu/mediasoup-node-tests/node-sctp')
const {
  default: testOrtc
} = require('@mafalda-sfu/mediasoup-node-tests/ortc')
const {
  default: testPipeTransport
} = require('@mafalda-sfu/mediasoup-node-tests/PipeTransport')
const {
  default: testPlainTransport
} = require('@mafalda-sfu/mediasoup-node-tests/PlainTransport')
const {
  default: testProducer
} = require('@mafalda-sfu/mediasoup-node-tests/Producer')
const {
  default: testRouter
} = require('@mafalda-sfu/mediasoup-node-tests/Router')
const {
  default: testWebRtcServer
} = require('@mafalda-sfu/mediasoup-node-tests/WebRtcServer')
const {
  default: testWebRtcTransport
} = require('@mafalda-sfu/mediasoup-node-tests/WebRtcTransport')
const {
  default: testWorker
} = require('@mafalda-sfu/mediasoup-node-tests/Worker')
const satisfies = require('semver/functions/satisfies')

const {version} = require('./package.json')


const [major, minor] = version.split('.')
const range = `^${major}.${minor}`


module.exports = function(mediasoup)
{
  describe('Mediasoup node tests', function()
  {
    ok(
      satisfies(mediasoup.version, range),
      `mediasoup version mismatch (${mediasoup.version}, tests range: ${range})`
    )

    // HACK: Mediasoup tests have the worker binary path hardcoded based on the
    //       tests directory. We need to override it.
    process.env.MEDIASOUP_WORKER_BIN = mediasoup.workerBin

    testActiveSpeakerObserver(mediasoup)
    testAudioLevelObserver(mediasoup)
    testConsumer(mediasoup)
    testDataConsumer(mediasoup)
    testDataProducer(mediasoup)
    testDirectTransport(mediasoup)
    testMediasoup(mediasoup)
    testMultiopus(mediasoup)
    testNodeSctp(mediasoup)
    testOrtc(mediasoup)
    testPipeTransport(mediasoup)
    testPlainTransport(mediasoup)
    testProducer(mediasoup)
    testRouter(mediasoup)
    testWebRtcServer(mediasoup)
    testWebRtcTransport(mediasoup)
    testWorker(mediasoup)
  })
}
