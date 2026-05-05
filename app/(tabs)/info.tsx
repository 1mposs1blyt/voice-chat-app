import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput } from 'react-native';
import { Stack } from 'expo-router';
import { useAudioRecorder, AudioModule, RecordingPresets } from 'expo-audio';
// ИСПОЛЬЗУЕМ ТАКОЙ ИМПОРТ:
import { createSocket } from 'react-native-tcp-socket';
export default function InfoScreen() {
	const [status, setStatus] = useState('Готов');
	const [targetIp, setTargetIp] = useState('');
	const [isRecording, setIsRecording] = useState(false);
	const [udpSocket, setUdpSocket] = useState<any>(null);

	const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

	useEffect(() => {
		try {
			// В этой библиотеке для UDP правильно вызывать так:
			const s = createSocket({ type: 'udp4' });

			s.on('message', (msg: any, rinfo: any) => {
				setStatus(`Звук от ${rinfo.address}`);
			});

			s.bind(12345);
			setUdpSocket(s);
		} catch (e) {
			console.log('Socket Error:', e);
		}

		return () => {
			if (udpSocket) udpSocket.close();
		};
	}, []);

	const startTalk = async () => {
		const { granted } = await AudioModule.requestRecordingPermissionsAsync();
		if (!granted) {
			setStatus('Микрофон запрещен в настройках!');
			return;
		}

		try {
			setStatus('Запись...');
			setIsRecording(true);
			await recorder.prepareToRecordAsync();
			recorder.record();
		} catch (e) {
			setStatus('Ошибка записи');
		}
	};

	const stopTalk = async () => {
		setIsRecording(false);
		setStatus('Отправка...');
		try {
			await recorder.stop();
			// recorder.uri содержит путь к файлу, который нужно будет отправить
			if (udpSocket && targetIp) {
				udpSocket.send('AUDIO_DATA', 0, 10, 12345, targetIp, (err: any) => {
					setStatus(err ? 'Ошибка сети' : 'Передано');
				});
			}
		} catch (e) {
			console.error(e);
		}
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
					style={{
						backgroundColor: '#047857', color: 'white', padding: 10,
						borderRadius: 10, marginTop: 15
					}}
				/>
			</View>

			<View style={{ flex: 1, justifyContent: 'center' }}>
				<TouchableOpacity
					onLongPress={startTalk}
					onPressOut={stopTalk}
					style={{
						width: 150, height: 150, borderRadius: 75, alignSelf: 'center',
						backgroundColor: isRecording ? '#ef4444' : '#10b981',
						justifyContent: 'center', alignItems: 'center'
					}}
				>
					<Text style={{ color: 'white', fontWeight: 'bold' }}>
						{isRecording ? 'ГОВОРЮ' : 'ЗАЖМИ'}
					</Text>
				</TouchableOpacity>
			</View>
		</View>
	);
}
