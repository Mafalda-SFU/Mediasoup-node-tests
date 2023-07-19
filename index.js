import testActiveSpeakerObserver from '@mafalda-sfu/mediasoup-node-tests/test-ActiveSpeakerObserver'
import testAudioLevelObserver from '@mafalda-sfu/mediasoup-node-tests/test-AudioLevelObserver'
import testConsumer from '@mafalda-sfu/mediasoup-node-tests/test-consumer'
import testDataConsumer from '@mafalda-sfu/mediasoup-node-tests/test-DataConsumer'
import testDataProducer from '@mafalda-sfu/mediasoup-node-tests/test-DataProducer'
import testDirectTransport from '@mafalda-sfu/mediasoup-node-tests/test-DirectTransport'
import testMediasoup from '@mafalda-sfu/mediasoup-node-tests/test-mediasoup'
import testMultiopus from '@mafalda-sfu/mediasoup-node-tests/test-multiopus'
import testNodeSctp from '@mafalda-sfu/mediasoup-node-tests/test-node-sctp'
import testOrtc from '@mafalda-sfu/mediasoup-node-tests/test-ortc'
import testPipeTransport from '@mafalda-sfu/mediasoup-node-tests/test-PipeTransport'
import testPlainTransport from '@mafalda-sfu/mediasoup-node-tests/test-PlainTransport'
import testProducer from '@mafalda-sfu/mediasoup-node-tests/test-producer'
import testRouter from '@mafalda-sfu/mediasoup-node-tests/test-Router'
import testWebRtcServer from '@mafalda-sfu/mediasoup-node-tests/test-WebRtcServer'
import testWebRtcTransport from '@mafalda-sfu/mediasoup-node-tests/test-WebRtcTransport'
import testWorker from '@mafalda-sfu/mediasoup-node-tests/test-Worker'


export default function(mediasoup)
{
  describe('Mediasoup node tests', function()
  {
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
