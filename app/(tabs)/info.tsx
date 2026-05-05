import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, TextInput } from 'react-native';
import { Stack } from 'expo-router';
import * as Audio from 'expo-audio';
import * as FileSystem from 'expo-file-system';

// Импортируем как угодно, но достаем функцию через require, чтобы TS не докапывался
const TcpSocket = require('react-native-tcp-socket');
const { ExpoPlayAudioStream } = require('@cjblack/expo-audio-stream');

export default function InfoScreen() {
	const [status, setStatus] = useState('Готов');
	const [targetIp, setTargetIp] = useState('');
	const [isRecording, setIsRecording] = useState(false);
	const [udpSocket, setUdpSocket] = useState<any>(null);

	const recorder = Audio.useAudioRecorder(Audio.RecordingPresets.HIGH_QUALITY);
	const player = Audio.useAudioPlayer(recorder.uri);
	const stopStreamRef = useRef<any>(null);

	useEffect(() => {
		Audio.setAudioModeAsync({
			allowsRecording: true,
			playsInSilentMode: true,
			shouldRouteThroughEarpiece: false,
		});

		// Создаем сокет без лишних проверок типов
		try {
			if (TcpSocket && TcpSocket.createSocket) {
				const s = TcpSocket.createSocket({ type: 'udp4' });
				s.bind(12345);
				setUdpSocket(s);
				return () => { if (s.close) s.close(); };
			}
		} catch (e) { console.log('Socket Error:', e); }
	}, []);

	const startTalk = async () => {
		const permission = await Audio.requestRecordingPermissionsAsync();
		if (!permission.granted) return;

		try {
			setIsRecording(true);
			setStatus('В ЭФИРЕ');

			// Начинаем обычную запись для файла
			await recorder.prepareToRecordAsync();
			recorder.record();

			// Начинаем стриминг в сеть
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
			setStatus('Ошибка старта');
			setIsRecording(false);
		}
	};

	const stopTalk = async () => {
		setIsRecording(false);
		setStatus('Готов');
		try {
			await recorder.stop();
			if (stopStreamRef.current && stopStreamRef.current.stop) {
				stopStreamRef.current.stop();
				stopStreamRef.current = null;
			}
		} catch (e) { console.log(e); }
	};

	return (
		<View style={{ flex: 1, backgroundColor: '#064e3b', padding: 20 }}>
			<Stack.Screen options={{ title: 'Real-time Рация' }} />
			
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
			</View>
		</View>
	);
}
