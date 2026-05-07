import React, { useEffect, useState } from 'react';
import { SafeAreaView, TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { mediaDevices, MediaStream } from 'react-native-webrtc';

export default function TestMicScreen() {
	const [stream, setStream] = useState<MediaStream | null>(null);
	const [isTesting, setIsTesting] = useState(false);
	useEffect(() => {
		console.log("Проверка наличия WebRTC модуля:", !!mediaDevices.getUserMedia);
	}, []);
	const startLocalTest = async () => {
		try {
			console.log("--- ЗАПУСК ТЕСТА МИКРОФОНА ---");

			// 1. ПРИНУДИТЕЛЬНЫЙ ЗАПРОС
			const localStream = await mediaDevices.getUserMedia({
				audio: {
					echoCancellation: false, // Для теста выключим, чтобы слышать себя
					noiseSuppression: false,
					autoGainControl: true,
				} as any,
				video: false
			}) as MediaStream;

			// 2. ВКЛЮЧАЕМ ТРЕК
			localStream.getAudioTracks().forEach(t => {
				t.enabled = true;
				console.log("Трек активен:", t.label);
			});

			setStream(localStream);
			setIsTesting(true);

			console.log("!!! СЕЙЧАС ДОЛЖНА ПОЯВИТЬСЯ ЗЕЛЕНАЯ ТОЧКА !!!");
			alert("Говорите в микрофон. Если точка есть, вы должны слышать себя (возможен свист!)");

		} catch (e) {
			console.error("ОШИБКА:", e);
			alert("Не удалось запустить микрофон: " + e.message);
		}
	};

	const stopTest = () => {
		if (stream) {
			stream.getTracks().forEach(t => t.stop());
			setStream(null);
		}
		setIsTesting(false);
	};

	return (
		<SafeAreaView style={styles.container}>
			<Text style={styles.title}>Тест микрофона</Text>

			{!isTesting ? (
				<TouchableOpacity style={styles.button} onPress={startLocalTest}>
					<Text style={styles.btnText}>ВКЛЮЧИТЬ "ЭХО" ТЕСТ</Text>
				</TouchableOpacity>
			) : (
				<TouchableOpacity style={[styles.button, { backgroundColor: 'red' }]} onPress={stopTest}>
					<Text style={styles.btnText}>ВЫКЛЮЧИТЬ ТЕСТ</Text>
				</TouchableOpacity>
			)}

			<View style={styles.info}>
				<Text>Статус: {isTesting ? "ЗАПИСЬ ИДЕТ" : "ОЖИДАНИЕ"}</Text>
				<Text style={{ marginTop: 10, color: 'gray' }}>
					Если точка не горит — проверьте разрешения в настройках телефона вручную.
				</Text>
			</View>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
	title: { fontSize: 24, marginBottom: 40 },
	button: { width: 250, height: 60, backgroundColor: '#4CAF50', justifyContent: 'center', alignItems: 'center', borderRadius: 30 },
	btnText: { color: '#white', fontWeight: 'bold' },
	info: { marginTop: 40, padding: 20, alignItems: 'center' }
});
