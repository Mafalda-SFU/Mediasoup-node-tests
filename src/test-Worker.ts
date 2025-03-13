import * as os from 'node:os';
import * as process from 'node:process';
import * as path from 'node:path';
import { enhancedOnce } from './enhancedEvents';
import type { WorkerEvents } from '../types';

import * as utils from './utils'

const skipIfHasVirtualPids =
  process.env.HAS_VIRTUAL_PIDS
    ? test.skip
    : test

export default function(mediasoup): void
{
	describe('Worker', () =>
	{
		test('mediasoup.workerBin matches mediasoup-worker absolute path', () => {
			const workerBin = process.env.MEDIASOUP_WORKER_BIN
				? process.env.MEDIASOUP_WORKER_BIN
				: process.env.MEDIASOUP_BUILDTYPE === 'Debug'
					? path.join(
							__dirname,
							'..',
							'..',
							'..',
							'worker',
							'out',
							'Debug',
							'mediasoup-worker'
						)
					: path.join(
							__dirname,
							'..',
							'..',
							'..',
							'worker',
							'out',
							'Release',
							'mediasoup-worker'
						);

			expect(mediasoup.workerBin).toBe(workerBin);
		});

		test('mediasoup.createWorker() succeeds', async () => {
			const onObserverNewWorker = jest.fn();

			mediasoup.observer.once('newworker', onObserverNewWorker);

			const worker1 = await mediasoup.createWorker();

			expect(onObserverNewWorker).toHaveBeenCalledTimes(1);
			expect(onObserverNewWorker).toHaveBeenCalledWith(worker1);
			expect(worker1.constructor.name).toBe('WorkerImpl');
			expect(typeof worker1.pid).toBe('number');
			expect(worker1.closed).toBe(false);
			expect(worker1.died).toBe(false);

			worker1.close();

			await enhancedOnce<WorkerEvents>(worker1, 'subprocessclose');

			expect(worker1.closed).toBe(true);
			expect(worker1.died).toBe(false);

			const worker2 = await mediasoup.createWorker<{ foo: number; bar?: string }>({
				logLevel: 'debug',
				logTags: ['info'],
				rtcMinPort: 0,
				rtcMaxPort: 9999,
				dtlsCertificateFile: path.join(__dirname, 'data', 'dtls-cert.pem'),
				dtlsPrivateKeyFile: path.join(__dirname, 'data', 'dtls-key.pem'),
				libwebrtcFieldTrials: 'WebRTC-Bwe-AlrLimitedBackoff/Disabled/',
				disableLiburing: true,
				appData: { foo: 456 },
			});

			expect(worker2.constructor.name).toBe('WorkerImpl');
			expect(typeof worker2.pid).toBe('number');
			expect(worker2.closed).toBe(false);
			expect(worker2.died).toBe(false);
			expect(worker2.appData).toEqual({ foo: 456 });

			worker2.close();

			await enhancedOnce<WorkerEvents>(worker2, 'subprocessclose');

			expect(worker2.closed).toBe(true);
			expect(worker2.died).toBe(false);
		}, 2000);

		test('mediasoup.createWorker() with wrong settings rejects with TypeError', async () => {
			// @ts-expect-error --- Testing purposes.
			await utils.expect_rejects_toThrow(mediasoup.createWorker({ logLevel: 'chicken' }), 'TypeError');

			await utils.expect_rejects_toThrow(
				mediasoup.createWorker({ rtcMinPort: 1000, rtcMaxPort: 999 })
			, 'TypeError');

			// Port is from 0 to 65535.
			await utils.expect_rejects_toThrow(
				mediasoup.createWorker({ rtcMinPort: 1000, rtcMaxPort: 65536 })
			, 'TypeError');

			await utils.expect_rejects_toThrow(
				mediasoup.createWorker({ dtlsCertificateFile: '/notfound/cert.pem' })
			, 'TypeError');

			await utils.expect_rejects_toThrow(
				mediasoup.createWorker({ dtlsPrivateKeyFile: '/notfound/priv.pem' })
			, 'TypeError');

			await utils.expect_rejects_toThrow(
				// @ts-expect-error --- Testing purposes.
				mediasoup.createWorker({ appData: 'NOT-AN-OBJECT' })
			, 'TypeError');
		}, 2000);

		test('worker.updateSettings() succeeds', async () => {
			const worker = await mediasoup.createWorker();

			await expect(
				worker.updateSettings({ logLevel: 'debug', logTags: ['ice'] })
			).resolves.toBeUndefined();

			worker.close();

			await enhancedOnce<WorkerEvents>(worker, 'subprocessclose');
		}, 2000);

		test('worker.updateSettings() with wrong settings rejects with TypeError', async () => {
			const worker = await mediasoup.createWorker();

			// @ts-expect-error --- Testing purposes.
			await utils.expect_rejects_toThrow(worker.updateSettings({ logLevel: 'chicken' }), 'TypeError');

			worker.close();

			await enhancedOnce<WorkerEvents>(worker, 'subprocessclose');
		}, 2000);

		test('worker.updateSettings() rejects with InvalidStateError if closed', async () => {
			const worker = await mediasoup.createWorker();

			worker.close();

			await enhancedOnce<WorkerEvents>(worker, 'subprocessclose');

			await utils.expect_rejects_toThrow(worker.updateSettings({ logLevel: 'error' }), 'InvalidStateError');
		}, 2000);

		test('worker.dump() succeeds', async () => {
			const worker = await mediasoup.createWorker();

			await expect(worker.dump()).resolves.toMatchObject({
				pid: worker.pid,
				webRtcServerIds: [],
				routerIds: [],
				channelMessageHandlers: {
					channelRequestHandlers: [],
					channelNotificationHandlers: [],
				},
			});

			worker.close();
		}, 2000);

		test('worker.dump() rejects with InvalidStateError if closed', async () => {
			const worker = await mediasoup.createWorker();

			worker.close();

			await enhancedOnce<WorkerEvents>(worker, 'subprocessclose');

			await utils.expect_rejects_toThrow(worker.dump(), 'InvalidStateError');
		}, 2000);

		test('worker.getResourceUsage() succeeds', async () => {
			const worker = await mediasoup.createWorker();

			await expect(worker.getResourceUsage()).resolves.toMatchObject({});

			worker.close();

			await enhancedOnce<WorkerEvents>(worker, 'subprocessclose');
		}, 2000);

		test('worker.close() succeeds', async () => {
			const worker = await mediasoup.createWorker({ logLevel: 'warn' });
			const onObserverClose = jest.fn();

			worker.observer.once('close', onObserverClose);
			worker.close();

			await enhancedOnce<WorkerEvents>(worker, 'subprocessclose');

			expect(onObserverClose).toHaveBeenCalledTimes(1);
			expect(worker.closed).toBe(true);
			expect(worker.died).toBe(false);
		}, 2000);

		skipIfHasVirtualPids('Worker emits "died" if mediasoup-worker process died unexpectedly', async () => {
			let onDied: ReturnType<typeof jest.fn>;
			let onObserverClose: ReturnType<typeof jest.fn>;

			const worker1 = await mediasoup.createWorker({ logLevel: 'warn' });

			onDied = jest.fn();
			onObserverClose = jest.fn();

			worker1.observer.once('close', onObserverClose);

			await new Promise<void>((resolve, reject) => {
				worker1.on('died', () => {
					onDied();

					if (onObserverClose.mock.calls.length > 0) {
						reject(
							new Error('observer "close" event emitted before worker "died" event')
						);
					} else if (worker1.closed) {
						resolve();
					} else {
						reject(new Error('worker.closed is false'));
					}
				});

				process.kill(worker1.pid, 'SIGINT');
			});

			if (!worker1.subprocessClosed) {
				await enhancedOnce<WorkerEvents>(worker1, 'subprocessclose');
			}

			expect(onDied).toHaveBeenCalledTimes(1);
			expect(onObserverClose).toHaveBeenCalledTimes(1);
			expect(worker1.closed).toBe(true);
			expect(worker1.died).toBe(true);

			const worker2 = await mediasoup.createWorker({ logLevel: 'warn' });

			onDied = jest.fn();
			onObserverClose = jest.fn();

			worker2.observer.once('close', onObserverClose);

			await new Promise<void>((resolve, reject) => {
				worker2.on('died', () => {
					onDied();

					if (onObserverClose.mock.calls.length > 0) {
						reject(
							new Error('observer "close" event emitted before worker "died" event')
						);
					} else if (worker2.closed) {
						resolve();
					} else {
						reject(new Error('worker.closed is false'));
					}
				});

				process.kill(worker2.pid, 'SIGTERM');
			});

			if (!worker2.subprocessClosed) {
				await enhancedOnce<WorkerEvents>(worker2, 'subprocessclose');
			}

			expect(onDied).toHaveBeenCalledTimes(1);
			expect(onObserverClose).toHaveBeenCalledTimes(1);
			expect(worker2.closed).toBe(true);
			expect(worker2.died).toBe(true);

			const worker3 = await mediasoup.createWorker({ logLevel: 'warn' });

			onDied = jest.fn();
			onObserverClose = jest.fn();

			worker3.observer.once('close', onObserverClose);

			await new Promise<void>((resolve, reject) => {
				worker3.on('died', () => {
					onDied();

					if (onObserverClose.mock.calls.length > 0) {
						reject(
							new Error('observer "close" event emitted before worker "died" event')
						);
					} else if (worker3.closed) {
						resolve();
					} else {
						reject(new Error('worker.closed is false'));
					}
				});

				process.kill(worker3.pid, 'SIGKILL');
			});

			if (!worker3.subprocessClosed) {
				await enhancedOnce<WorkerEvents>(worker3, 'subprocessclose');
			}

			expect(onDied).toHaveBeenCalledTimes(1);
			expect(onObserverClose).toHaveBeenCalledTimes(1);
			expect(worker3.closed).toBe(true);
			expect(worker3.died).toBe(true);
		}, 5000);

		// Windows doesn't have some signals such as SIGPIPE, SIGALRM, SIGUSR1, SIGUSR2
		// so we just skip this test in Windows.
		if (os.platform() !== 'win32') {
			skipIfHasVirtualPids('mediasoup-worker process ignores PIPE, HUP, ALRM, USR1 and USR2 signals', async () => {
				const worker = await mediasoup.createWorker({ logLevel: 'warn' });

				await new Promise<void>((resolve, reject) => {
					worker.on('died', reject);

					process.kill(worker.pid, 'SIGPIPE');
					process.kill(worker.pid, 'SIGHUP');
					process.kill(worker.pid, 'SIGALRM');
					process.kill(worker.pid, 'SIGUSR1');
					process.kill(worker.pid, 'SIGUSR2');

					setTimeout(() => {
						expect(worker.closed).toBe(false);

						worker.on('subprocessclose', resolve);
						worker.close();
					}, 2000);
				});
			}, 4000);
		}
	});
}