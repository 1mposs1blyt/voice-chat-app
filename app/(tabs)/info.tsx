import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, TextInput } from 'react-native';
import { Stack } from 'expo-router';
import * as Audio from 'expo-audio';
import * as FileSystem from 'expo-file-system';

// --- БЛОК ИСКЛЮЧЕНИЙ ДЛЯ EXPO GO ---
let TcpSocket: any = null;
let ExpoPlayAudioStream: any = null;

try {
	TcpSocket = require('react-native-tcp-socket');
	const StreamModule = require('@cjblack/expo-audio-stream');
	ExpoPlayAudioStream = StreamModule.ExpoPlayAudioStream;
} catch (e) {
	console.warn("Нативные модули не найдены. Работаем в режиме Expo Go.");
}

export default function InfoScreen() {
	const [status, setStatus] = useState('Готов');
	const [targetIp, setTargetIp] = useState('');
	const [isRecording, setIsRecording] = useState(false);
	const [udpSocket, setUdpSocket] = useState<any>(null);

	const recorder = Audio.useAudioRecorder(Audio.RecordingPresets.HIGH_QUALITY);
	const player = Audio.useAudioPlayer(recorder.uri); // Плеер привязан к URI рекордера
	const stopStreamRef = useRef<any>(null);

	useEffect(() => {
		Audio.setAudioModeAsync({
			allowsRecording: true,
			playsInSilentMode: true,
			shouldRouteThroughEarpiece: false,
		});

		if (TcpSocket && TcpSocket.createSocket) {
			try {
				const s = TcpSocket.createSocket({ type: 'udp4' });
				s.bind(12345);
				setUdpSocket(s);
				return () => { if (s && s.close) s.close(); };
			} catch (e) { console.log('Socket Init Error:', e); }
		}
	}, []);
	// asdasdasdsad
	// Функция прослушивания
	const playLast = async () => {
		if (recorder.uri) {
			setStatus('Воспроизведение...');
			await player.replace(recorder.uri);
			player.play();
			setTimeout(() => {
				setStatus('Готов');
			}, 2000)
		} else {
			setStatus('Записей нет');
		}
	};

	const startTalk = async () => {
		const { granted } = await Audio.requestRecordingPermissionsAsync();
		if (!granted) {
			setStatus('Микрофон запрещен!');
			return;
		}

		try {
			if (!recorder.isRecording) {
				setIsRecording(true);
				setStatus(ExpoPlayAudioStream ? 'В ЭФИРЕ' : 'ЗАПИСЬ (Expo Go)');

				// В новых версиях expo-audio используем try-catch для подготовки
				try {
					await recorder.prepareToRecordAsync();
				} catch (err) {
					// Если уже подготовлен, просто игнорируем ошибку и идем дальше
					console.log('Рекордер уже был готов');
				}

				recorder.record();
			}

			if (ExpoPlayAudioStream && udpSocket && targetIp) {
				const stream = await ExpoPlayAudioStream.startRecording({
					interval: 100,
					onAudioData: (chunk: any) => {
						udpSocket.send(chunk.data, 0, chunk.data.length, 12345, targetIp);
					},
				});
				stopStreamRef.current = stream;
			}
		} catch (e) {
			console.error('Start Error:', e);
			setStatus('Ошибка старта');
			setIsRecording(false);
		}
	};


	const stopTalk = async () => {
		// Если статус записи false, значит мы даже не начинали из-за прав
		if (!isRecording) return;

		setIsRecording(false);
		setStatus('Готов');

		try {
			// Проверяем, действительно ли рекордер записывает перед тем как стопать
			if (recorder.isRecording) {
				await recorder.stop();
			}

			if (stopStreamRef.current && stopStreamRef.current.stop) {
				stopStreamRef.current.stop();
				stopStreamRef.current = null;
			}
		} catch (e) {
			console.log('Stop Error:', e);
		}
	};
	useEffect(() => {
		Audio.setAudioModeAsync({
			allowsRecording: true,
			playsInSilentMode: true,
			shouldRouteThroughEarpiece: false,
		});

		if (TcpSocket && TcpSocket.createSocket) {
			try {
				const s = TcpSocket.createSocket({ type: 'udp4' });

				// --- ПРИЕМ ДАННЫХ ---
				s.on('message', (msg: string, rinfo: any) => {
					console.log(`Получен пакет размером ${msg.length} от ${rinfo.address}`);
					if (ExpoPlayAudioStream) {
						try {
							// Попробуй один из этих вариантов (зависит от точной версии):
							if (ExpoPlayAudioStream.play) {
								ExpoPlayAudioStream.play(msg);
							} else if (ExpoPlayAudioStream.push) {
								ExpoPlayAudioStream.push(msg);
							}
							setStatus(`Прием: ${rinfo.address}`);
						} catch (err) {
							console.error('Ошибка воспроизведения чанка:', err);
						}
					}
				});

				s.bind(12345);
				setUdpSocket(s);
				return () => { if (s && s.close) s.close(); };
			} catch (e) { console.log('Socket Init Error:', e); }
		}
	}, []);
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

				{/* ВОТ ОНА — ВОЗВРАЩЕННАЯ КНОПКА */}
				{recorder.uri && !isRecording && (
					<TouchableOpacity
						onPress={playLast}
						style={{
							marginTop: 40,
							padding: 15,
							backgroundColor: '#3b82f6',
							borderRadius: 12,
							alignItems: 'center'
						}}
					>
						<Text style={{ color: 'white', fontWeight: '600' }}>▶ Прослушать запись</Text>
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
