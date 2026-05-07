import React from 'react';
import { TouchableOpacity, Text, View } from 'react-native';
import { Audio } from 'expo-av';

export default function InfoScreen() {
	const testMic = async () => {
		try {
			console.log("Запрос прав...");
			const { status } = await Audio.requestPermissionsAsync();

			if (status === 'granted') {
				console.log("Права получены! Включаю микрофон...");
				await Audio.setAudioModeAsync({
					allowsRecordingIOS: true,
					playsInSilentModeIOS: true,
				});

				// Создаем пустую запись просто чтобы активировать железо
				const recording = new Audio.Recording();
				await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
				await recording.startAsync();

				alert("МИКРОФОН ВКЛЮЧЕН! Посмотри на индикатор (зеленая точка).");

				// Выключим через 5 секунд
				setTimeout(async () => {
					await recording.stopAndUnloadAsync();
					console.log("Микрофон выключен");
				}, 5000);
			} else {
				alert("Вы запретили доступ к микрофону");
			}
		} catch (err) {
			console.error("Ошибка:", err);
		}
	};

	return (
		<View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
			<TouchableOpacity
				onPress={testMic}
				style={{ padding: 20, backgroundColor: 'red', borderRadius: 10 }}
			>
				<Text style={{ color: 'white', fontWeight: 'bold' }}>ВКЛЮЧИТЬ МИКРОФОН (ТЕСТ)</Text>
			</TouchableOpacity>
		</View>
	);
}
