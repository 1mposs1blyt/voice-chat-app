import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, TextInput } from 'react-native';
import { Stack } from 'expo-router';
import * as Audio from 'expo-audio';
import * as FileSystem from 'expo-file-system';

// Используем require, чтобы не ругался TS
const TcpSocket = require('react-native-tcp-socket');
const createSocket = TcpSocket.createSocket;

let ExpoPlayAudioStream: any = null;
try {
	const StreamModule = require('@cjblack/expo-audio-stream');
	ExpoPlayAudioStream = StreamModule.ExpoPlayAudioStream || StreamModule;
} catch (e) {
	console.log("Стриминг недоступен в Expo Go");
}

export default function InfoScreen() {
	const [status, setStatus] = useState('Готов');
	const [targetIp, setTargetIp] = useState('');
	const [isRecording, setIsRecording] = useState(false);
	const [udpSocket, setUdpSocket] = useState<any>(null);

	const recorder = Audio.useAudioRecorder(Audio.RecordingPresets.HIGH_QUALITY);
	const player = Audio.useAudioPlayer(recorder.uri);
	const stopStreamRef = useRef<any>(null);

	// 1. Инициализация аудио и СОКЕТА (Прием + Пинг)
	useEffect(() => {
		Audio.setAudioModeAsync({
			allowsRecording: true,
			playsInSilentMode: true,
			shouldRouteThroughEarpiece: false,
		});

		if (typeof createSocket === 'function') {
			try {
				const s = createSocket({ type: 'udp4' });

				// ОБРАБОТКА ВХОДЯЩИХ (Пинг и Звук)
				s.on('message', (msg: any, rinfo: any) => {
					const data = msg.toString();

					if (data === 'CHECK_PING') {
						s.send('CHECK_PONG', 0, 10, 12345, rinfo.address);
						return;
					}
					if (data === 'CHECK_PONG') {
						setStatus(`Связь с ${rinfo.address} ОК!`);
						return;
					}

					// Если пришел звук (не текст) — играем
					if (ExpoPlayAudioStream && ExpoPlayAudioStream.playRaw) {
						ExpoPlayAudioStream.playRaw(msg);
						setStatus(`Прием звука...`);
					}
				});

				s.bind(12345);
				setUdpSocket(s);
				setStatus('Сокет готов!');
			} catch (e: any) {
				console.log('ОШИБКА СОКЕТА:', e);
			}
		}

		return () => { if (udpSocket && udpSocket.close) udpSocket.close(); };
	}, []);

	// Функция проверки связи
	const testConnection = () => {
		// Если сокета нет, пробуем создать его "на лету"
		let activeSocket = udpSocket;

		if (!activeSocket && typeof createSocket === 'function') {
			try {
				activeSocket = createSocket({ type: 'udp4' });
				activeSocket.bind(12345);
				setUdpSocket(activeSocket);
				console.log("СОКЕТ СОЗДАН ПРИ ПРОВЕРКЕ");
			} catch (e) {
				console.log("ОШИБКА ПРИ СОЗДАНИИ:", e);
			}
		}

		if (activeSocket && targetIp) {
			setStatus('Проверка...');
			console.log("Шлем пинг на", targetIp);
			activeSocket.send('CHECK_PING', 0, 10, 12345, targetIp, (err: any) => {
				if (err) console.log("ОШИБКА UDP:", err);
			});
		} else {
			setStatus('Ошибка: сокет null. Пересобери APK!');
			console.log("КРИТИЧНО: createSocket is", typeof createSocket);
		}
	};

	const playLast = async () => {
		if (recorder.uri) {
			setStatus('Воспроизведение...');
			await player.replace(recorder.uri);
			player.play();
			setTimeout(() => setStatus('Готов'), 2000);
		}
	};

	const startTalk = async () => {
		const { granted } = await Audio.requestRecordingPermissionsAsync();
		if (!granted) {
			setStatus('Микрофон запрещен!');
			return;
		}

		try {
			setIsRecording(true);
			setStatus(ExpoPlayAudioStream ? 'В ЭФИРЕ' : 'ЗАПИСЬ (Expo Go)');

			await recorder.prepareToRecordAsync();
			recorder.record();

			if (ExpoPlayAudioStream && udpSocket && targetIp) {
				const stream = await ExpoPlayAudioStream.startRecording({
					interval: 100,
					onAudioData: (chunk: any) => {
						udpSocket.send(chunk.data, 0, chunk.data.length, 12345, targetIp, (err: any) => {
							if (err) console.log("ОШИБКА UDP:", err);
						});
					},
				});
				stopStreamRef.current = stream;
			}
		} catch (e) {
			setStatus('Ошибка старта');
			setIsRecording(false);
		}
	};

	const stopTalk = async () => {
		if (!isRecording) return;
		setIsRecording(false);
		setStatus('Готов');
		try {
			if (recorder.isRecording) await recorder.stop();
			if (stopStreamRef.current && stopStreamRef.current.stop) {
				stopStreamRef.current.stop();
				stopStreamRef.current = null;
			}
		} catch (e) { console.log('Stop Error:', e); }
	};

	return (
		<View style={{ flex: 1, backgroundColor: '#064e3b', padding: 20 }}>
			<Stack.Screen options={{ title: 'Рация' }} />

			<View style={{ marginTop: 50, backgroundColor: '#065f46', padding: 20, borderRadius: 15 }}>
				<Text style={{ color: 'white', fontSize: 18 }}>Статус: {status}</Text>
				<TextInput
					placeholder="IP получателя"
					placeholderTextColor="#a7f3d0"
					value={targetIp}
					onChangeText={setTargetIp}
					keyboardType="numeric"
					style={{ backgroundColor: '#047857', color: 'white', padding: 10, borderRadius: 10, marginTop: 15 }}
				/>
				<TouchableOpacity onPress={testConnection} style={{ marginTop: 10, padding: 8, backgroundColor: '#059669', borderRadius: 8, alignItems: 'center' }}>
					<Text style={{ color: 'white' }}>Проверить связь</Text>
				</TouchableOpacity>
			</View>

			<View style={{ flex: 1, justifyContent: 'center' }}>
				<TouchableOpacity
					onLongPress={startTalk}
					onPressOut={stopTalk}
					delayLongPress={100}
					style={{
						width: 160, height: 160, borderRadius: 80, alignSelf: 'center',
						backgroundColor: isRecording ? '#ef4444' : '#10b981',
						justifyContent: 'center', alignItems: 'center',
						elevation: 10
					}}
				>
					<Text style={{ color: 'white', fontWeight: 'bold', fontSize: 20 }}>
						{isRecording ? 'ЭФИР' : 'ГОВОРИТЬ'}
					</Text>
				</TouchableOpacity>

				{recorder.uri && !isRecording && (
					<TouchableOpacity onPress={playLast} style={{ marginTop: 40, padding: 15, backgroundColor: '#3b82f6', borderRadius: 12, alignItems: 'center' }}>
						<Text style={{ color: 'white', fontWeight: '600' }}>▶ Прослушать последнюю запись</Text>
					</TouchableOpacity>
				)}
			</View>

			{!ExpoPlayAudioStream && (
				<Text style={{ color: '#fca5a5', textAlign: 'center', marginTop: 20, fontSize: 12 }}>
					⚠ Режим Expo Go. Сеть отключена.
				</Text>
			)}
		</View>
	);
}
