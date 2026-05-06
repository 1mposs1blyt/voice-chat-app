import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, FlatList, SafeAreaView } from 'react-native';
import { RTCPeerConnection, mediaDevices, RTCSessionDescription, RTCIceCandidate, MediaStream } from 'react-native-webrtc';
import Zeroconf from 'react-native-zeroconf';
import dgram from 'react-native-udp';
import { Buffer } from 'buffer';
import { Vibration } from 'react-native';

const UDP_PORT = 12345;
const SERVICE_TYPE = 'moto-intercom';
let globalPcs: Record<string, RTCPeerConnection> = {};
let isAppInitialized = false;
let persistentSocket: any = null;
let sdpBuffer: Record<string, string[]> = {};
export default function InfoScreen() {
	// 1. ОДНО объявление ID в корне компонента
	const myId = useRef(`Biker-${Math.random().toString(36).substring(7)}`).current;
	const [localStream, setLocalStream] = useState<MediaStream | null>(null);
	const [peers, setPeers] = useState<string[]>([]);
	const [isTalking, setIsTalking] = useState(false);
	const [status, setStatus] = useState('Инициализация...');

	const socket = useRef<any>(null);
	const zeroconf = useRef(new Zeroconf());
	const pcs = useRef<{ [key: string]: RTCPeerConnection }>({});


	useEffect(() => {
		if (isAppInitialized) return;
		isAppInitialized = true;
		initVoiceSystem();
		// ВАЖНО: Не закрывайте сокет здесь для тестов в Expo
	}, []);


	const createPeerConnection = (remoteIp: string, stream: MediaStream) => {
		// const pc = new RTCPeerConnection({ iceServers: [] });
		// const pc = new RTCPeerConnection({ iceServers: [] });
		const pc = new RTCPeerConnection({
			iceServers: [],
			// @ts-ignore
			iceTransportPolicy: 'all',
			bundlePolicy: 'max-bundle',
			rtcpMuxPolicy: 'require',
		} as any);
		pc.addEventListener('connectionstatechange', () => {
			console.log('--- СТАТУС СОЕДИНЕНИЯ:', pc.connectionState);
		});

		pc.addEventListener('iceconnectionstatechange', () => {
			console.log('--- ICE СТАТУС:', pc.iceConnectionState);
		});

		pc.addEventListener('track', (event) => {
			console.log('!!! ПОТОК ПРИШЕЛ !!!');
			Vibration.vibrate([100, 100, 100]); // Телефон будет вибрировать, когда звук физически дойдет
		});
		pc.addEventListener('icecandidate', (event: any) => {
			if (event.candidate) {
				sendSignal({ type: 'CANDIDATE', candidate: event.candidate }, remoteIp);
			}
		});

		stream.getTracks().forEach(track => pc.addTrack(track, stream));

		pc.addEventListener('track', (event) => {
			console.log('!!! ПОЛУЧЕН ЗВУК ОТ:', remoteIp);
		});

		return pc;
	};
	const createConnection = async (remoteIp: string) => {
		if (globalPcs[remoteIp] || !localStream) return;
		const pc = createPeerConnection(remoteIp, localStream);
		globalPcs[remoteIp] = pc;

		const offer = await pc.createOffer({ offerToReceiveAudio: true });
		await pc.setLocalDescription(offer);

		// Разбиваем OFFER на строки и шлем каждую отдельно
		const lines = offer.sdp.split('\n');
		lines.forEach((line: any, index: number) => {
			sendSignal({
				type: 'SDP_PART',
				line: line,
				isLast: index === lines.length - 1,
				sdpType: 'offer'
			}, remoteIp);
		});
		console.log('--- OFFER ОТПРАВЛЕН ПО ЧАСТЯМ ---');
	};
	const handleSignaling = async (data: any, remoteIp: string, stream: MediaStream) => {
		if (data.type === 'VIBRO') { Vibration.vibrate(50); return; }

		if (data.type === 'SDP_PART') {
			if (!sdpBuffer[remoteIp]) sdpBuffer[remoteIp] = [];
			sdpBuffer[remoteIp].push(data.line);

			if (data.isLast) {
				const fullSdp = sdpBuffer[remoteIp].join('\n');
				sdpBuffer[remoteIp] = []; // Чистим буфер

				console.log(`--- СОБРАН ПОЛНЫЙ ${data.sdpType.toUpperCase()} ---`);

				let pc = globalPcs[remoteIp];
				if (!pc) {
					pc = createPeerConnection(remoteIp, stream);
					globalPcs[remoteIp] = pc;
				}

				if (data.sdpType === 'offer') {
					await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: fullSdp }));
					const answer = await pc.createAnswer();
					await pc.setLocalDescription(answer);

					// Отправляем ANSWER тоже по частям
					answer.sdp.split('\n').forEach((line, index, arr) => {
						sendSignal({ type: 'SDP_PART', line, isLast: index === arr.length - 1, sdpType: 'answer' }, remoteIp);
					});
				} else {
					await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: fullSdp }));
				}
			}
			return;
		}

		if (data.type === 'CANDIDATE') {
			const pc = globalPcs[remoteIp];
			if (pc) await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
		}
	};
	const initVoiceSystem = async () => {
		try {
			const stream = await mediaDevices.getUserMedia({ audio: true, video: false });
			stream.getAudioTracks()[0].enabled = false;
			setLocalStream(stream);

			// Используем глобальную переменную, чтобы сокет не дох
			if (!persistentSocket) {
				persistentSocket = (dgram as any).createSocket('udp4');
				persistentSocket.bind(UDP_PORT);
				persistentSocket.on('message', (msg: any, rinfo: any) => {
					const data = JSON.parse(msg.toString());
					handleSignaling(data, rinfo.address, stream);
				});
				socket.current = persistentSocket;
			}

			setupDiscovery();
			setStatus('Система стабильна');
		} catch (e) {
			isAppInitialized = false;
			setStatus('Ошибка инициализации');
		}
	};
	const setupDiscovery = () => {
		zeroconf.current.publishService(SERVICE_TYPE, 'udp', 'local.', myId, UDP_PORT);
		zeroconf.current.scan(SERVICE_TYPE, 'udp', 'local.');

		zeroconf.current.on('resolved', (service) => {
			const remoteIp = service.addresses?.find(ip => !ip.includes(':'));
			if (!remoteIp || service.name === myId) return;

			// КРИТИЧНО: Если мы уже знаем этот IP, выходим сразу
			if (pcs.current[remoteIp]) return;

			if (!peers.includes(remoteIp)) {
				setPeers(prev => [...new Set([...prev, remoteIp])]);
			}

			if (myId < service.name) {
				console.log('--- ЕДИНОЖДЫ ОТПРАВЛЯЮ OFFER ---', remoteIp);
				createConnection(remoteIp);
			}
		});
	};
	const sendSignal = (data: any, ip: string) => {
		if (!persistentSocket) return;
		const message = JSON.stringify(data);
		persistentSocket.send(message, 0, message.length, UDP_PORT, ip);
	};
	const toggleTalk = (active: boolean) => {
		if (localStream) {
			if (active) {
				Vibration.vibrate(50); // Короткий вибро-отклик
				// Отправляем сигнал другим, если нужно, чтобы у них тоже вибрировало
				peers.forEach(ip => sendSignal({ type: 'VIBRO' }, ip));
			}
			localStream.getAudioTracks()[0].enabled = active;
			setIsTalking(active);
		}
	};
	return (
		<SafeAreaView className="flex-1 bg-slate-950 p-6">
			<View className="items-center mb-8">
				<Text className="text-white text-3xl font-bold">Intercom</Text>
				<Text className="text-slate-400 mt-2">{status}</Text>
			</View>

			<View className="flex-1 bg-slate-900/50 rounded-3xl p-4 mb-6 border border-slate-800">
				<Text className="text-slate-500 font-semibold mb-4 uppercase text-xs tracking-widest">
					Участники ({peers.length})
				</Text>
				<FlatList
					data={peers}
					keyExtractor={item => item}
					renderItem={({ item }) => (
						<View className="flex-row items-center bg-slate-800/50 p-3 rounded-xl mb-2 border border-slate-700/50">
							<View className="w-2 h-2 rounded-full bg-emerald-500 mr-3" />
							<Text className="text-slate-200 font-medium">Biker @ {item}</Text>
						</View>
					)}
				/>
			</View>

			<View className="items-center justify-center pb-10">
				<TouchableOpacity
					activeOpacity={0.8}
					onPressIn={() => toggleTalk(true)}
					onPressOut={() => toggleTalk(false)}
					className={`w-48 h-48 rounded-full items-center justify-center border-8 
            ${isTalking ? 'bg-red-600 border-red-500 shadow-2xl shadow-red-500/50' : 'bg-slate-800 border-slate-700'}`}
				>
					<Text className="text-white text-4xl font-black">{isTalking ? 'LIVE' : 'PTT'}</Text>
					<Text className="text-white/60 text-xs mt-2 font-bold uppercase tracking-tighter">Push to talk</Text>
				</TouchableOpacity>
			</View>
		</SafeAreaView>
	);
}
